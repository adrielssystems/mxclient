import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const destinations = await sql`
      SELECT * FROM destinations 
      ORDER BY country_name ASC
    `;

    return Response.json({ destinations });
  } catch (error) {
    console.error("GET /api/admin/destinations error:", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
