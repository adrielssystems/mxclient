import { auth } from "@/auth";
import fs from "fs/promises";
import path from "path";
import sql from "@/app/api/utils/sql";
import { driveService } from "@/utils/googleDriveService";
import { resolveClientId } from "@/app/api/utils/impersonate";

export const dynamic = "force-dynamic";

async function getStorageDir(vin = "") {
    let base = "";
    if (process.env.UPLOAD_DIR) {
        base = process.env.UPLOAD_DIR;
    } else {
        try {
            await fs.access("/data");
            base = "/data/documents";
        } catch {
            base = path.join(process.cwd(), "uploads");
        }
    }
    const finalDir = vin ? path.join(base, vin) : base;
    await fs.mkdir(finalDir, { recursive: true });
    return finalDir;
}

// GET: List all ownership documents for a vehicle
export async function GET(request, { params }) {
    try {
        const resolved = await resolveClientId(request);
        if (resolved.error) {
            return Response.json({ error: resolved.error }, { status: 401 });
        }

        const effectiveClientId = resolved.clientId;
        const { vin } = params;

        // Verify vehicle ownership/hierarchy access
        const vehicleCheck = await sql`
            SELECT client_id FROM vehicles WHERE vin = ${vin} AND master_status != 'cancelled'
        `;
        if (vehicleCheck.length === 0) {
            return Response.json({ error: "Vehicle not found" }, { status: 404 });
        }

        const vehicleOwnerId = vehicleCheck[0].client_id;
        if (vehicleOwnerId !== effectiveClientId) {
            const userCheck = await sql`SELECT is_main_client FROM auth_users WHERE id = ${effectiveClientId}`;
            let hasAccess = false;
            if (userCheck[0]?.is_main_client) {
                const subCheck = await sql`
                    SELECT 1 FROM client_hierarchy 
                    WHERE main_client_id = ${effectiveClientId} AND sub_client_id = ${vehicleOwnerId}
                `;
                if (subCheck.length > 0) hasAccess = true;
            }
            if (!hasAccess) {
                return Response.json({ error: "Forbidden: Access denied to this vehicle" }, { status: 403 });
            }
        }

        // --- Silent self-healing migration ---
        const columnExists = await sql`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'vehicle_ownership_documents' 
            AND column_name = 'drive_file_id';
        `;

        if (columnExists.length === 0) {
            await sql`ALTER TABLE vehicle_ownership_documents ADD COLUMN drive_file_id TEXT;`;
        }

        const docs = await sql`
            SELECT id, vin, tag, filename, file_url, drive_file_id, uploaded_at 
            FROM vehicle_ownership_documents 
            WHERE vin = ${vin}
            ORDER BY uploaded_at DESC
        `;

        // Enrich documents with Drive-specific links if they have a drive_file_id
        const enrichedDocs = docs.map(doc => {
            if (doc.drive_file_id) {
                return {
                    ...doc,
                    // Drive webViewLink is good for target="_blank"
                    // But for iframes we need /preview
                    preview_url: `https://drive.google.com/file/d/${doc.drive_file_id}/preview`,
                    download_url: `https://drive.google.com/uc?export=download&id=${doc.drive_file_id}`
                };
            }
            return {
                ...doc,
                preview_url: doc.file_url,
                download_url: doc.file_url
            };
        });

        return Response.json({ documents: enrichedDocs });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}

// POST: Upload a new ownership document
export async function POST(request, { params }) {
    try {
        const resolved = await resolveClientId(request);
        if (resolved.error) {
            return Response.json({ error: resolved.error }, { status: 401 });
        }

        const effectiveClientId = resolved.clientId;
        const { vin } = params;

        // Verify vehicle ownership/hierarchy access
        const vehicleCheck = await sql`
            SELECT client_id FROM vehicles WHERE vin = ${vin} AND master_status != 'cancelled'
        `;
        if (vehicleCheck.length === 0) {
            return Response.json({ error: "Vehicle not found" }, { status: 404 });
        }

        const vehicleOwnerId = vehicleCheck[0].client_id;
        if (vehicleOwnerId !== effectiveClientId) {
            const userCheck = await sql`SELECT is_main_client FROM auth_users WHERE id = ${effectiveClientId}`;
            let hasAccess = false;
            if (userCheck[0]?.is_main_client) {
                const subCheck = await sql`
                    SELECT 1 FROM client_hierarchy 
                    WHERE main_client_id = ${effectiveClientId} AND sub_client_id = ${vehicleOwnerId}
                `;
                if (subCheck.length > 0) hasAccess = true;
            }
            if (!hasAccess) {
                return Response.json({ error: "Forbidden: Access denied to this vehicle" }, { status: 403 });
            }
        }

        const body = await request.json();
        const { base64, tag } = body;

        if (!base64 || !tag) {
            return Response.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Parse base64 - handles cases with extra params like ;filename=...;base64
        const matches = base64.match(/^data:([^;]+).*?;base64,(.+)$/);
        if (!matches) {
            return Response.json({ error: "Invalid base64 format" }, { status: 400 });
        }

        const mimeType = matches[1];
        const fileData = Buffer.from(matches[2], "base64");

        if (!mimeType.startsWith('application/pdf')) {
            return Response.json({ error: "Only PDF documents are allowed" }, { status: 400 });
        }

        // User requested format: "VIN - Tag"
        const filename = `${vin} - ${tag}.pdf`; 

        let fileUrl = "";
        let driveFileId = null;

        try {
            // --- NEW: Google Drive Storage ---
            console.log(`[Upload] Attempting to save to Google Drive: ${filename}`);
            const driveResult = await driveService.uploadFileToVINPath(vin, filename, fileData, mimeType, 'Ownership');
            fileUrl = driveResult.webViewLink;
            driveFileId = driveResult.id;
            console.log(`[Drive] Saved successfully. ID: ${driveFileId}`);
        } catch (driveError) {
            console.error("[Drive Error] Falling back to local storage:", driveError.message);
            
            // --- Fallback: Local Storage ---
            const storageDir = await getStorageDir(vin);
            const filePath = path.join(storageDir, filename);
            await fs.writeFile(filePath, fileData);
            fileUrl = `/api/documents/${vin}/${filename}`;
        }

        // Save metadata to DB
        const result = await sql`
            INSERT INTO vehicle_ownership_documents (vin, tag, filename, file_url, drive_file_id, uploaded_by)
            VALUES (${vin}, ${tag}, ${filename}, ${fileUrl}, ${driveFileId}, ${session.user.id})
            RETURNING id
        `;

        return Response.json({ 
            success: true, 
            documentId: result[0].id,
            filename,
            fileUrl,
            storage: driveFileId ? 'google_drive' : 'local'
        }, { status: 201 });

    } catch (error) {
        console.error("POST ownership-documents error:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
}
