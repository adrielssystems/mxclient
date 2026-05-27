import sql from "@/app/api/utils/sql";
// import { parseMDY } from "@/utils/dateUtils";
import { auth } from "@/auth";
import { logAudit, getRequestInfo, AUDIT_ACTIONS, RESOURCE_TYPES } from "@/utils/auditLogger";

export async function GET(request) {
  try {
    const session = await auth();

    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check user role
    const userRows =
      await sql`SELECT role FROM auth_users WHERE id = ${session.user.id}`;

    if (!userRows[0]) {
      return Response.json(
        { error: "Forbidden - Authorized access required" },
        { status: 403 },
      );
    }

    // Read locations
    const { searchParams } = new URL(request.url);
    const auction_id = searchParams.get('auction_id');
    let locations;

    if (auction_id) {
      locations = await sql`
        SELECT l.*, l.name as location_name, a.name as auction_name 
        FROM locations l 
        LEFT JOIN auctions a ON l.auction_id = a.id 
        WHERE l.auction_id = ${auction_id}
      `;
    } else {
      locations = await sql`
        SELECT l.*, l.name as location_name, a.name as auction_name 
        FROM locations l 
        LEFT JOIN auctions a ON l.auction_id = a.id
      `;
    }
    return Response.json({ locations });
  } catch (error) {
    console.error("GET /api/location error:", error);
    return Response.json({
      error: process.env.NODE_ENV === 'production'
        ? "Failed to read location"
        : error.message
    }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check user role
    const userRows =
      await sql`SELECT role FROM auth_users WHERE id = ${session.user.id}`;
    if (!userRows[0] || userRows[0].role !== "admin") {
      return Response.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 },
      );
    }
    const body = await request.json();

    const { auction_id, name, address, postal_code } = body;

    if (!auction_id || !name || !address || !postal_code) {
      return Response.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Check if location already exists (Composite unique check)
    const existingLocation =
      await sql`SELECT id FROM locations WHERE auction_id = ${auction_id} AND name = ${name} AND postal_code = ${postal_code}`;

    if (existingLocation.length > 0) {
      return Response.json({ error: "This Location is already registered.", field: "name" }, { status: 409 });
    }

    // Save the record
    const newLocation = await sql`INSERT INTO locations(auction_id, name, address, postal_code) VALUES(${auction_id}, ${name}, ${address}, ${postal_code}) RETURNING *`;
    const currentUserData = await sql`SELECT name, email, role FROM auth_users WHERE id = ${session.user.id}`;
    const { ipAddress, userAgent } = getRequestInfo(request);

    await logAudit({
      userId: session.user.id,
      userName: currentUserData[0]?.name,
      userEmail: currentUserData[0]?.email,
      userRole: currentUserData[0]?.role,
      action: AUDIT_ACTIONS.LOCATION_CREATE,
      resourceType: RESOURCE_TYPES.LOCATION,
      resourceId: newLocation[0].id.toString(),
      details: {
        created_location_id: newLocation[0].id,
        location: newLocation[0].name,
        address: newLocation[0].address,
        postal_code: newLocation[0].postal_code,
        auction_id: newLocation[0].auction_id
      },
      ipAddress,
      userAgent,
      status: 'success'
    });

    // Fetch the complete location record with joins
    const locationWithDetails = await sql`
      SELECT l.*, l.name as location_name, a.name as auction_name 
      FROM locations l 
      LEFT JOIN auctions a ON l.auction_id = a.id
      WHERE l.id = ${newLocation[0].id}
    `;

    return Response.json({ location: locationWithDetails[0] });
  } catch (error) {
    console.error("POST /api/location error:", error);
    return Response.json({
      error: process.env.NODE_ENV === 'production'
        ? "Failed to create location"
        : error.message
    }, { status: 500 });
  }
}