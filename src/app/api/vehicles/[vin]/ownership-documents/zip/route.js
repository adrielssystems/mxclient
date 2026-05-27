import { auth } from "@/auth";
import fs from "fs/promises";
import path from "path";
import sql from "@/app/api/utils/sql";
import archiver from "archiver";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
    try {
        const session = await auth();
        if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

        const { vin } = params;

        const docs = await sql`
            SELECT id, vin, tag, filename, file_url 
            FROM vehicle_ownership_documents 
            WHERE vin = ${vin}
        `;

        if (!docs || docs.length === 0) {
            return new Response("No documents found", { status: 404 });
        }

        const STORAGE_DIR = process.env.UPLOAD_DIR || "/data/documents";
        const FALLBACK_DIR = path.join(process.cwd(), "uploads");

        // We use a stream for Next.js response
        const { ReadableStream } = globalThis;
        const stream = new ReadableStream({
            start(controller) {
                const archive = archiver('zip', {
                    zlib: { level: 9 } // Sets the compression level.
                });

                archive.on('data', chunk => controller.enqueue(chunk));
                archive.on('end', () => controller.close());
                archive.on('error', err => controller.error(err));

                // Process files
                const processFiles = async () => {
                    for (const doc of docs) {
                        const relativePath = path.join(vin, doc.filename);
                        
                        let filePath = path.join(STORAGE_DIR, relativePath);
                        let exists = false;
                        
                        try {
                            await fs.access(filePath);
                            exists = true;
                        } catch {
                            filePath = path.join(FALLBACK_DIR, relativePath);
                            try {
                                await fs.access(filePath);
                                exists = true;
                            } catch {
                                // file really doesn't exist
                            }
                        }

                        if (exists) {
                            archive.file(filePath, { name: doc.filename });
                        }
                    }
                    archive.finalize();
                };

                processFiles().catch(err => {
                    console.error("Archive error:", err);
                    controller.error(err);
                });
            }
        });

        return new Response(stream, {
            headers: {
                "Content-Type": "application/zip",
                "Content-Disposition": `attachment; filename="Ownership_Documents_${vin}.zip"`,
            }
        });

    } catch (error) {
        console.error("ZIP Generation Error:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
}
