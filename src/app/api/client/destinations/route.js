import sql from "@/app/api/utils/sql";

export const dynamic = "force-dynamic";

export async function GET(request) {
    try {
        const destinations = await sql`
            SELECT id, port_name, country_name 
            FROM destinations 
            ORDER BY country_name ASC, port_name ASC
        `;
        return Response.json({ destinations });
    } catch (error) {
        console.error("GET /api/client/destinations error in MXCLIENT:", error);
        return Response.json({ error: "Failed to fetch destinations" }, { status: 500 });
    }
}
