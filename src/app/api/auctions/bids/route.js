import sql from "@/app/api/utils/sql";
import auctionsSql from "@/app/api/utils/auctions_sql";
import { resolveClientId } from "@/app/api/utils/impersonate";
import { getRequestInfo, logAudit } from "@/utils/auditLogger";
import { parseUserAgent } from "@/utils/deviceDetector";

export const dynamic = "force-dynamic";

/**
 * POST /api/auctions/bids
 * Implements Section 2, 3, 4, 8 of Motor_X_Vehicle_Bidding.pdf:
 * - Maximum Proxy Bid placement
 * - Internal Motor X collision check (rejects if <= highest existing Motor X client proxy bid)
 * - Submission time tracking & priority arbitration
 * - Full audit trail in auction_bid_events
 * - Atomic state recalculation on motorx_auctions_db
 */
export async function POST(request) {
    try {
        const resolved = await resolveClientId(request);
        if (resolved.error) {
            return Response.json({ error: "Unauthorized. Please log in to submit a bid." }, { status: 401 });
        }

        const clientId = resolved.clientId;

        // Fetch client snapshot from primary database (auth_users)
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
            lot_number,
            auction_source = 'ADESA',
            auction_location = null,
            max_proxy_bid = 0,
            destination_id = null,
            destination_port = null,
            raw_vehicle_details = {}
        } = body;

        if (!vin) {
            return Response.json({ error: "VIN is required" }, { status: 400 });
        }

        const proposedMaxBid = Number(max_proxy_bid);
        if (!proposedMaxBid || proposedMaxBid <= 0 || isNaN(proposedMaxBid)) {
            return Response.json({ error: "Please enter a valid Maximum Proxy Bid amount." }, { status: 400 });
        }

        // Capture client device and IP info
        const reqInfo = getRequestInfo(request);
        const userAgentHeader = request.headers.get("user-agent") || "";
        const deviceInfo = parseUserAgent(userAgentHeader);

        // --- ATOMIC TRANSACTION ON motorx_auctions_db ---
        const result = await auctionsSql.begin(async (tx) => {
            // 1. Lock existing bids for this vehicle to prevent race conditions
            const existingVehicleBids = await tx`
                SELECT id, client_id, max_proxy_bid, submission_time, status, current_internal_priority
                FROM auction_proxy_bids
                WHERE vin = ${vin}
                FOR UPDATE
            `;

            // 2. Check client's own previous bid (if any)
            const ownPreviousBid = existingVehicleBids.find(b => b.client_id === clientId);
            if (ownPreviousBid && proposedMaxBid <= Number(ownPreviousBid.max_proxy_bid)) {
                const errorMsg = `Your new Maximum Proxy Bid ($${proposedMaxBid.toLocaleString()}) must be strictly higher than your previous maximum ($${Number(ownPreviousBid.max_proxy_bid).toLocaleString()}).`;
                
                // Record failed audit event
                await tx`
                    INSERT INTO auction_bid_events (
                        vin, lot_number, auction_source, action,
                        previous_max_bid, new_max_bid, client_id, client_name, client_email,
                        ip_address, user_agent, device_info, request_status, error_reason
                    ) VALUES (
                        ${vin}, ${lot_number}, ${auction_source}, 'INCREASE_BID',
                        ${ownPreviousBid.max_proxy_bid}, ${proposedMaxBid}, ${clientId}, ${clientUser.name}, ${clientUser.email},
                        ${reqInfo.ip}, ${userAgentHeader}, ${JSON.stringify(deviceInfo)}, 'FAILED', ${errorMsg}
                    )
                `;

                return { error: errorMsg, status: 400 };
            }

            // 3. INTERNAL COMPETITOR CHECK: Find highest bid from OTHER Motor X clients
            const competitorBids = existingVehicleBids
                .filter(b => b.client_id !== clientId)
                .sort((a, b) => {
                    const diff = Number(b.max_proxy_bid) - Number(a.max_proxy_bid);
                    if (diff !== 0) return diff;
                    // Tie-breaker: earlier submission wins
                    return new Date(a.submission_time) - new Date(b.submission_time);
                });

            const highestCompetitor = competitorBids[0] || null;

            if (highestCompetitor && proposedMaxBid <= Number(highestCompetitor.max_proxy_bid)) {
                // Exact warning required by Section 2 of PDF
                const conflictWarning = "Another Motor X customer has already placed an equal or higher Maximum Proxy Bid. Increase your amount to continue, or cancel this request.";

                await tx`
                    INSERT INTO auction_bid_events (
                        vin, lot_number, auction_source, action,
                        previous_max_bid, new_max_bid, client_id, client_name, client_email,
                        ip_address, user_agent, device_info, request_status, error_reason
                    ) VALUES (
                        ${vin}, ${lot_number}, ${auction_source}, ${ownPreviousBid ? 'INCREASE_BID' : 'PROXY_BID'},
                        ${ownPreviousBid?.max_proxy_bid || null}, ${proposedMaxBid}, ${clientId}, ${clientUser.name}, ${clientUser.email},
                        ${reqInfo.ip}, ${userAgentHeader}, ${JSON.stringify(deviceInfo)}, 'REJECTED_LOWER_THAN_EXISTING', ${conflictWarning}
                    )
                `;

                return {
                    error: conflictWarning,
                    code: 'MX_OUTBID_COLLISION',
                    canIncrease: true,
                    status: 409
                };
            }

            // 4. Client's bid is higher than all other Motor X clients!
            // Demote any previously WINNING Motor X client for this vehicle to MX_OUTBID
            await tx`
                UPDATE auction_proxy_bids
                SET current_internal_priority = FALSE,
                    status = 'MX_OUTBID',
                    lost_reason = 'WON_BY_OTHER_MOTORX_CLIENT',
                    updated_at = NOW()
                WHERE vin = ${vin} AND client_id != ${clientId}
            `;

            // 5. Upsert client's proxy bid as the new internal WINNING bid
            const actionType = ownPreviousBid ? 'INCREASE_BID' : 'PROXY_BID';
            const prevAmount = ownPreviousBid ? ownPreviousBid.max_proxy_bid : null;

            const upsertRows = await tx`
                INSERT INTO auction_proxy_bids (
                    vin, lot_number, auction_source, auction_location,
                    client_id, client_name, client_email,
                    max_proxy_bid, current_internal_priority, status,
                    destination_id, destination_port, raw_vehicle_details,
                    submission_time, created_at, updated_at
                ) VALUES (
                    ${vin}, ${lot_number}, ${auction_source}, ${auction_location},
                    ${clientId}, ${clientUser.name}, ${clientUser.email},
                    ${proposedMaxBid}, TRUE, 'WINNING',
                    ${destination_id}, ${destination_port}, ${JSON.stringify(raw_vehicle_details)},
                    NOW(), NOW(), NOW()
                )
                ON CONFLICT (vin, client_id) DO UPDATE SET
                    lot_number = EXCLUDED.lot_number,
                    auction_source = EXCLUDED.auction_source,
                    auction_location = EXCLUDED.auction_location,
                    max_proxy_bid = EXCLUDED.max_proxy_bid,
                    current_internal_priority = TRUE,
                    status = 'WINNING',
                    lost_reason = NULL,
                    destination_id = EXCLUDED.destination_id,
                    destination_port = EXCLUDED.destination_port,
                    raw_vehicle_details = EXCLUDED.raw_vehicle_details,
                    submission_time = NOW(),
                    updated_at = NOW()
                RETURNING id, vin, max_proxy_bid, status, submission_time
            `;

            const activeBid = upsertRows[0];

            // 6. Record successful audit event
            await tx`
                INSERT INTO auction_bid_events (
                    proxy_bid_id, vin, lot_number, auction_source, action,
                    previous_max_bid, new_max_bid, client_id, client_name, client_email,
                    ip_address, user_agent, device_info, request_status
                ) VALUES (
                    ${activeBid.id}, ${vin}, ${lot_number}, ${auction_source}, ${actionType},
                    ${prevAmount}, ${proposedMaxBid}, ${clientId}, ${clientUser.name}, ${clientUser.email},
                    ${reqInfo.ip}, ${userAgentHeader}, ${JSON.stringify(deviceInfo)}, 'ACCEPTED'
                )
            `;

            return {
                success: true,
                bid: activeBid,
                message: actionType === 'INCREASE_BID' 
                    ? `Your Maximum Proxy Bid has been increased to $${proposedMaxBid.toLocaleString()}.` 
                    : `Maximum Proxy Bid of $${proposedMaxBid.toLocaleString()} successfully placed.`
            };
        });

        if (result.error) {
            return Response.json({
                error: result.error,
                code: result.code,
                canIncrease: result.canIncrease
            }, { status: result.status || 400 });
        }

        // Secondary audit in primary database
        await logAudit({
            userId: clientUser.id,
            userEmail: clientUser.email,
            userRole: clientUser.role,
            action: 'AUCTION_PROXY_BID_PLACED',
            resourceType: 'AUCTION_BID',
            resourceId: vin,
            details: {
                vin,
                max_proxy_bid: proposedMaxBid,
                lot_number,
                auction_source
            },
            status: 'success',
            ipAddress: reqInfo.ip,
            userAgent: reqInfo.userAgent
        });

        return Response.json(result);
    } catch (err) {
        console.error("[Auction Proxy Bids Error]:", err);
        return Response.json({ error: "Failed to place bid. Please try again." }, { status: 500 });
    }
}

