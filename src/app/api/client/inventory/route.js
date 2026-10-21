import auctionsSql from "@/app/api/utils/auctions_sql";

export const dynamic = "force-dynamic";

export async function GET(request) {
    try {
        const url = new URL(request.url);

        const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
        const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10)));
        const offset = (page - 1) * limit;

        const search = (url.searchParams.get("search") || "").trim();
        const make = (url.searchParams.get("make") || "").trim();
        const model = (url.searchParams.get("model") || "").trim();
        const yearMin = url.searchParams.get("yearMin") ? parseInt(url.searchParams.get("yearMin"), 10) : null;
        const yearMax = url.searchParams.get("yearMax") ? parseInt(url.searchParams.get("yearMax"), 10) : null;
        const maxPrice = url.searchParams.get("maxPrice") ? parseFloat(url.searchParams.get("maxPrice")) : null;
        const buyNowOnly = url.searchParams.get("buyNow") === "true";

        // Query auctionsSql directly from motorx_auctions_db
        let searchCondition = auctionsSql``;
        if (search) {
            const s = `%${search}%`;
            searchCondition = auctionsSql`AND (v.vin ILIKE ${s} OR v.make_name ILIKE ${s} OR v.model_name ILIKE ${s} OR v.trim ILIKE ${s})`;
        }

        let makeCondition = make ? auctionsSql`AND v.make_name ILIKE ${make}` : auctionsSql``;
        let modelCondition = model ? auctionsSql`AND v.model_name ILIKE ${model}` : auctionsSql``;
        let yearMinCondition = yearMin ? auctionsSql`AND v.year >= ${yearMin}` : auctionsSql``;
        let yearMaxCondition = yearMax ? auctionsSql`AND v.year <= ${yearMax}` : auctionsSql``;
        let priceCondition = maxPrice ? auctionsSql`AND COALESCE(v.current_high_bid, v.starting_bid, v.buy_now_price, 0) <= ${maxPrice}` : auctionsSql``;
        let buyNowCondition = buyNowOnly ? auctionsSql`AND v.buy_now_price IS NOT NULL AND v.buy_now_price > 0` : auctionsSql``;

        const whereClause = auctionsSql`
            WHERE (v.status = 'active' OR v.status IS NULL)
              ${searchCondition}
              ${makeCondition}
              ${modelCondition}
              ${yearMinCondition}
              ${yearMaxCondition}
              ${priceCondition}
              ${buyNowCondition}
        `;

        const [totalRes, items, makesRes] = await Promise.all([
            auctionsSql`SELECT COUNT(*) as count FROM adesa_inventory v ${whereClause}`,
            auctionsSql`
                SELECT 
                    v.vehicle_id, v.vin, v.year, v.make_name, v.model_name, v.series_name, v.trim,
                    v.body_style_name, v.doors, v.engine_name, v.transmission, v.fuel_type,
                    v.exterior_color, v.interior_color, v.mileage, v.vehicle_grade, v.guarantee_light,
                    v.driveable, v.auction_vendor, v.city, v.state, v.lane, v.run_number, v.lot_number,
                    v.starting_bid, v.current_high_bid, v.buy_now_price, v.sale_channels,
                    v.auction_end_date, v.primary_image_url, v.additional_image_urls, v.created_at
                FROM adesa_inventory v
                ${whereClause}
                ORDER BY v.created_at DESC
                LIMIT ${limit} OFFSET ${offset}
            `,
            auctionsSql`
                SELECT DISTINCT make_name, COUNT(*) as count
                FROM adesa_inventory
                GROUP BY make_name
                ORDER BY count DESC
                LIMIT 20
            `
        ]);

        const total = parseInt(totalRes[0]?.count || 0, 10);
        const totalPages = Math.ceil(total / limit);

        return Response.json({
            vehicles: items,
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasMore: page < totalPages
            },
            facets: {
                popularMakes: makesRes
            }
        });
    } catch (err) {
        console.error("[MXCLIENT Inventory Route Error]:", err);
        return Response.json({ error: err.message, vehicles: [] }, { status: 500 });
    }
}
