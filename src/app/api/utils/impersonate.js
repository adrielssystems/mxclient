import { auth } from "@/auth";
import sql from "@/app/api/utils/sql";

/**
 * Resolves the effective client ID for API requests.
 * If an admin is impersonating a client (cookie exists), returns the impersonated client's ID.
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

            // Verify the real user is an admin
            const userRows = await sql`SELECT role FROM auth_users WHERE id = ${session.user.id}`;
            if (userRows[0]?.role === "admin") {
                return {
                    clientId: data.clientId,
                    isImpersonating: true,
                    adminId: session.user.id,
                    clientName: data.clientName
                };
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
