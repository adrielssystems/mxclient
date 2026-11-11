import sql from "@/app/api/utils/sql";
import { resolveClientId } from "@/app/api/utils/impersonate";

export const dynamic = "force-dynamic";

/**
 * GET /api/client/op-rules?provider=SALVATO
 * Resolves the client's MotorX Fees from client_auction_rules (Op. Rules)
 * Fees: Broker Fee, Wire Fee, Markup Fee, Gate Fee.
 */
export async function GET(request) {
    try {
        const resolved = await resolveClientId(request);
        if (resolved.error) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const clientId = resolved.clientId;
        const { searchParams } = new URL(request.url);
        const provider = (searchParams.get("provider") || "ADESA").trim();

        // Query client_auction_rules for this client and auction provider
        let rules = await sql`
            SELECT * FROM client_auction_rules
            WHERE client_id = ${clientId} AND auction_provider ILIKE ${provider}
            LIMIT 1
        `;

        // If no specific auction rule, check if there's any rule for this client
        if (rules.length === 0) {
            rules = await sql`
                SELECT * FROM client_auction_rules
                WHERE client_id = ${clientId}
                ORDER BY created_at DESC
                LIMIT 1
            `;
        }

        const rule = rules[0] || null;

        const brokerFee = rule ? parseFloat(rule.broker_fee) || 0 : 0;
        const wireFee = rule ? parseFloat(rule.wire_fee) || 0 : 0;
        const markupFee = rule ? parseFloat(rule.client_markup_fee) || 0 : 0;
        const gateFee = rule ? parseFloat(rule.gate_fee) || 0 : 0;

        const totalMotorXFee = brokerFee + wireFee + markupFee + gateFee;

        return Response.json({
            client_id: clientId,
            provider,
            has_rule: !!rule,
            fees: {
                broker_fee: brokerFee,
                wire_fee: wireFee,
                client_markup_fee: markupFee,
                gate_fee: gateFee
            },
            total_motorx_fee: totalMotorXFee
        });
    } catch (err) {
        console.error("GET /api/client/op-rules Error:", err);
        return Response.json({ error: "Failed to resolve operational rules" }, { status: 500 });
    }
}

