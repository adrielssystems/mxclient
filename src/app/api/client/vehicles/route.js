import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { resolveClientId } from "@/app/api/utils/impersonate";

export const dynamic = "force-dynamic";

export async function GET(request) {
    try {
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

        // 3. Extract the clean client ID we will use for querying

        // 4. Secure query isolated to this client
        // We select only non-operational fields to prevent exposing internal margins
        const vehicles = await sql`
            SELECT 
                v.id,
                v.vin,
                v.description,
                v.purchase_date,
                v.purchase_price,
                v.lot_number,
                v.auction_id,
                v.destination_id,
                v.current_status,
                v.payment_status,
                v.amount_paid,
                
                a.name as auction_name,
                d.country_name as destination_country,
                d.port_name as destination_port,
                u.name as buyer_name,
                
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
                  SELECT COALESCE(SUM(amount), 0) 
                  FROM invoice_line_items 
                  WHERE vehicle_id = v.id AND (type = 'PURCHASE' OR description ILIKE '%Purchase%')
                ) as client_base_price_from_items,

                (
                  SELECT COALESCE(SUM(amount), 0) 
                  FROM invoice_line_items 
                  WHERE vehicle_id = v.id AND type IN ('SERVICE', 'FEE') 
                  AND description NOT ILIKE '%Purchase%'
                ) as transport_fees_total

            FROM vehicles v
            LEFT JOIN auctions a ON v.auction_id = a.id
            LEFT JOIN destinations d ON v.destination_id = d.id
            LEFT JOIN auth_users u ON v.client_id = u.id
            WHERE v.client_id = ${clientId}
            ORDER BY v.created_at DESC
        `;

        // 5. Transform DB response to match UI expected props
        const mappedVehicles = vehicles.map(v => {
            let year = "", make = "", model = "";
            if (v.description) {
                // Strip anything inside parentheses (e.g. "(Gustavo Lopez PIN# 77609)")
                const cleanDesc = v.description.replace(/\s*\([^)]*\)\s*/g, '').trim();
                const parts = cleanDesc.split(" ");
                year = parts[0] || "N/A";
                make = parts[1] || "";
                model = parts.slice(2).join(" ") || "";
            }

            // Calculate Base Price
            let basePrice = Number(v.client_base_price_from_items || 0);
            if (basePrice === 0 && v.purchase_price) {
                basePrice = Number(v.purchase_price);
            }

            return {
                ...v,
                year,
                make,
                model,
                client_base_price: basePrice,
                transport_fees_total: Number(v.transport_fees_total || 0),
                client_total_price: v.total_due, // map the total due into the visual total price for the client widget
            };
        });

        const recentPayments = await sql`
            SELECT 
              pr.id, 
              pr.amount_received as amount, 
              pr.payment_reference as ref, 
              pr.reconciliation_date as date
            FROM payment_reconciliations pr
            JOIN invoices i ON pr.invoice_id = i.id
            WHERE i.client_id = ${clientId}
            ORDER BY pr.reconciliation_date DESC
            LIMIT 5
        `;

        const mappedPayments = recentPayments.map(p => {
            const dateObj = new Date(p.date);
            const formattedDate = !isNaN(dateObj) ? dateObj.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }) : 'N/A';
            const refStr = (p.ref || '').toUpperCase();
            let method = 'Wire Transfer';
            if (refStr.includes('ZELLE')) method = 'Zelle';
            else if (refStr.includes('CASH')) method = 'Cash';
            else if (refStr.includes('ACH')) method = 'ACH';
            
            return {
                id: p.id,
                amount: Number(p.amount),
                ref: p.ref || 'N/A',
                date: formattedDate,
                method
            };
        });

        return Response.json({ vehicles: mappedVehicles, recentPayments: mappedPayments }, { status: 200 });

    } catch (error) {
        console.error("GET /api/client/vehicles error:", error);
        return Response.json(
            {
                error: process.env.NODE_ENV === 'production'
                    ? "Failed to fetch vehicles"
                    : error.message
            },
            { status: 500 }
        );
    }
}

export async function POST(request) {
    try {
        const session = await auth();
        if (!session || !session.user?.id) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const clientId = session.user.id;
        let role = session.user.role;

        if (!role) {
            const userCheck = await sql`SELECT role FROM auth_users WHERE id = ${clientId}`;
            if (userCheck.length > 0) role = userCheck[0].role;
        }

        // Must be client or admin pseudo-testing
        if (role !== "client" && role !== "admin") {
            return Response.json({ error: "Forbidden: Client access only" }, { status: 403 });
        }

        const body = await request.json();
        const { vin, description, auction_id, purchase_document_url } = body;

        if (!vin) {
            return Response.json({ error: "VIN is required" }, { status: 400 });
        }

        // Check if VIN already exists to avoid duplicates
        const existing = await sql`SELECT id FROM vehicles WHERE vin = ${vin}`;
        if (existing.length > 0) {
            return Response.json({ error: "Vehicle with this VIN already exists" }, { status: 400 });
        }

        const result = await sql`
            INSERT INTO vehicles (
                vin, 
                description, 
                auction_id, 
                purchase_document_url, 
                client_id, 
                master_status, 
                purchase_status
            ) VALUES (
                ${vin}, 
                ${description || ''}, 
                ${auction_id || null}, 
                ${purchase_document_url || null}, 
                ${clientId}, 
                'purchased', 
                'payment_pending'
            ) RETURNING id
        `;

        return Response.json({ success: true, vehicleId: result[0].id }, { status: 201 });

    } catch (error) {
        console.error("POST /api/client/vehicles error:", error);
        return Response.json(
            { error: process.env.NODE_ENV === 'production' ? "Failed to report purchase" : error.message },
            { status: 500 }
        );
    }
}
