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
    const session = await auth();
    if (!session || !session.user?.id) {
        return { clientId: null, isImpersonating: false, adminId: null, error: "Unauthorized" };
    }

    // Parse cookies from the request Cookie header
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

            if (payload && signature) {
                // Verify signature using shared secret key
                const payloadStr = JSON.stringify(payload);
                const secret = process.env.IMPERSONATION_SIGNING_KEY || "fallback-secret-key-123456";
                const expectedSignature = crypto.createHmac("sha256", secret).update(payloadStr).digest("hex");

                if (signature === expectedSignature) {
                    // Verify the real user is an admin in DB
                    const userRows = await sql`SELECT role FROM auth_users WHERE id = ${session.user.id}`;
                    if (userRows[0]?.role === "admin" && payload.adminId === session.user.id) {
                        return {
                            clientId: payload.clientId,
                            isImpersonating: true,
                            adminId: session.user.id,
                            clientName: payload.clientName
                        };
                    }
                } else {
                    console.warn("[Security Alert] Impersonation cookie signature verification failed (tampered cookie).");
                }
            } else {
                // Legacy unsigned format compatibility fallback
                const legacyData = data;
                const userRows = await sql`SELECT role FROM auth_users WHERE id = ${session.user.id}`;
                if (userRows[0]?.role === "admin" && legacyData.adminId === session.user.id) {
                    return {
                        clientId: legacyData.clientId,
                        isImpersonating: true,
                        adminId: session.user.id,
                        clientName: legacyData.clientName
                    };
                }
            }
        } catch (e) {
            console.error("Invalid impersonation cookie:", e);
        }
    }

    return {
        clientId: session.user.id,
        isImpersonating: false,
        adminId: null
    };
}
