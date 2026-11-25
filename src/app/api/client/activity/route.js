import sql from "@/app/api/utils/sql";
import { resolveClientId } from "@/app/api/utils/impersonate";
import { logCustomerActivity } from "@/utils/activityLogger";

export const dynamic = "force-dynamic";

export async function POST(request) {
    try {
        const resolved = await resolveClientId(request);
        if (resolved.error || !resolved.clientId) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json().catch(() => ({}));
        const {
            activity_type,
            account_source = null,
            account_identifier = null,
            target_type = 'VEHICLE',
            target_title = null,
            vin = null,
            lot_number = null,
            thumbnail_url = null,
            bid_amount = null,
            metadata = {}
        } = body;

        const allowedTypes = ['LOGIN', 'LOT_VIEWED', 'WATCHLIST'];
        if (!allowedTypes.includes(activity_type)) {
            return Response.json({ error: "Invalid activity type" }, { status: 400 });
        }

        const userRows = await sql`
            SELECT id, name, email 
            FROM auth_users 
            WHERE id = ${resolved.clientId} 
            LIMIT 1
        `;
        const user = userRows[0] || {};

        await logCustomerActivity({
            request,
            activity_type,
            client_id: resolved.clientId,
            placed_by_name: user.name || 'Client',
            placed_by_email: user.email || null,
            account_source: account_source || (activity_type === 'LOGIN' ? 'MOTORX' : null),
            account_identifier: account_identifier || user.email || resolved.clientId,
            target_type: activity_type === 'LOGIN' ? 'ACCOUNT' : target_type,
            target_title: target_title || (activity_type === 'LOGIN' ? (user.email || resolved.clientId) : null),
            vin,
            lot_number,
            thumbnail_url,
            bid_amount,
            metadata
        });

        return Response.json({ success: true });
    } catch (error) {
        console.error("POST /api/client/activity Error:", error);
        return Response.json({ error: "Failed to record activity" }, { status: 500 });
    }
}
