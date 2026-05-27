import sql from "@/app/api/utils/sql";
import { auth } from "@/auth";

export async function GET(request) {
    try {
        const session = await auth();
        if (!session || !session.user?.id) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type'); // 'DISPATCH' or 'SHIPPING'

        if (!type || !['DISPATCH', 'SHIPPING'].includes(type)) {
            return Response.json({ error: "Invalid or missing service type" }, { status: 400 });
        }

        let tariffs;

        if (type === 'DISPATCH') {
            tariffs = await sql`
                SELECT 
                    tm.id,
                    tm.service_type,
                    tm.origin_ref_id,
                    tm.destination_code as destination_ref_id,
                    tm.price_l0,
                    tm.price_l1,
                    tm.price_l2,
                    tm.price_l3,
                    tm.active,
                    tm.updated_at,
                    a.name || ' - ' || l.name as origin_name,
                    tm.destination_code as destination_name
                FROM tariff_master tm
                LEFT JOIN locations l ON tm.origin_ref_id = l.id
                LEFT JOIN auctions a ON l.auction_id = a.id
                WHERE tm.service_type = 'DISPATCH'
                ORDER BY a.name ASC, l.name ASC, tm.destination_code ASC
            `;
        } else {
            tariffs = await sql`
                SELECT 
                    tm.id,
                    tm.service_type,
                    tm.origin_code as origin_ref_id,
                    tm.destination_ref_id,
                    tm.price_l0,
                    tm.price_l1,
                    tm.price_l2,
                    tm.price_l3,
                    tm.active,
                    tm.updated_at,
                    tm.origin_code as origin_name,
                    d.country_name || ' - ' || COALESCE(d.port_name, '') as destination_name
                FROM tariff_master tm
                LEFT JOIN destinations d ON tm.destination_ref_id = d.id
                WHERE tm.service_type = 'SHIPPING'
                ORDER BY tm.origin_code ASC, d.country_name ASC
            `;
        }

        return Response.json({ tariffs });
    } catch (error) {
        console.error("Error fetching tariffs:", error);
        return Response.json({ error: "Failed to fetch tariffs" }, { status: 500 });
    }
}
