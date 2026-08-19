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

        // Try primary storage path first, then fallback
        const STORAGE_DIR = process.env.UPLOAD_DIR || "/data/documents";
        const FALLBACK_DIR = path.join(process.cwd(), "uploads");

        let filePath = path.join(STORAGE_DIR, relativePath);
        try {
            await fs.access(filePath);
        } catch {
            filePath = path.join(FALLBACK_DIR, relativePath);
            await fs.access(filePath);
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
