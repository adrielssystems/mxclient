
import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

export async function POST(request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Update last activity timestamp
        await sql`
            UPDATE auth_users 
            SET last_activity = NOW() 
            WHERE id = ${session.user.id}
        `;

        return Response.json({ success: true });
    } catch (error) {
        console.error("Heartbeat error:", error);
        return Response.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
