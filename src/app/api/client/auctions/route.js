import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export async function GET(request) {
    try {
        const session = await auth();
        if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
        const auctions = await sql`SELECT id, name FROM auctions ORDER BY name ASC`;
        return Response.json({ auctions });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}
