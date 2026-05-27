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

        if (!isImpersonating) {
            const session = await auth();
            let role = session?.user?.role;
            if (!role) {
                const userCheck = await sql`SELECT role FROM auth_users WHERE id = ${clientId}`;
                if (userCheck.length > 0) role = userCheck[0].role;
            }
            if (role !== "client" && role !== "main_client" && role !== "sub_client" && role !== "admin") {
                return Response.json({ error: "Forbidden" }, { status: 403 });
            }
        }

        // Check if user is a main_client to include sub_client vehicles
        const userInfo = await sql`SELECT role, name FROM auth_users WHERE id = ${clientId}`;
        const isMainClient = userInfo[0]?.role === "main_client";

        // --- KPI Queries ---

        // Total Vehicles (own + sub_clients if main)
        const totalVehiclesResult = await sql`
            SELECT COUNT(*) as count FROM vehicles
            WHERE client_id = ${clientId}
               OR client_id IN (SELECT sub_client_id FROM client_hierarchy WHERE main_client_id = ${clientId})
        `;

        // Active In Transit (not delivered/canceled)
        const activeResult = await sql`
            SELECT COUNT(*) as count FROM vehicles
            WHERE (client_id = ${clientId} 
               OR client_id IN (SELECT sub_client_id FROM client_hierarchy WHERE main_client_id = ${clientId}))
              AND current_status NOT IN ('delivered', 'canceled')
        `;

        // Total Invoiced
        const invoicedResult = await sql`
            SELECT COALESCE(SUM(i.amount), 0) as total FROM invoices i
            WHERE i.client_id = ${clientId}
               OR i.client_id IN (SELECT sub_client_id FROM client_hierarchy WHERE main_client_id = ${clientId})
        `;

        // Total Paid
        const paidResult = await sql`
            SELECT COALESCE(SUM(pr.amount_received), 0) as total 
            FROM payment_reconciliations pr
            JOIN invoices i ON pr.invoice_id = i.id
            WHERE i.client_id = ${clientId}
               OR i.client_id IN (SELECT sub_client_id FROM client_hierarchy WHERE main_client_id = ${clientId})
        `;

        const totalInvoiced = Number(invoicedResult[0]?.total || 0);
        const totalPaid = Number(paidResult[0]?.total || 0);

        const kpis = {
            totalVehicles: Number(totalVehiclesResult[0]?.count || 0),
            activeInTransit: Number(activeResult[0]?.count || 0),
            totalInvoiced,
            totalPaid,
            outstandingBalance: totalInvoiced - totalPaid
        };

        // --- Monthly Spending (last 12 months) ---
        const monthlySpending = await sql`
            SELECT 
                TO_CHAR(i.created_at, 'YYYY-MM') as month,
                COALESCE(SUM(i.amount), 0) as total
            FROM invoices i
            WHERE (i.client_id = ${clientId}
               OR i.client_id IN (SELECT sub_client_id FROM client_hierarchy WHERE main_client_id = ${clientId}))
              AND i.created_at >= NOW() - INTERVAL '12 months'
            GROUP BY TO_CHAR(i.created_at, 'YYYY-MM')
            ORDER BY month ASC
        `;

        // --- Vehicle Status Distribution ---
        const statusDistribution = await sql`
            SELECT 
                current_status as status,
                COUNT(*) as count
            FROM vehicles
            WHERE client_id = ${clientId}
               OR client_id IN (SELECT sub_client_id FROM client_hierarchy WHERE main_client_id = ${clientId})
            GROUP BY current_status
            ORDER BY count DESC
        `;

        // --- Vehicle History Table ---
        const vehicleHistory = await sql`
            SELECT 
                v.vin,
                v.description,
                v.purchase_date,
                v.current_status,
                v.purchase_price,
                a.name as auction_name,
                d.country_name as destination_country,
                d.port_name as destination_port,
                u.name as buyer_name
            FROM vehicles v
            LEFT JOIN auctions a ON v.auction_id = a.id
            LEFT JOIN destinations d ON v.destination_id = d.id
            LEFT JOIN auth_users u ON v.client_id = u.id
            WHERE v.client_id = ${clientId}
               OR v.client_id IN (SELECT sub_client_id FROM client_hierarchy WHERE main_client_id = ${clientId})
            ORDER BY v.created_at DESC
        `;

        return Response.json({
            kpis,
            monthlySpending,
            statusDistribution,
            vehicleHistory,
            isMainClient,
            clientName: userInfo[0]?.name
        });

    } catch (err) {
        console.error("GET /api/client/reports error:", err);
        return Response.json({ error: "Failed to fetch reports data" }, { status: 500 });
    }
}
