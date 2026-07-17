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

        // Verify the client actually owns this vehicle
        const vehicles = await sql`
            SELECT id FROM vehicles 
            WHERE vin = ${vin} AND (client_id = ${clientId} OR client_id IN (SELECT sub_client_id FROM client_hierarchy WHERE main_client_id = ${clientId}))
        `;
        
        if (vehicles.length === 0) {
            return Response.json({ error: "Vehicle not found or unauthorized" }, { status: 404 });
        }

        const docs = await sql`
            SELECT id, vin, tag, filename, file_url, drive_file_id, uploaded_at 
            FROM vehicle_ownership_documents 
            WHERE vin = ${vin}
            ORDER BY uploaded_at DESC
        `;

        const mappedDocs = docs.map(doc => {
            let finalUrl = doc.file_url;
            if (doc.drive_file_id) {
                // We use webViewLink so they can view it in the browser if they prefer, or download it
                finalUrl = `https://drive.google.com/file/d/${doc.drive_file_id}/view`;
            }
            
            return {
                id: doc.id,
                doc_type: doc.tag,
                file_name: doc.filename,
                file_url: finalUrl
            };
        });

        return Response.json({ documents: mappedDocs });
    } catch (error) {
        console.error("Error fetching documents:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
}