/**
 * GET /api/auctions/bids
 * Fetch client's proxy bids with current auction status
 */
export async function GET(request) {
    try {
        const resolved = await resolveClientId(request);
        if (resolved.error) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const clientId = resolved.clientId;
        const { searchParams } = new URL(request.url);
        const vin = searchParams.get("vin");

        if (vin) {
            const rows = await auctionsSql`
                SELECT * FROM auction_proxy_bids
                WHERE client_id = ${clientId} AND vin = ${vin}
                LIMIT 1
            `;
            return Response.json({ bid: rows[0] || null });
        }

        const status = searchParams.get("status") || "active"; // active | completed
        let query;

        if (status === "active") {
            query = auctionsSql`
                SELECT * FROM auction_proxy_bids
                WHERE client_id = ${clientId} 
                  AND status IN ('WINNING', 'MX_OUTBID', 'OUTBID', 'BID_PENDING', 'PURCHASE_PENDING', 'RESULT_PENDING')
                ORDER BY updated_at DESC
            `;
        } else {
            query = auctionsSql`
                SELECT * FROM auction_proxy_bids
                WHERE client_id = ${clientId} 
                  AND status IN ('WON', 'LOST')
                ORDER BY updated_at DESC
            `;
        }

        const bids = await query;
        return Response.json({ bids });
    } catch (err) {
        console.error("[Auction Proxy Bids GET Error]:", err);
        return Response.json({ error: "Failed to fetch bids" }, { status: 500 });
    }
}
