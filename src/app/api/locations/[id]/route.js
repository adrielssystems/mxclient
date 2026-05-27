import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { logAudit, AUDIT_ACTIONS, RESOURCE_TYPES } from "@/utils/auditLogger";
import { verify } from "argon2";

export async function GET(request, { params }) {
    try {
        const session = await auth();

        if (!session || !session.user?.id) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = params;

        // Get user info
        const userRows =
            await sql`SELECT role, is_main_client FROM auth_users WHERE id = ${session.user.id}`;
        const user = userRows[0];

        if (!user) {
            return Response.json({ error: "User not found" }, { status: 404 });
        }

        // Get locations
        const location = await sql`SELECT * FROM locations WHERE id = ${id}`;

        return Response.json(location);
    } catch (error) {
        console.error("GET /api/locations/[id] error:", error);
        return Response.json({
            error: process.env.NODE_ENV === 'production'
                ? "Failed to fetch locations"
                : error.message
        }, { status: 500 });
    }
}

// Update location
export async function PUT(request, { params }) {
    try {
        const session = await auth();

        if (!session || !session.user?.id) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;

        // Get user info
        const userRows =
            await sql`SELECT role, is_main_client FROM auth_users WHERE id = ${session.user.id}`;
        const user = userRows[0];

        if (!user) {
            return Response.json({ error: "User not found" }, { status: 404 });
        }
        if (user.role !== "admin") {
            return Response.json({ error: "User administrator is required" }, { status: 403 });
        }
        const body = await request.json();
        const { name, address, postal_code, auction_id } = body;
        const currentUserData = await sql`SELECT name, email, role FROM auth_users WHERE id = ${session.user.id}`;

        if (!id || isNaN(id)) {
            return Response.json({ error: "Invalid ID" }, { status: 400 });
        }

        const locationRows = await sql`SELECT * FROM locations WHERE id = ${id}`;
        let currentLocation;

        if (locationRows.length == 0) {
            return Response.json({ error: "Location not found" }, { status: 404 });
        }
        currentLocation = locationRows[0];

        // Determine values to update
        const newName = name || currentLocation.name;
        const newAddress = address || currentLocation.address;
        const newPostalCode = postal_code || currentLocation.postal_code;
        const newAuctionId = auction_id || currentLocation.auction_id;

        // Check for duplicate (Composite unique check excluding current ID)
        const existingLocation = await sql`
            SELECT id FROM locations 
            WHERE auction_id = ${newAuctionId} 
            AND name = ${newName} 
            AND postal_code = ${newPostalCode}
            AND id != ${id}
        `;

        if (existingLocation.length > 0) {
            return Response.json({ error: "This Location is already registered.", field: "name" }, { status: 409 });
        }

        const updatedLocation = await sql`
            UPDATE locations
            SET 
                name = ${newName},
                address = ${newAddress},
                postal_code = ${newPostalCode},
                auction_id = ${newAuctionId}
            WHERE id = ${id}
            RETURNING *
        `;

        await logAudit({
            userId: session.user.id,
            userName: currentUserData[0]?.name,
            userEmail: currentUserData[0]?.email,
            userRole: currentUserData[0]?.role,
            action: AUDIT_ACTIONS.LOCATION_UPDATE,
            resourceType: RESOURCE_TYPES.LOCATION,
            resourceId: id.toString(),
            details: {
                name: newName,
                address: newAddress,
                postal_code: newPostalCode,
                auction_id: newAuctionId,
                original: currentLocation
            },
            status: 'success'
        });

        return Response.json({ location: updatedLocation[0] });
    } catch (error) {
        console.error("PUT /api/locations/[id] error:", error);
        return Response.json({
            error: process.env.NODE_ENV === 'production'
                ? "Failed to update location"
                : error.message
        }, { status: 500 });
    }
}

// Delete location
export async function DELETE(request, { params }) {
    try {
        const session = await auth();

        if (!session || !session.user?.id) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;

        // Get user info
        const userRows =
            await sql`SELECT role FROM auth_users WHERE id = ${session.user.id}`;
        const user = userRows[0];

        if (!user) {
            return Response.json({ error: "User not found" }, { status: 404 });
        }
        if (user.role !== "admin") {
            return Response.json({ error: "User administrator is required" }, { status: 403 });
        }
        if (!id || isNaN(id)) {
            return Response.json({ error: "Invalid ID" }, { status: 400 });
        }

        // Verify Admin Password
        const body = await request.json().catch(() => ({}));
        const { adminPassword } = body;

        if (!adminPassword) {
            return Response.json({ error: "Admin Password is required." }, { status: 400 });
        }

        const accountRows = await sql`
            SELECT password 
            FROM auth_accounts 
            WHERE "userId" = ${session.user.id} AND provider = 'credentials'
        `;
        const storedHash = accountRows[0]?.password;
        if (!storedHash) {
            return Response.json({ error: "Admin credentials not found." }, { status: 401 });
        }
        const isValid = await verify(storedHash, adminPassword);
        if (!isValid) {
            return Response.json({ error: "Invalid Admin Password. Access Denied." }, { status: 401 });
        }

        const currentUserData = await sql`SELECT name, email, role FROM auth_users WHERE id = ${session.user.id}`;

        const result = await sql`DELETE FROM locations WHERE id = ${id} RETURNING *`;

        if (result.length === 0) {
            return Response.json({ error: "Location not found" }, { status: 404 });
        }

        await logAudit({
            userId: session.user.id,
            userName: currentUserData[0]?.name,
            userEmail: currentUserData[0]?.email,
            userRole: currentUserData[0]?.role,
            action: AUDIT_ACTIONS.LOCATION_DELETE,
            resourceType: RESOURCE_TYPES.LOCATION,
            resourceId: id.toString(),
            details: {
                deleted_location: result[0]
            },
            status: 'success'
        });

        return Response.json({ success: true });
    } catch (error) {
        console.error("DELETE /api/locations/[id] error:", error);
        return Response.json({
            error: process.env.NODE_ENV === 'production'
                ? "Failed to delete location"
                : error.message
        }, { status: 500 });
    }
}
