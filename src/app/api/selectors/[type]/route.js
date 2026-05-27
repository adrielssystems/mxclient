import sql from "@/app/api/utils/sql";

export async function GET(request, { params }) {
    const { type } = await params;
    // type can be: 'auctions', 'terminals', 'ports'

    try {
        let data = [];

        if (type === 'auctions') {
            // "Auctions" here means specific origins (Auction Locations)
            // Return format: "Copart - Savannah"
            data = await sql`
                SELECT l.id, 
                       a.name || ' - ' || l.name as name 
                FROM locations l
                JOIN auctions a ON l.auction_id = a.id
                ORDER BY a.name ASC, l.name ASC
            `;
        } else if (type === 'terminals') {
            // User requested Location Code as primary identifier
            data = await sql`SELECT id, COALESCE(location, name) as name, location FROM shippers_terminals ORDER BY name ASC`;
        } else if (type === 'ports') {
            // Ports come from 'destinations' table
            data = await sql`
                SELECT id, 
                country_name || ' - ' || COALESCE(port_name, '') as name 
                FROM destinations 
                ORDER BY country_name ASC
            `;
        } else if (type === 'carriers') {
            // Active carrier companies for dispatch assignment
            data = await sql`SELECT id, company_name as name FROM carriers WHERE is_active = true ORDER BY company_name ASC`;
        } else {
            return Response.json({ error: "Invalid selector type" }, { status: 400 });
        }

        return Response.json(data);
    } catch (error) {
        console.error(`Error fetching selectors for ${type}:`, error);
        return Response.json({ error: "Failed to fetch selector data" }, { status: 500 });
    }
}
