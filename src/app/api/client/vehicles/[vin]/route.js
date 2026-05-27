import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { resolveClientId } from "@/app/api/utils/impersonate";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
    try {
        const { vin } = params;
        const resolved = await resolveClientId(request);
        
        if (resolved.error) {
            return Response.json({ error: resolved.error }, { status: 401 });
        }

        const clientId = resolved.clientId;
        const isImpersonating = resolved.isImpersonating;

        // If not impersonating, do role check
        if (!isImpersonating) {
            const session = await auth();
            let role = session?.user?.role;
            if (!role) {
                const userCheck = await sql`SELECT role FROM auth_users WHERE id = ${clientId}`;
                if (userCheck.length > 0) role = userCheck[0].role;
            }
            if (role !== "client" && role !== "admin") {
                return Response.json({ error: "Forbidden: Client access only" }, { status: 403 });
            }
        }

        const vehicles = await sql`
            SELECT 
                v.id,
                v.vin,
                v.description,
                v.purchase_date,
                v.lot_number,
                v.auction_id,
                v.destination_id,
                v.current_status,
                v.payment_status,
                a.name as auction_name,
                d.country_name as destination_country,
                d.port_name as destination_port,
                u.name as buyer_name,
                v.terminal_id,
                v.location_id,
                
                -- We only expose client-facing prices
                v.purchase_price as client_base_price,
                
                (
                  SELECT COALESCE(SUM(amount), 0) + 
                  CASE 
                    WHEN NOT EXISTS (SELECT 1 FROM invoice_line_items WHERE vehicle_id = v.id AND invoice_id IS NULL AND (type = 'PURCHASE' OR description ILIKE '%Purchase%'))
                    THEN COALESCE(v.purchase_price, 0)
                    ELSE 0 
                  END
                  FROM invoice_line_items WHERE vehicle_id = v.id AND invoice_id IS NULL
                ) as total_due
            FROM vehicles v
            LEFT JOIN auctions a ON v.auction_id = a.id
            LEFT JOIN destinations d ON v.destination_id = d.id
            LEFT JOIN auth_users u ON v.client_id = u.id
            WHERE v.vin = ${vin} AND v.client_id = ${clientId}
        `;

        if (vehicles.length === 0) {
            return Response.json({ error: "Vehicle not found" }, { status: 404 });
        }

        const vehicle = vehicles[0];
        let year = "", make = "", model = "";
        if (vehicle.description) {
            const cleanDesc = vehicle.description.replace(/\s*\([^)]*\)\s*/g, '').trim();
            const parts = cleanDesc.split(" ");
            year = parts[0] || "N/A";
            make = parts[1] || "";
            model = parts.slice(2).join(" ") || "";
        }

        const mappedVehicle = {
            ...vehicle,
            year,
            make,
            model,
            client_total_price: vehicle.total_due,
        };

        // Also fetch assigned services to show which ones are active
        const vehicleServices = await sql`
            SELECT vsd.*, s.name as service_name, s.category as service_category
            FROM vehicle_service_details vsd
            LEFT JOIN services s ON vsd.service_id = s.id
            WHERE vsd.vehicle_id = ${vehicle.id}
        `;

        // The terminal is actually stored directly on the vehicle in the DB schema
        let terminal = null;
        if (vehicle.terminal_id) {
            const terminals = await sql`SELECT * FROM shippers_terminals WHERE id = ${vehicle.terminal_id}`;
            if (terminals.length > 0) terminal = terminals[0];
        }

        return Response.json({
            vehicle: mappedVehicle,
            services: vehicleServices,
            terminal: terminal
        }, { status: 200 });

    } catch (error) {
        console.error(`GET /api/client/vehicles/${params.vin} error:`, error);
        return Response.json({
            error: "Failed to fetch vehicle details",
            details: error.message
        }, { status: 500 });
    }
}

