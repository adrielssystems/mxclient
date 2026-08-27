import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    let userRole = session.user.role;
    if (!userRole) {
        const userRows = await sql`SELECT role FROM auth_users WHERE id = ${session.user.id}`;
        userRole = userRows[0]?.role;
    }

    let terminals;
    if (userRole === 'admin' || userRole === 'employee') {
        terminals = await sql`
          SELECT * FROM shippers_terminals 
          ORDER BY name ASC
        `;
    } else {
        // Show terminals that are NOT explicitly 'private' or 'inactive'.
        // Using LOWER() for case-insensitive comparison to handle any casing (e.g., 'Private', 'INACTIVE').
        terminals = await sql`
          SELECT * FROM shippers_terminals 
          WHERE visibility IS DISTINCT FROM 'private' 
            AND visibility IS DISTINCT FROM 'Private' 
            AND visibility IS DISTINCT FROM 'inactive' 
            AND visibility IS DISTINCT FROM 'Inactive'
          ORDER BY name ASC
        `;
        console.log("CLIENT TERMINALS FETCHED:", terminals?.length);
    }

    return Response.json({ terminals });
  } catch (error) {
    console.error("GET /api/admin/terminals error:", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
