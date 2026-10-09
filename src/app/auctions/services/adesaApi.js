const API_URL = ''; // Uses MXCLIENT internal proxy route to bypass CORS

export const fetchAdesaInventory = async (params = {}) => {
  try {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_URL}/api/client/inventory?${query}`);
    
    if (!res.ok) {
      throw new Error(`Failed to fetch ADESA inventory: ${res.status}`);
    }
    
    const data = await res.json();
    return data;
  } catch (err) {
    console.error("[ADESA API] Error:", err);
    return { vehicles: [], pagination: {}, facets: {} };
  }
};