export async function PUT(request, { params }) {
    try {
        const { vin } = params;
        const resolved = await resolveClientId(request);

        if (resolved.error) {
            return Response.json({ error: resolved.error }, { status: 401 });
        }

        const clientId = resolved.clientId;
        const isImpersonating = resolved.isImpersonating;

        // If not impersonating, do role check
        if (!isImpersonating) {
            const session = await auth();
            let role = session?.user?.role;
            if (!role) {
                const userCheck = await sql`SELECT role FROM auth_users WHERE id = ${clientId}`;
                if (userCheck.length > 0) role = userCheck[0].role;
            }
            if (role !== "client" && role !== "admin") {
                return Response.json({ error: "Forbidden: Client access only" }, { status: 403 });
            }
        }

        const body = await request.json();

        // Security check: Make sure vehicle belongs to this client
        const authCheck = await sql`SELECT id FROM vehicles WHERE vin = ${vin} AND client_id = ${clientId}`;
        if (authCheck.length === 0) {
            return Response.json({ error: "Vehicle not found" }, { status: 404 });
        }

        const vehicleId = authCheck[0].id;

        // Perform safe updates (only allow specific columns)
        const updateParams = [];
        const updateValues = [];

        // Example: Only update destination_id, title_type, dismantling
        if (body.destination_id !== undefined) {
            await sql`UPDATE vehicles SET destination_id = ${body.destination_id || null} WHERE id = ${vehicleId}`;
        }

        // Handling Terminal Assignment (direct column on vehicles table)
        if (body.terminal_id !== undefined) {
            await sql`UPDATE vehicles SET terminal_id = ${body.terminal_id || null} WHERE id = ${vehicleId}`;
        }

        // Handling Title Services via vehicle_service_details
        if (body.title_service_id !== undefined) {
            const existingTitle = await sql`
                SELECT vsd.id FROM vehicle_service_details vsd 
                JOIN services s ON vsd.service_id = s.id 
                WHERE vsd.vehicle_id = ${vehicleId} AND s.category = 'TITLE'
            `;

            if (body.title_service_id !== "") {
                if (existingTitle.length > 0) {
                    await sql`UPDATE vehicle_service_details SET service_id = ${body.title_service_id} WHERE id = ${existingTitle[0].id}`;
                } else {
                    await sql`
                        INSERT INTO vehicle_service_details (vehicle_id, service_id, status)
                        VALUES (${vehicleId}, ${body.title_service_id}, 'pending')
                    `;
                }
            } else if (existingTitle.length > 0) {
                // User reset to default standard, remove the special title service
                await sql`DELETE FROM vehicle_service_details WHERE id = ${existingTitle[0].id}`;
            }
        }

        // Handling Dismantling Services
        if (body.dismantling_service_id !== undefined) {
            const existingDismantling = await sql`
                SELECT vsd.id FROM vehicle_service_details vsd 
                JOIN services s ON vsd.service_id = s.id 
                WHERE vsd.vehicle_id = ${vehicleId} AND s.category = 'DISMANTLING'
            `;

            if (body.dismantling_service_id !== "") {
                if (existingDismantling.length > 0) {
                    await sql`UPDATE vehicle_service_details SET service_id = ${body.dismantling_service_id} WHERE id = ${existingDismantling[0].id}`;
                } else {
                    await sql`
                        INSERT INTO vehicle_service_details (vehicle_id, service_id, status)
                        VALUES (${vehicleId}, ${body.dismantling_service_id}, 'pending')
                    `;
                }
            } else if (existingDismantling.length > 0) {
                // User deselected dismantling
                await sql`DELETE FROM vehicle_service_details WHERE id = ${existingDismantling[0].id}`;
            }
        }

        // Update Status to 'pending_dispatch' if user is configuring it for the first time
        // The frontend considers 'purchased' or 'pending' as editable.
        await sql`
            UPDATE vehicles 
            SET current_status = 'pending_dispatch' 
            WHERE id = ${vehicleId} AND (current_status = 'purchased' OR current_status = 'pending' OR current_status IS NULL)
        `;

        return Response.json({ success: true, message: "Vehicle details updated" }, { status: 200 });

    } catch (error) {
        console.error(`PUT /api/client/vehicles/${params.vin} error:`, error);
        return Response.json({ error: "Failed to update vehicle details" }, { status: 500 });
    }
}
