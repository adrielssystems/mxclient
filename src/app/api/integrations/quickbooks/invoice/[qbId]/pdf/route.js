import { auth } from "@/auth";
import { getValidTokens, getQuickBooksBaseUrl } from "@/app/api/integrations/quickbooks/quickbooksUtils";
import sql from "@/app/api/utils/sql";
import { resolveClientId } from "@/app/api/utils/impersonate";

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
    try {
        const resolved = await resolveClientId(request);

        if (resolved.error) {
            return new Response(JSON.stringify({ error: resolved.error }), { status: 401 });
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
                return new Response(JSON.stringify({ error: "Forbidden: Client access only" }), { status: 403 });
            }
        }

        const { qbId } = params;
        if (!qbId) {
            return new Response(JSON.stringify({ error: "Missing QuickBooks invoice ID" }), { status: 400 });
        }

        // Security check: Verify that this invoice belongs to this client
        const invoiceCheck = await sql`SELECT id FROM invoices WHERE quickbooks_invoice_id = ${qbId} AND client_id = ${clientId}`;
        if (invoiceCheck.length === 0) {
            return new Response(JSON.stringify({ error: "Invoice not found or unauthorized" }), { status: 404 });
        }

        const { accessToken, realmId } = await getValidTokens();
        const baseUrl = getQuickBooksBaseUrl();

        const qbResponse = await fetch(
            `${baseUrl}/v3/company/${realmId}/invoice/${qbId}/pdf?minorversion=65`,
            {
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                    "Accept": "application/pdf"
                }
            }
        );

        if (!qbResponse.ok) {
            const errText = await qbResponse.text();
            console.error("[QB Invoice PDF Error]", qbResponse.status, errText);
            return new Response(JSON.stringify({ error: "Failed to fetch PDF from QuickBooks" }), { status: qbResponse.status });
        }

        // Stream PDF back to the client
        const pdfBuffer = await qbResponse.arrayBuffer();

        return new Response(pdfBuffer, {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `inline; filename="invoice-${qbId}.pdf"`,
                "Cache-Control": "no-store"
            }
        });

    } catch (error) {
        console.error("[GET QB Invoice PDF error]", error);
        return new Response(JSON.stringify({ error: "Failed to load PDF" }), { status: 500 });
    }
}
