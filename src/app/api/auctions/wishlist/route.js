import sql from "@/app/api/utils/sql";
import auctionsSql from "@/app/api/utils/auctions_sql";
import { resolveClientId } from "@/app/api/utils/impersonate";

export const dynamic = "force-dynamic";

/**
 * GET, POST, DELETE /api/auctions/wishlist
 * Section 7.3 of Motor_X_Vehicle_Bidding.pdf
 */
export async function GET(request) {
    try {
        const resolved = await resolveClientId(request);
        if (resolved.error) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const clientId = resolved.clientId;
        const items = await auctionsSql`
            SELECT * FROM auction_wishlist
            WHERE client_id = ${clientId}
            ORDER BY created_at DESC
        `;

        const parsedItems = items.map(item => {
            let details = item.raw_details;
            if (typeof details === 'string') {
                try {
                    details = JSON.parse(details);
                } catch (e) {
                    details = {};
                }
            }
            return {
                ...item,
                raw_details: details || {}
            };
        });

        return Response.json({ wishlist: parsedItems });
    } catch (err) {
        console.error("[Wishlist GET Error]:", err);
        return Response.json({ error: "Failed to fetch wishlist" }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const resolved = await resolveClientId(request);
        if (resolved.error) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const clientId = resolved.clientId;
        const body = await request.json();
        const { vin, auction_source = 'ADESA', lot_number = null, raw_details = {} } = body;

        if (!vin) {
            return Response.json({ error: "VIN is required" }, { status: 400 });
        }

        await auctionsSql`
            INSERT INTO auction_wishlist (client_id, vin, auction_source, lot_number, raw_details, created_at)
            VALUES (${clientId}, ${vin}, ${auction_source}, ${lot_number}, ${JSON.stringify(raw_details)}, NOW())
            ON CONFLICT (client_id, vin) DO NOTHING
        `;

        return Response.json({ success: true, message: "Added to Wish List" });
    } catch (err) {
        console.error("[Wishlist POST Error]:", err);
        return Response.json({ error: "Failed to add to wishlist" }, { status: 500 });
    }
}

export async function DELETE(request) {
    try {
        const resolved = await resolveClientId(request);
        if (resolved.error) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const clientId = resolved.clientId;
        const { searchParams } = new URL(request.url);
        const vin = searchParams.get("vin");

        if (!vin) {
            return Response.json({ error: "VIN is required" }, { status: 400 });
        }

        await auctionsSql`
            DELETE FROM auction_wishlist
            WHERE client_id = ${clientId} AND vin = ${vin}
        `;

        return Response.json({ success: true, message: "Removed from Wish List" });
    } catch (err) {
        console.error("[Wishlist DELETE Error]:", err);
        return Response.json({ error: "Failed to delete from wishlist" }, { status: 500 });
    }
}
