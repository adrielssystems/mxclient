import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

export async function GET(request) {
    try {
        const session = await auth();
        if (!session || !session.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const serviceId = searchParams.get("service_id");
        const category = searchParams.get("category");

        if (!serviceId && !category) return Response.json({ error: "Missing service_id or category" }, { status: 400 });

        let query;

        if (serviceId) {
            query = sql`
                SELECT sc.*, s.name as service_name 
                FROM service_charges sc
                JOIN services s ON sc.service_id = s.id
                WHERE sc.service_id = ${serviceId}
                ORDER BY sc.id ASC
            `;
        } else {
            // Support comma-separated categories (e.g., "FEE,OP_RULE")
            const categories = category.split(',').map(c => c.trim());
            query = sql`
                SELECT 
                    sc.id as charge_id, 
                    s.id as service_id, 
                    s.name as service_name, 
                    s.category,
                    s.op_rule_type,
                    s.qbo_item_id,
                    COALESCE(sc.base_price, 0) as base_price,
                    COALESCE(sc.price_l0, 0) as price_l0,
                    COALESCE(sc.price_l1, 0) as price_l1,
                    COALESCE(sc.price_l2, 0) as price_l2,
                    COALESCE(sc.price_l3, 0) as price_l3,
                    sc.auction_specific,
                    sc.auction_id
                FROM services s
                LEFT JOIN service_charges sc ON s.id = sc.service_id
                WHERE (s.category::text = ANY(${categories}) OR s.name ILIKE ${category})
                  AND s.is_active = true
                ORDER BY s.id ASC, sc.id ASC
            `;
        }

        const charges = await query;

        return Response.json({ charges });
    } catch (err) {
        console.error("GET /api/admin/services/charges error:", err);
        return Response.json({ error: "Failed to fetch charges" }, { status: 500 });
    }
}
