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

        // Role check
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

        // Fetch vehicle with all safe information
        const vehicles = await sql`
            SELECT 
                v.*,
                a.name as auction_name,
                l.name as auction_location,
                d.country_name as destination_country,
                d.port_name as destination_port,
                u.name as buyer_name,
                st.name as terminal_name,
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
            LEFT JOIN locations l ON v.location_id = l.id
            LEFT JOIN destinations d ON v.destination_id = d.id
            LEFT JOIN auth_users u ON v.client_id = u.id
            LEFT JOIN shippers_terminals st ON v.terminal_id = st.id
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
        vehicle.year = year;
        vehicle.make = make;
        vehicle.model = model;
        vehicle.client_total_price = vehicle.total_due;

        // Purchase source: AR or WI dealer = MotorX, anything else or null = External
        const isMotorXDealer = vehicle.dl_number && ['AR', 'WI'].includes(String(vehicle.dl_number).trim().toUpperCase());
        const isExternalSvc = vehicle.external_service === true || vehicle.purchase_source === 'External' || vehicle.purchase_status === 'not_applicable';
        vehicle.purchase_source = (isMotorXDealer && !isExternalSvc) ? 'MotorX' : 'External';

        // Fetch Services and their prices from invoice_line_items
        const serviceDetails = await sql`
            SELECT vsd.*, s.name as service_name, s.category as service_category,
            (SELECT amount FROM invoice_line_items WHERE vehicle_id = vsd.vehicle_id AND service_id = vsd.service_id LIMIT 1) as price
            FROM vehicle_service_details vsd
            LEFT JOIN services s ON vsd.service_id = s.id
            WHERE vsd.vehicle_id = ${vehicle.id}
        `;

        // Fetch Invoices
        const invoices = await sql`
            SELECT * FROM invoices 
            WHERE vehicle_id = ${vehicle.id} 
            ORDER BY created_at DESC
        `;

        // Fetch Dispatch Order (Dates and Status)
        const dispatchOrders = await sql`
            SELECT * FROM dispatch_orders WHERE vehicle_id = ${vehicle.id} ORDER BY created_at DESC LIMIT 1
        `;
        const dispatchData = dispatchOrders.length > 0 ? dispatchOrders[0] : null;

        // Fetch Title Services Data
        const titleServices = await sql`
            SELECT * FROM vehicle_title_services WHERE vehicle_id = ${vehicle.id} ORDER BY created_at DESC LIMIT 1
        `;
        const titleData = titleServices.length > 0 ? titleServices[0] : null;

        // Fetch Ownership Documents
        const ownershipDocs = await sql`
            SELECT * FROM vehicle_ownership_documents 
            WHERE vin = ${vin} 
            ORDER BY uploaded_at DESC LIMIT 1
        `;
        if (ownershipDocs.length > 0) {
            vehicle.ownership_document_url = ownershipDocs[0].file_url;
        }

        // Fetch Master Title Tracking Data
        const titleTrackingRows = await sql`
            SELECT tl.*, st.name as mailing_location 
            FROM title_logs tl
            LEFT JOIN shippers_terminals st ON tl.mailing_terminal_id = st.id
            WHERE tl.vin = ${vin}
        `;
        if (titleTrackingRows.length > 0) {
            let row = titleTrackingRows[0];
            let computed = row.title_status || "Not Received";
            
            vehicle.title_tracking = {
                ...row,
                computed_status: computed
            };
        } else {
            vehicle.title_tracking = null;
        }

        // Fetch Purchase Fees Breakdown (same query as admin: type=FEE rows)
        const fees = await sql`
            SELECT * FROM invoice_line_items 
            WHERE vehicle_id = ${vehicle.id} 
            AND (type = 'FEE' OR description = 'Vehicle Purchase Price')
        `;

        // Fetch Operational Rules (client auction rules — same as admin)
        let operationalRules = null;
        if (vehicle.auction_id) {
            const rulesRows = await sql`
                SELECT * FROM client_auction_rules 
                WHERE client_id = ${vehicle.client_id} 
                AND LOWER(auction_provider) = LOWER(${vehicle.auction_name})
                LIMIT 1
            `;
            if (rulesRows.length > 0) operationalRules = rulesRows[0];
        }

        // Client commission comes directly from the vehicle record (same as admin)
        const clientCommission = parseFloat(vehicle.client_markup_fee || 0);

        const clientStatusQuery = await sql`SELECT status FROM auth_users WHERE id = ${clientId}`;
        const clientStatus = clientStatusQuery[0]?.status || 'active';

        return Response.json({
            vehicle,
            services: serviceDetails,
            invoices,
            dispatchData,
            titleData,
            fees: fees || [],
            operationalRules,
            clientCommission,
            clientStatus
        }, { status: 200 });

    } catch (error) {
        console.error(`GET /api/client/vehicles/${params.vin}/details error:`, error);
        return Response.json({
            error: "Failed to fetch vehicle details",
            details: error.message
        }, { status: 500 });
    }
}
