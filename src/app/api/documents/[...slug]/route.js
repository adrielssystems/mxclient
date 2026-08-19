import fs from 'fs/promises';
import path from 'path';
import { auth } from "@/auth";

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
        console.log(`[Documents] Attempting path: ${filePath}`);
        try {
            await fs.access(filePath);
        } catch {
            filePath = path.join(FALLBACK_DIR, relativePath);
            console.log(`[Documents] Primary not found, trying fallback: ${filePath}`);
            try {
                await fs.access(filePath);
            } catch {
                console.error(`[Documents] File not found in either location. Primary: ${path.join(PRIMARY_DIR, relativePath)}, Fallback: ${path.join(FALLBACK_DIR, relativePath)}`);
                return new Response("File not found", { status: 404 });
            }
        }

        const fileBuffer = await fs.readFile(filePath);

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
