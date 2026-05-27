import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const auctions = await sql`
      SELECT * FROM auctions 
      ORDER BY name ASC
    `;

    return Response.json({ auctions });
  } catch (error) {
    console.error("GET /api/admin/auctions error:", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
