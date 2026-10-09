export const dynamic = "force-dynamic";

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const query = searchParams.toString();
        
        const baseUrl = process.env.NEXT_PUBLIC_MOTORX_API_URL || 'https://dev.motorxcars.com';
        // Fetch from the server to bypass CORS and local DB lack of data
        const res = await fetch(`${baseUrl}/api/client/inventory?${query}`);
        
        if (!res.ok) {
            return Response.json({ error: "Failed to fetch from dev server" }, { status: res.status });
        }
        
        const data = await res.json();
        return Response.json(data);
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}
