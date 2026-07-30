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
                TO_CHAR(COALESCE(v.purchase_date, i.created_at), 'YYYY-MM') as month,
                COALESCE(SUM(i.amount), 0) as total
            FROM invoices i
            LEFT JOIN vehicles v ON i.vehicle_id = v.id
            WHERE (i.client_id = ${clientId}
               OR i.client_id IN (SELECT sub_client_id FROM client_hierarchy WHERE main_client_id = ${clientId}))
              AND COALESCE(v.purchase_date, i.created_at) >= NOW() - INTERVAL '12 months'
            GROUP BY TO_CHAR(COALESCE(v.purchase_date, i.created_at), 'YYYY-MM')
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
                v.purchase_status,
                v.payment_status,
                a.name as auction_name,
                v.lot_number,
                d.country_name as destination_country,
                d.port_name as destination_port,
                u.name as buyer_name,
                -- Amount Paid from payment_reconciliations
                COALESCE((
                    SELECT SUM(pr2.amount_received)
                    FROM payment_reconciliations pr2
                    JOIN invoices i2 ON pr2.invoice_id = i2.id
                    WHERE i2.vehicle_id = v.id
                ), 0) as amount_paid,
                -- Title Log Status (from title_logs)
                CASE
                  WHEN tl.vin IS NULL THEN NULL
                  WHEN tl.date_received IS NOT NULL THEN 'Received'
                  WHEN tl.date_mailed IS NOT NULL THEN 'Mailed'
                  ELSE NULL
                END as title_log_status,
                CASE
                  WHEN v.dispatch_status = 'not_applicable' THEN NULL
                  WHEN ld.vehicle_id IS NULL THEN 'Pending'
                  WHEN (
                    ld.actual_delivery_date IS NOT NULL
                    AND ld.transporter_payment_date IS NOT NULL
                  ) THEN 'Completed'
                  WHEN ld.actual_delivery_date IS NOT NULL THEN 'INVOICE'
                  WHEN ld.estimated_delivery_date::date < CURRENT_DATE THEN 'Late'
                  WHEN ld.estimated_delivery_date::date = CURRENT_DATE THEN 'Today'
                  WHEN (ld.actual_pickup_date IS NOT NULL OR ld.picked_up = TRUE) THEN 'In Transit'
                  ELSE 'New'
                END as dispatch_display_status,
                CASE
                  WHEN lt.ts_id IS NULL THEN NULL
                  WHEN lt.ts_manual_status = 'Canceled' THEN 'Canceled'
                  WHEN (lt.ts_manual_status IS NOT NULL AND lt.ts_manual_status != 'none') THEN lt.ts_manual_status
                  WHEN (
                    (lt.ts_date_mailed_out IS NOT NULL OR (lt.ts_mailing_out_tracking IS NOT NULL AND lt.ts_mailing_out_tracking != ''))
                    AND (lt.ts_invoice_number IS NOT NULL AND lt.ts_invoice_number != '')
                    AND lt.ts_invoice_payment_status = 'paid'
                  ) THEN 'Completed'
                  WHEN (lt.ts_date_mailed_out IS NOT NULL OR (lt.ts_mailing_out_tracking IS NOT NULL AND lt.ts_mailing_out_tracking != '')) THEN 'NOT PAID'
                  WHEN (lt.ts_date_received IS NOT NULL AND (lt.ts_invoice_number IS NULL OR lt.ts_invoice_number = '')) THEN 'INVOICE'
                  WHEN lt.ts_date_received IS NOT NULL THEN 'Received'
                  WHEN (lt.ts_date_mailing_in IS NOT NULL OR (lt.ts_mailing_in_tracking IS NOT NULL AND lt.ts_mailing_in_tracking != '')) THEN 'Mailing IN'
                  WHEN lt.ts_date_approved IS NOT NULL THEN 'Approved'
                  WHEN lt.ts_date_requested IS NOT NULL THEN 'Requested'
                  ELSE 'New'
                END as title_service_status
            FROM vehicles v
            LEFT JOIN auctions a ON v.auction_id = a.id
            LEFT JOIN destinations d ON v.destination_id = d.id
            LEFT JOIN auth_users u ON v.client_id = u.id
            LEFT JOIN title_logs tl ON tl.vin = v.vin
            LEFT JOIN (
              SELECT DISTINCT ON (vehicle_id)
                vehicle_id,
                actual_delivery_date,
                transporter_payment_date,
                actual_pickup_date,
                picked_up,
                estimated_delivery_date
              FROM dispatch_orders
              ORDER BY vehicle_id, created_at DESC
            ) ld ON ld.vehicle_id = v.id
            LEFT JOIN (
              SELECT DISTINCT ON (vts.vehicle_id)
                vts.vehicle_id,
                vts.id as ts_id,
                vts.manual_status as ts_manual_status,
                vts.date_requested as ts_date_requested,
                vts.date_approved as ts_date_approved,
                vts.date_mailing_in as ts_date_mailing_in,
                vts.mailing_in_tracking as ts_mailing_in_tracking,
                vts.date_received as ts_date_received,
                vts.date_mailed_out as ts_date_mailed_out,
                vts.mailing_out_tracking as ts_mailing_out_tracking,
                vts.invoice_number as ts_invoice_number,
                i.status as ts_invoice_payment_status
              FROM vehicle_title_services vts
              LEFT JOIN invoices i ON i.vehicle_id = vts.vehicle_id 
                AND i.service_category = 'TITLE' 
                AND (vts.invoice_number IS NOT NULL AND i.invoice_number = vts.invoice_number)
              ORDER BY vts.vehicle_id, vts.created_at DESC
            ) lt ON lt.vehicle_id = v.id
            WHERE v.client_id = ${clientId}
               OR v.client_id IN (SELECT sub_client_id FROM client_hierarchy WHERE main_client_id = ${clientId})
            ORDER BY COALESCE(v.purchase_date, v.created_at) DESC
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
