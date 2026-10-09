const API_URL = ''; // Uses MXCLIENT internal proxy route to protect secrets and avoid CORS

export const fetchSalvatoInventory = async (params = {}) => {
  try {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_URL}/api/client/inventory/salvato?${query}`);
    
    if (!res.ok) {
      throw new Error(`Failed to fetch Salvato inventory: ${res.status}`);
    }
    
    const data = await res.json();
    return data;
  } catch (err) {
    console.error("[Salvato API] Error:", err);
    return { vehicles: [], pagination: {}, facets: {} };
  }
};

export const fetchAllInventory = async (params = {}) => {
  const result = await fetchSalvatoInventory(params);
  return result.vehicles || [];
};

