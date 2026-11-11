import sql from "@/app/api/utils/sql";

export const dynamic = "force-dynamic";

/**
 * GET /api/client/auction-fees?provider=SALVATO&amount=12000
 * Returns the fee tiers for the specified auction provider and calculates fee if amount is supplied.
 */
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const provider = (searchParams.get("provider") || "ADESA").trim();
        const amountStr = searchParams.get("amount");

        // Fetch active tiers for this provider (case-insensitive)
        let rows = await sql`
            SELECT * FROM auction_fee_tariffs
            WHERE auction_provider ILIKE ${provider} AND is_active = TRUE
            ORDER BY min_amount ASC
        `;

        // If no rows found for specific provider, fallback to ADESA standard scale
        if (rows.length === 0) {
            rows = await sql`
                SELECT * FROM auction_fee_tariffs
                WHERE auction_provider ILIKE 'ADESA' AND is_active = TRUE
                ORDER BY min_amount ASC
            `;
        }

        let calculatedFee = 0;
        let matchedTier = null;

        if (amountStr !== null && amountStr !== undefined && amountStr !== '') {
            const amount = parseFloat(amountStr) || 0;
            if (amount > 0) {
                matchedTier = rows.find(t => {
                    const min = parseFloat(t.min_amount) || 0;
                    const max = (t.max_amount !== null && t.max_amount !== undefined && t.max_amount !== '') 
                        ? parseFloat(t.max_amount) 
                        : Infinity;
                    return amount >= min && amount <= max;
                });

                if (matchedTier) {
                    const baseFee = parseFloat(matchedTier.fee_amount) || 0;
                    const pct = parseFloat(matchedTier.fee_percent) || 0;
                    calculatedFee = baseFee + (amount * (pct / 100));
                } else if (rows.length > 0) {
                    // Fallback to highest tier
                    const highest = rows[rows.length - 1];
                    const baseFee = parseFloat(highest.fee_amount) || 0;
                    const pct = parseFloat(highest.fee_percent) || 0;
                    calculatedFee = baseFee + (amount * (pct / 100));
                }
            }
        }

        return Response.json({
            provider,
            tiers: rows,
            calculated_fee: calculatedFee,
            matched_tier: matchedTier
        });
    } catch (err) {
        console.error("GET /api/client/auction-fees Error:", err);
        return Response.json({ error: "Failed to resolve auction fees" }, { status: 500 });
    }
}

