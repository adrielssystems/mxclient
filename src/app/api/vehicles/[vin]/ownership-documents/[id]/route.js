import { auth } from "@/auth";
import fs from "fs/promises";
import path from "path";
import sql from "@/app/api/utils/sql";
import { driveService } from "@/utils/googleDriveService";

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
    return vin ? path.join(base, vin) : base;
}

export async function DELETE(request, { params }) {
    try {
        const session = await auth();
        if (!session || session.user?.role !== 'admin') {
            return Response.json({ error: "Unauthorized. Admin role required." }, { status: 403 });
        }

        const { vin, id } = params;

        // 1. Get the document metadata to find the filename and drive_file_id
        const doc = await sql`
            SELECT filename, drive_file_id FROM vehicle_ownership_documents 
            WHERE id = ${id} AND vin = ${vin}
        `;

        if (doc.length === 0) {
            return Response.json({ error: "Document not found" }, { status: 404 });
        }

        const { filename, drive_file_id } = doc[0];

        // 2. Delete from DB
        await sql`
            DELETE FROM vehicle_ownership_documents 
            WHERE id = ${id} AND vin = ${vin}
        `;

        // 3. Delete physical file (Drive or Local)
        try {
            if (drive_file_id) {
                console.log(`[Delete] Deleting from Google Drive: ${drive_file_id}`);
                await driveService.drive.files.delete({ fileId: drive_file_id });
            } else {
                // Fallback: Delete local file
                const storageDir = await getStorageDir(vin);
                const filePath = path.join(storageDir, filename);
                
                try {
                    await fs.access(filePath);
                    await fs.unlink(filePath);
                } catch {
                    const rootDir = await getStorageDir("");
                    const legacyPath = path.join(rootDir, filename);
                    await fs.unlink(legacyPath);
                }
            }
        } catch (fileError) {
            console.error("Could not delete physical file:", fileError.message);
        }

        return Response.json({ success: true, message: "Document deleted successfully" });

    } catch (error) {
        console.error("DELETE ownership-documents error:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
}
