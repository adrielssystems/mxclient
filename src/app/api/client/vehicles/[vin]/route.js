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
            if (role !== "client" && role !== "main_client" && role !== "sub_client" && role !== "admin") {
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
                t.lien_holder as has_lien,
                
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
                ) as total_due,
                
                (
                  SELECT quickbooks_invoice_id 
                  FROM invoices 
                  WHERE vehicle_id = v.id 
                  ORDER BY created_at DESC 
                  LIMIT 1
                ) as qb_invoice_id
            FROM vehicles v
            LEFT JOIN auctions a ON v.auction_id = a.id
            LEFT JOIN destinations d ON v.destination_id = d.id
            LEFT JOIN auth_users u ON v.client_id = u.id
            LEFT JOIN title_logs t ON v.vin = t.vin
            WHERE v.vin = ${vin} AND (v.client_id = ${clientId} OR v.client_id IN (SELECT sub_client_id FROM client_hierarchy WHERE main_client_id = ${clientId}))
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
            SELECT vsd.*, s.name as service_name, s.category as service_category,
            (SELECT amount FROM invoice_line_items WHERE vehicle_id = vsd.vehicle_id AND service_id = vsd.service_id LIMIT 1) as price
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
            if (role !== "client" && role !== "main_client" && role !== "sub_client" && role !== "admin") {
                return Response.json({ error: "Forbidden: Client access only" }, { status: 403 });
            }
        }

        const body = await request.json();

        // Security check: Make sure vehicle belongs to this client
        const authCheck = await sql`SELECT id, terminal_id FROM vehicles WHERE vin = ${vin} AND (client_id = ${clientId} OR client_id IN (SELECT sub_client_id FROM client_hierarchy WHERE main_client_id = ${clientId}))`;
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
            
            if (body.terminal_id) {
                // Resolve the DISPATCH service id
                const dispatchSvcRows = await sql`SELECT id FROM services WHERE category = 'DISPATCH' AND is_active = true LIMIT 1`;
                const dispatchSvcId = dispatchSvcRows.length > 0 ? dispatchSvcRows[0].id : null;

                if (dispatchSvcId) {
                    // Upsert vehicle_service_details for DISPATCH
                    const existingDispatch = await sql`
                        SELECT vsd.id FROM vehicle_service_details vsd 
                        JOIN services s ON vsd.service_id = s.id 
                        WHERE vsd.vehicle_id = ${vehicleId} AND s.category = 'DISPATCH'
                    `;
                    if (existingDispatch.length > 0) {
                        await sql`UPDATE vehicle_service_details SET service_id = ${dispatchSvcId} WHERE id = ${existingDispatch[0].id}`;
                    } else {
                        await sql`INSERT INTO vehicle_service_details (vehicle_id, service_id, status) VALUES (${vehicleId}, ${dispatchSvcId}, 'pending')`;
                        
                        // Also insert invoice_line_item if not already present
                        const existingDispatchItem = await sql`SELECT id FROM invoice_line_items WHERE vehicle_id = ${vehicleId} AND type = 'SERVICE' AND description ILIKE '%Transport%'`;
                        if (existingDispatchItem.length === 0 && body.dispatch_price) {
                            await sql`INSERT INTO invoice_line_items (vehicle_id, description, amount, type, service_id) VALUES (${vehicleId}, 'Inland Transport', ${body.dispatch_price}, 'SERVICE', ${dispatchSvcId})`;
                        }
                    }

                    // Update dispatch_status so admin can see it's pending
                    await sql`UPDATE vehicles SET dispatch_status = 'assignment_pending' WHERE id = ${vehicleId} AND (dispatch_status IS NULL OR dispatch_status = 'not_applicable')`;
                }
            } else {
                // Terminal removed — remove dispatch service detail
                await sql`
                    DELETE FROM vehicle_service_details 
                    WHERE vehicle_id = ${vehicleId} AND service_id IN (SELECT id FROM services WHERE category = 'DISPATCH')
                `;
                await sql`UPDATE vehicles SET dispatch_status = 'not_applicable' WHERE id = ${vehicleId} AND dispatch_status = 'assignment_pending'`;
            }

            // Set as default terminal logic
            if (body.setAsDefaultTerminal && body.terminal_id) {
                await sql`UPDATE auth_users SET preferred_destination_id = ${body.terminal_id} WHERE id = ${clientId}`;
            }
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

                // Also ensure vehicle_title_services record exists (this is what the Admin Panel reads)
                const existingTitleSvc = await sql`SELECT id FROM vehicle_title_services WHERE vehicle_id = ${vehicleId}`;
                if (existingTitleSvc.length === 0) {
                    await sql`INSERT INTO vehicle_title_services (vehicle_id) VALUES (${vehicleId})`;
                }
                // Mark vehicle title_status as processing so Admin Panel toggle activates
                await sql`UPDATE vehicles SET title_status = 'processing' WHERE id = ${vehicleId} AND (title_status IS NULL OR title_status = 'not_applicable')`;

                // Insert invoice_line_item for title if not already present and price provided
                if (body.title_price) {
                    const existingTitleItem = await sql`SELECT id FROM invoice_line_items WHERE vehicle_id = ${vehicleId} AND type = 'SERVICE' AND description ILIKE '%Title%'`;
                    if (existingTitleItem.length === 0) {
                        await sql`INSERT INTO invoice_line_items (vehicle_id, description, amount, type, service_id) VALUES (${vehicleId}, 'Title Service', ${body.title_price}, 'SERVICE', ${body.title_service_id})`;
                    }
                }

            } else if (existingTitle.length > 0) {
                // User reset to default standard, remove the special title service
                await sql`DELETE FROM vehicle_service_details WHERE id = ${existingTitle[0].id}`;

                // Also remove the title services record if it exists and has no data entered yet
                const existingTitleSvc = await sql`SELECT id FROM vehicle_title_services WHERE vehicle_id = ${vehicleId}`;
                if (existingTitleSvc.length > 0) {
                    await sql`DELETE FROM vehicle_title_services WHERE vehicle_id = ${vehicleId} AND (purchaser_name IS NULL OR purchaser_name = '')`;
                    // Revert title_status
                    await sql`UPDATE vehicles SET title_status = 'not_applicable' WHERE id = ${vehicleId} AND title_status = 'processing'`;
                }
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

        // Update Status to 'pending_dispatch' ONLY if fully configured (Terminal + Mailing)
        const terminalId = body.terminal_id !== undefined ? body.terminal_id : authCheck[0].terminal_id;
        const hasTerminal = terminalId !== null && terminalId !== "";
        
        const titleCheck = await sql`SELECT mailing_location FROM vehicle_titles WHERE vehicle_id = ${vehicleId}`;
        const hasMailing = titleCheck.length > 0 && titleCheck[0].mailing_location && titleCheck[0].mailing_location.trim() !== '';

        if (hasTerminal && hasMailing) {
            await sql`
                UPDATE vehicles 
                SET current_status = 'pending_dispatch' 
                WHERE id = ${vehicleId} AND (current_status = 'purchased' OR current_status = 'pending' OR current_status IS NULL)
            `;
        } else {
            // Revert to purchased if they unselected something while in pending_dispatch
            await sql`
                UPDATE vehicles 
                SET current_status = 'purchased' 
                WHERE id = ${vehicleId} AND current_status = 'pending_dispatch'
            `;
        }

        return Response.json({ success: true, message: "Vehicle details updated" }, { status: 200 });

    } catch (error) {
        console.error(`PUT /api/client/vehicles/${params.vin} error:`, error);
        return Response.json({ error: "Failed to update vehicle details" }, { status: 500 });
    }
}
