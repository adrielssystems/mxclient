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
            if (role !== "client" && role !== "admin") {
                return Response.json({ error: "Forbidden: Client access only" }, { status: 403 });
            }
        }

        // Fetch Invoices
        const invoices = await sql`
            SELECT 
                i.id,
                i.invoice_number,
                i.amount,
                i.status,
                i.created_at,
                v.vin,
                v.description as vehicle_desc
            FROM invoices i
            LEFT JOIN vehicles v ON i.vehicle_id = v.id
            WHERE i.client_id = ${clientId}
            ORDER BY i.created_at DESC
        `;

        // Fetch Payments
        const payments = await sql`
            SELECT 
                pr.id,
                pr.amount_received as amount,
                pr.payment_reference as ref,
                pr.reconciliation_date as date,
                i.invoice_number
            FROM payment_reconciliations pr
            JOIN invoices i ON pr.invoice_id = i.id
            WHERE i.client_id = ${clientId}
            ORDER BY pr.reconciliation_date DESC
        `;

        return Response.json({ invoices, payments }, { status: 200 });
    } catch (err) {
        console.error("GET /api/client/payments error:", err);
        return Response.json({ error: "Failed to fetch financial data" }, { status: 500 });
    }
}
