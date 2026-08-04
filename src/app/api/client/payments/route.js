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
                return Response.json({ error: "Forbidden: Client access only" }, { status: 403 });
            }
        }

        // Fetch Invoices
        const invoices = await sql`
            SELECT 
                i.id,
                i.invoice_number,
                i.quickbooks_invoice_id,
                i.amount,
                i.status,
                i.created_at,
                v.vin,
                v.lot_number,
                u.name as client_name,
                REGEXP_REPLACE(v.description, '\\s*\\([^\\)]+\\)', '', 'g') as vehicle_desc
            FROM invoices i
            LEFT JOIN vehicles v ON i.vehicle_id = v.id
            LEFT JOIN auth_users u ON i.client_id = u.id
            WHERE (i.client_id = ${clientId} OR i.client_id IN (SELECT sub_client_id FROM client_hierarchy WHERE main_client_id = ${clientId}))
            ORDER BY i.created_at DESC
        `;

        // Fetch Payments
        const payments = await sql`
            SELECT 
                MIN(pr.id) as id,
                SUM(pr.amount_received) as amount,
                COALESCE(pr.payment_reference, 'N/A') as ref,
                pr.reconciliation_date::date as date,
                CASE 
                    WHEN COUNT(DISTINCT i.invoice_number) > 1 THEN 'Multiple Invoices'
                    ELSE MIN(i.invoice_number::text)
                END as invoice_number,
                MIN(i.quickbooks_invoice_id) as quickbooks_invoice_id
            FROM payment_reconciliations pr
            JOIN invoices i ON pr.invoice_id = i.id
            WHERE (i.client_id = ${clientId} OR i.client_id IN (SELECT sub_client_id FROM client_hierarchy WHERE main_client_id = ${clientId}))
            GROUP BY pr.reconciliation_date::date, COALESCE(pr.payment_reference, 'N/A')
            ORDER BY pr.reconciliation_date::date DESC
        `;

        return Response.json({ invoices, payments }, { status: 200 });
    } catch (err) {
        console.error("GET /api/client/payments error:", err);
        return Response.json({ error: "Failed to fetch financial data" }, { status: 500 });
    }
}
