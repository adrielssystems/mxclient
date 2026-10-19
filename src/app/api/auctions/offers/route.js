import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";
import { resolveClientId } from "@/app/api/utils/impersonate";
import { getRequestInfo, logAudit } from "@/utils/auditLogger";
import { parseUserAgent } from "@/utils/deviceDetector";

export const dynamic = "force-dynamic";

/**
 * POST /api/auctions/offers
 * Endpoint in MXCLIENT to submit and audit live auction purchases and offers.
 * Reads the client's session / impersonation state and writes directly to auction_purchases.
 */
export async function POST(request) {
    try {
        const resolved = await resolveClientId(request);
        if (resolved.error) {
            return Response.json({ error: "Unauthorized. Please log in to submit an offer." }, { status: 401 });
        }

        const clientId = resolved.clientId;
        const session = await auth();

        // Fetch client snapshot details
        const userRows = await sql`
            SELECT id, name, email, role, can_access_auctions 
            FROM auth_users 
            WHERE id = ${clientId} 
            LIMIT 1
        `;

        if (userRows.length === 0) {
            return Response.json({ error: "Client account not found" }, { status: 404 });
        }

        const clientUser = userRows[0];

        // Ensure user has live auction access
        if (clientUser.role !== 'admin' && !clientUser.can_access_auctions) {
            return Response.json({ error: "Your account does not have active Live Auctions access." }, { status: 403 });
        }

        const body = await request.json();
        const {
            vin,
            year,
            make,
            model,
            lot_number,
            auction_source = 'ADESA',
            auction_location = null,
            bid_amount = 0,
            freight_cost = 0,
            service_fee = 0,
            total_landed = 0,
            destination_id = null,
            destination_port = null,
            notes = null,
            raw_details = {}
        } = body;

        if (!vin) {
            return Response.json({ error: "VIN is required" }, { status: 400 });
        }

        // Extract network & device audit fingerprint
        const { ipAddress, userAgent } = getRequestInfo(request);
        const deviceInfo = parseUserAgent(userAgent);

        // Sanitize numeric fields
        const numBidAmount = parseFloat(bid_amount) || 0;
        const numFreightCost = parseFloat(freight_cost) || 0;
        const numServiceFee = parseFloat(service_fee) || 0;
        const numTotalLanded = parseFloat(total_landed) || (numBidAmount + numFreightCost + numServiceFee);

        // Insert into auction_purchases table
        const insertResult = await sql`
            INSERT INTO auction_purchases (
                user_id,
                client_name,
                client_email,
                vin,
                year,
                make,
                model,
                lot_number,
                auction_source,
                auction_location,
                bid_amount,
                freight_cost,
                service_fee,
                total_landed,
                destination_id,
                destination_port,
                ip_address,
                user_agent,
                device_info,
                status,
                notes,
                raw_details,
                created_at,
                updated_at
            ) VALUES (
                ${clientUser.id},
                ${clientUser.name || 'Client'},
                ${clientUser.email || ''},
                ${vin.trim().toUpperCase()},
                ${year ? parseInt(year) : null},
                ${make || null},
                ${model || null},
                ${lot_number ? String(lot_number).trim() : null},
                ${auction_source || 'ADESA'},
                ${auction_location || null},
                ${numBidAmount},
                ${numFreightCost},
                ${numServiceFee},
                ${numTotalLanded},
                ${destination_id ? parseInt(destination_id) : null},
                ${destination_port || null},
                ${ipAddress},
                ${userAgent},
                ${JSON.stringify(deviceInfo)},
                'PENDING',
                ${notes || null},
                ${JSON.stringify(raw_details)},
                NOW(),
                NOW()
            )
            RETURNING *
        `;

        const newPurchase = insertResult[0];

        // Audit Trail Logging
        await logAudit({
            userId: session?.user?.id || clientUser.id,
            userName: session?.user?.name || clientUser.name,
            userEmail: session?.user?.email || clientUser.email,
            userRole: session?.user?.role || clientUser.role,
            action: 'AUCTION_OFFER_SUBMITTED',
            resourceType: 'auction_purchase',
            resourceId: newPurchase.id.toString(),
            details: {
                vin: newPurchase.vin,
                make: newPurchase.make,
                model: newPurchase.model,
                bid_amount: newPurchase.bid_amount,
                total_landed: newPurchase.total_landed,
                client_id: clientUser.id,
                client_email: clientUser.email,
                auction_source: newPurchase.auction_source,
                is_impersonating: resolved.isImpersonating,
                device: deviceInfo
            },
            ipAddress,
            userAgent,
            status: 'success'
        });

        return Response.json({
            success: true,
            message: "Auction offer submitted and audited successfully.",
            purchase: newPurchase
        }, { status: 201 });

    } catch (error) {
        console.error("[MXCLIENT POST /api/auctions/offers Error]:", error);
        return Response.json({
            error: "Failed to record auction offer",
            details: error.message
        }, { status: 500 });
    }
}
