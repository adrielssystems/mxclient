import { auth } from "@/auth";
import sql from "@/app/api/utils/sql";
import crypto from "crypto";

/**
 * Resolves the effective client ID for API requests.
 * If an admin is impersonating a client (cookie exists & signature matches), returns the impersonated client's ID.
 * Otherwise returns the authenticated user's own ID.
 * 
 * @param {Request} request - The incoming HTTP request (to read cookies from headers)
 * @returns {{ clientId: string, isImpersonating: boolean, adminId: string|null }}
 */
export async function resolveClientId(request) {
    // 1. Verificar primero si existe una cookie de personificación válida
    const cookieHeader = request?.headers?.get?.("cookie") || "";
    const cookies = Object.fromEntries(
        cookieHeader.split(";").map(c => {
            const [key, ...val] = c.trim().split("=");
            return [key, val.join("=")];
        })
    );

    const impersonateCookie = cookies["motorx-impersonate"];

    if (impersonateCookie) {
        try {
            const data = JSON.parse(decodeURIComponent(impersonateCookie));
            const { payload, signature } = data;

            if (payload && signature && payload.adminId) {
                const payloadStr = JSON.stringify(payload);
                const secret = process.env.IMPERSONATION_SIGNING_KEY || "fallback-secret-key-123456";
                const expectedSignature = crypto.createHmac("sha256", secret).update(payloadStr).digest("hex");

                if (signature === expectedSignature) {
                    const userRows = await sql`SELECT role FROM auth_users WHERE id = ${payload.adminId}`;
                    if (userRows[0]?.role === "admin") {
                        return {
                            clientId: payload.clientId,
                            isImpersonating: true,
                            adminId: payload.adminId,
                            clientName: payload.clientName
                        };
                    }
                } else {
                    console.warn("[Security Alert] Impersonation cookie signature verification failed (tampered cookie).");
                }
            } else if (data.clientId && data.adminId) {
                // Soporte legacy / desarrollo sin firma
                const userRows = await sql`SELECT role FROM auth_users WHERE id = ${data.adminId}`;
                if (userRows[0]?.role === "admin") {
                    return {
                        clientId: data.clientId,
                        isImpersonating: true,
                        adminId: data.adminId,
                        clientName: data.clientName
                    };
                }
            }
        } catch (e) {
            console.error("Invalid impersonation cookie:", e);
        }
    }

    // 2. Si no hay personificación, autenticar vía sesión estándar de NextAuth
    const session = await auth();
    if (!session || !session.user?.id) {
        return { clientId: null, isImpersonating: false, adminId: null, error: "Unauthorized" };
    }

    return {
        clientId: session.user.id,
        isImpersonating: false,
        adminId: null
    };
}
