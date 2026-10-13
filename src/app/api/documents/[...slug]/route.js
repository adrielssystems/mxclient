import fs from 'fs/promises';
import path from 'path';
import { auth } from "@/auth";
import sql from "@/app/api/utils/sql";
import { driveService } from "@/utils/googleDriveService";

export const dynamic = 'force-dynamic';

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
    return finalDir;
}

export async function GET(request, { params }) {
    try {
        const session = await auth();
        if (!session || !session.user?.id) {
            return new Response("Unauthorized", { status: 401 });
        }

        const { slug } = params; // Can be string or array depending on runtime (Hono vs Next.js)
        
        // Security: Prevent directory traversal attacks
        // Normalize slug to always be an array of decoded segments
        const slugArray = Array.isArray(slug) 
            ? slug 
            : slug.split('/').filter(Boolean);
        
        const decodedSlug = slugArray.map(segment => decodeURIComponent(segment));
        const relativePath = path.join(...decodedSlug);
        
        if (relativePath.includes("..") || path.isAbsolute(relativePath)) {
            return new Response("Invalid path", { status: 400 });
        }

        // Determine storage directories - must match how ownership-documents/route.js saves files
        let PRIMARY_DIR;
        if (process.env.UPLOAD_DIR) {
            PRIMARY_DIR = process.env.UPLOAD_DIR;
        } else {
            try {
                await fs.access("/data");
                PRIMARY_DIR = "/data/documents";
            } catch {
                PRIMARY_DIR = path.join(process.cwd(), "uploads");
            }
        }
        const FALLBACK_DIR = path.join(process.cwd(), "uploads");

        let filePath = path.join(PRIMARY_DIR, relativePath);
        let fileBuffer;
        try {
            await fs.access(filePath);
            fileBuffer = await fs.readFile(filePath);
        } catch {
            filePath = path.join(FALLBACK_DIR, relativePath);
            console.log(`[Documents] Primary not found, trying fallback: ${filePath}`);
            try {
                await fs.access(filePath);
                fileBuffer = await fs.readFile(filePath);
            } catch {
                console.log(`[Documents] File not found locally: ${relativePath}. Attempting auto-recovery from Google Drive...`);
                const filename = path.basename(relativePath);

                let driveFileId = null;
                try {
                    const dbMatch = await sql`
                        SELECT drive_file_id FROM vehicle_ownership_documents 
                        WHERE filename = ${filename} OR file_url LIKE ${'%' + filename}
                        LIMIT 1
                    `;
                    if (dbMatch.length > 0 && dbMatch[0].drive_file_id) {
                        driveFileId = dbMatch[0].drive_file_id;
                    }
                } catch (dbErr) {
                    console.error("[Documents] DB lookup error:", dbErr.message);
                }

                if (!driveFileId) {
                    try {
                        const searchRes = await driveService.drive.files.list({
                            q: `name = '${filename}' and trashed = false`,
                            fields: "files(id, name)",
                        });
                        if (searchRes.data.files?.length > 0) {
                            driveFileId = searchRes.data.files[0].id;
                        }
                    } catch (driveErr) {
                        console.error("[Documents] Drive search error:", driveErr.message);
                    }
                }

                if (!driveFileId) {
                    console.error(`[Documents] File not found locally or in Google Drive: ${relativePath}`);
                    return new Response("File not found", { status: 404 });
                }

                try {
                    fileBuffer = await driveService.downloadFileBuffer(driveFileId);
                    const targetLocalPath = path.join(PRIMARY_DIR, relativePath);
                    await fs.mkdir(path.dirname(targetLocalPath), { recursive: true });
                    await fs.writeFile(targetLocalPath, fileBuffer).catch(() => {});
                    console.log(`[Documents] Successfully recovered from Drive and cached: ${targetLocalPath}`);
                } catch (dlErr) {
                    console.error("[Documents] Failed to download from Drive:", dlErr.message);
                    return new Response("File not found", { status: 404 });
                }
            }
        }

        const ext = path.extname(relativePath).toLowerCase();
        let contentType = "application/octet-stream";
        if (ext === ".pdf") {
            contentType = "application/pdf";
        } else if (ext === ".png") {
            contentType = "image/png";
        } else if (ext === ".jpg" || ext === ".jpeg") {
            contentType = "image/jpeg";
        } else if (ext === ".webp") {
            contentType = "image/webp";
        }

        return new Response(fileBuffer, {
            status: 200,
            headers: {
                "Content-Type": contentType,
                "Content-Length": fileBuffer.length.toString(),
                "Cache-Control": "private, max-age=86400",
                "Content-Disposition": "inline",
            },
        });
    } catch (error) {
        if (error.code === "ENOENT") {
            return new Response("File not found", { status: 404 });
        }
        console.error("GET /api/documents/[...slug] error:", error);
        return new Response("Internal Server Error", { status: 500 });
    }
}
