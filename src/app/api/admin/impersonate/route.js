import { auth } from "@/auth";

export const dynamic = "force-dynamic";

// DELETE: Exit impersonation
export async function DELETE(request) {
    try {
        const session = await auth();
        if (!session || !session.user?.id) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const isProduction = process.env.NODE_ENV === "production";
        const domainStr = isProduction ? "; Domain=.motorxcars.com" : "";

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: {
                "Content-Type": "application/json",
                "Set-Cookie": `motorx-impersonate=; Path=/${domainStr}; Max-Age=0; SameSite=Lax${isProduction ? "; Secure" : ""}`
            }
        });
    } catch (error) {
        console.error("DELETE /api/admin/impersonate error:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
}
