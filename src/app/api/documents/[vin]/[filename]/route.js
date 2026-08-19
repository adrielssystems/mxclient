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

        const { vin, filename } = params;

        // Decodificar el nombre del archivo en caso de que contenga %20 (espacios) u otros caracteres especiales
        const decodedFilename = decodeURIComponent(filename);

        const storageDir = await getStorageDir(vin);
        const filePath = path.join(storageDir, decodedFilename);

        try {
            await fs.access(filePath);
        } catch {
            return new Response("File not found", { status: 404 });
        }

        const fileBuffer = await fs.readFile(filePath);

        // Determinar el Content-Type basado en la extensión
        let contentType = "application/octet-stream";
        if (decodedFilename.endsWith(".pdf")) {
            contentType = "application/pdf";
        } else if (decodedFilename.endsWith(".png")) {
            contentType = "image/png";
        } else if (decodedFilename.endsWith(".jpg") || decodedFilename.endsWith(".jpeg")) {
            contentType = "image/jpeg";
        }

        return new Response(fileBuffer, {
            headers: {
                "Content-Type": contentType,
                // Si quieres que el navegador lo muestre en lugar de forzar descarga, usa "inline" en lugar de "attachment"
                "Content-Disposition": `inline; filename="${decodedFilename}"`,
            },
        });
    } catch (error) {
        console.error("Error serving document:", error);
        return new Response("Internal Server Error", { status: 500 });
    }
}
