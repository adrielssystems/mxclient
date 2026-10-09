import sql from "@/app/api/utils/sql";
import { resolveClientId } from "@/app/api/utils/impersonate";

// Get current user profile with role information
export async function GET(request) {
  try {
    const resolved = await resolveClientId(request);
    if (!resolved.clientId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = resolved.clientId;
    const isImpersonatingClient = resolved.isImpersonating || false;

    // Get user with role and hierarchy information
    const userRows = await sql`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.role,
        u.is_main_client,
        u.main_client_id,
        u.allowed_sections,
        COALESCE(u.can_access_auctions, false) as can_access_auctions,
        main.name as main_client_name
      FROM auth_users u
      LEFT JOIN auth_users main ON u.main_client_id = main.id
      WHERE u.id = ${userId}
      LIMIT 1
    `;

    if (userRows.length === 0) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const user = userRows[0];

    // If this is a main client, get their sub-clients
    let subClients = [];
    if (user.is_main_client) {
      subClients = await sql`
        SELECT 
          u.id,
          u.name,
          u.email
        FROM auth_users u
        INNER JOIN client_hierarchy ch ON u.id = ch.sub_client_id
        WHERE ch.main_client_id = ${userId}
        ORDER BY u.name
      `;
    }

    return Response.json({
      user: {
        ...user,
        sub_clients: subClients,
        isImpersonatingClient,
      },
    });
  } catch (error) {
    console.error("GET /api/user/profile error:", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Update user profile
export async function PUT(request) {
  try {
    const resolved = await resolveClientId(request);
    if (!resolved.clientId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = resolved.clientId;
    const body = await request.json();

    // Only allow updating certain fields
    const allowedFields = ["name"];
    const setClauses = [];
    const values = [];
    let paramCount = 0;

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        paramCount++;
        setClauses.push(`${field} = $${paramCount}`);
        values.push(body[field]);
      }
    }

    if (setClauses.length === 0) {
      return Response.json(
        { error: "No valid fields to update" },
        { status: 400 },
      );
    }

    // Add WHERE clause
    paramCount++;
    values.push(userId);

    const updateQuery = `
      UPDATE auth_users 
      SET ${setClauses.join(", ")} 
      WHERE id = $${paramCount}
      RETURNING id, name, email, role, is_main_client, main_client_id
    `;

    const updatedUser = await sql.unsafe(updateQuery, values);

    return Response.json({ user: updatedUser[0] });
  } catch (error) {
    console.error("PUT /api/user/profile error:", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
