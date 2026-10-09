export const dynamic = "force-dynamic";

const SALVATO_API_URL = process.env.VITE_SALVATO_API_URL || "https://stage.api.salvatoauctions.com/auction-public-api";
const SALVATO_CLIENT_ID = process.env.VITE_SALVATO_CLIENT_ID || "client_zpdepzyz9ig";
const SALVATO_CLIENT_SECRET = process.env.VITE_SALVATO_CLIENT_SECRET || "secret_tbobtmpysm_ypgxcvjln3b";

let tokenCache = null;
let tokenExpiry = null;

// In-memory cache for Salvato lots (2 minutes TTL)
let lotsCache = null;
let lotsCacheTime = null;
const CACHE_TTL_MS = 2 * 60 * 1000;

async function getSalvatoToken() {
  if (tokenCache && tokenExpiry && new Date() < tokenExpiry) {
    return tokenCache;
  }

  const res = await fetch(`${SALVATO_API_URL}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId: SALVATO_CLIENT_ID, clientSecret: SALVATO_CLIENT_SECRET }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Salvato auth failed: HTTP ${res.status} - ${errorText}`);
  }

  const data = await res.json();
  if (!data.token) throw new Error("No token returned by Salvato auth endpoint");

  tokenCache = data.token;
  const expiry = new Date();
  expiry.setSeconds(expiry.getSeconds() + (data.expiresIn || 86400) - 300);
  tokenExpiry = expiry;
  return tokenCache;
}

async function fetchRawLotsFromSalvato() {
  const now = Date.now();
  if (lotsCache && lotsCacheTime && (now - lotsCacheTime < CACHE_TTL_MS)) {
    return lotsCache;
  }

  const token = await getSalvatoToken();
  const res = await fetch(`${SALVATO_API_URL}/lots?limit=500`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to fetch Salvato lots: HTTP ${res.status} - ${errorText}`);
  }

  const data = await res.json();
  const rawList = Array.isArray(data.data) ? data.data : [];
  lotsCache = rawList;
  lotsCacheTime = now;
  return rawList;
}

function normalizeSalvatoLot(lot) {
  // Extract primary image (prefer HD or non-thumbnail)
  let primaryImageUrl = "https://via.placeholder.com/600x400?text=No+Image";
  if (lot.mainImage?.link && Array.isArray(lot.mainImage.link)) {
    const nonThumb = lot.mainImage.link.find((l) => !l.isThumbNail);
    if (nonThumb?.url) primaryImageUrl = nonThumb.url;
    else if (lot.mainImage.link[0]?.url) primaryImageUrl = lot.mainImage.link[0].url;
  }

  // Extract gallery images
  const additionalImageUrls = [];
  if (lot.lotImagesDetails?.lotImages && Array.isArray(lot.lotImagesDetails.lotImages)) {
    for (const img of lot.lotImagesDetails.lotImages) {
      if (img.link && Array.isArray(img.link)) {
        const best = img.link.find((l) => !l.isThumbNail) || img.link[0];
        if (best?.url && best.url !== primaryImageUrl) {
          additionalImageUrls.push(best.url);
        }
      }
    }
  }

  // Determine condition description
  const damageParts = [lot.damageType, lot.primaryDamage].filter(Boolean);
  const condition = damageParts.length > 0 
    ? damageParts.join(" • ") 
    : (lot.title?.name || "Salvage Title");

  const currentBid = parseFloat(lot.currentPrice || lot.actualCashValue || 0);

  return {
    vehicleId: `SALVATO-${lot.id}`,
    vin: lot.vin || "N/A",
    year: lot.year || null,
    makeName: lot.make || "Unknown Make",
    modelName: lot.model || "Unknown Model",
    seriesName: lot.trim || lot.bodyClass || "",
    trim: lot.trim || "",
    bodyStyle: lot.bodyType || "Other",
    bodyStyleName: lot.bodyType || "Other",
    mileage: lot.odometerReading ? parseFloat(lot.odometerReading) : 0,
    unitOfMeasure: "mi",
    odometerCondition: lot.odometerCondition || "Actual",
    exteriorColor: lot.color || "N/A",
    interiorColor: "N/A",
    transmission: lot.transmissionStyle || "Automatic",
    drivetrain: lot.driveType || "N/A",
    engineName: lot.engineDescription || (lot.engineDisplacementLiters ? `${lot.engineDisplacementLiters}L ${lot.engineConfiguration || ""}`.trim() : "N/A"),
    vehicleGrade: null,
    condition,
    currentHighBid: currentBid,
    buyNowPrice: null,
    startingBid: currentBid,
    auctionId: lot.auctionId || "SALVATO-STAGE",
    auctionVendor: "Salvato",
    city: lot.city || "",
    state: lot.state || "TX",
    auctionEndDate: lot.endDate ? new Date(lot.endDate) : null,
    primaryImageUrl,
    additionalImageUrls,
    vehicleDetailUrl: lot.lotUrl || null,
    modalities: ["Live Auction"],
    isBestDeal: currentBid > 0 && currentBid < 15000,
    aiScore: Math.floor(Math.random() * 10) + 85,
    isRealSalvato: true,
    // Salvato Specifics
    damageType: lot.damageType || null,
    primaryDamage: lot.primaryDamage || null,
    secondaryDamage: lot.secondaryDamage || null,
    drivable: lot.drivable || "N/A",
    startCode: lot.startCode || "N/A",
    hasKeys: lot.hasKeys || "N/A",
    titleName: lot.title?.name || null,
    airbagsDeployed: lot.airbagsDeployed || "N/A",
  };
}

export async function GET(request) {
  try {
    const url = new URL(request.url);

    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "24", 10)));
    const offset = (page - 1) * limit;

    const search = (url.searchParams.get("search") || "").trim().toLowerCase();
    const make = (url.searchParams.get("make") || "").trim().toLowerCase();
    const model = (url.searchParams.get("model") || "").trim().toLowerCase();
    const bodyStyle = (url.searchParams.get("bodyStyle") || "").trim().toLowerCase();
    const yearMin = url.searchParams.get("yearMin") ? parseInt(url.searchParams.get("yearMin"), 10) : null;
    const yearMax = url.searchParams.get("yearMax") ? parseInt(url.searchParams.get("yearMax"), 10) : null;
    const maxPrice = url.searchParams.get("maxPrice") ? parseFloat(url.searchParams.get("maxPrice")) : null;
    const sort = (url.searchParams.get("sort") || "ending_soon").toLowerCase();

    // Fetch and map raw lots
    const rawLots = await fetchRawLotsFromSalvato();
    let normalized = rawLots.map(normalizeSalvatoLot);

    // Filter
    if (search) {
      normalized = normalized.filter((v) => {
        const text = `${v.vin} ${v.year} ${v.makeName} ${v.modelName} ${v.seriesName} ${v.damageType || ""} ${v.primaryDamage || ""} ${v.city} ${v.state}`.toLowerCase();
        return text.includes(search);
      });
    }

    if (make) {
      normalized = normalized.filter((v) => v.makeName.toLowerCase() === make);
    }

    if (model) {
      normalized = normalized.filter((v) => v.modelName.toLowerCase().includes(model));
    }

    if (bodyStyle) {
      normalized = normalized.filter((v) => v.bodyStyle.toLowerCase() === bodyStyle);
    }

    if (yearMin) {
      normalized = normalized.filter((v) => v.year && v.year >= yearMin);
    }

    if (yearMax) {
      normalized = normalized.filter((v) => v.year && v.year <= yearMax);
    }

    if (maxPrice) {
      normalized = normalized.filter((v) => (v.currentHighBid || 0) <= maxPrice);
    }

    // Sort
    if (sort === "price_asc") {
      normalized.sort((a, b) => (a.currentHighBid || 0) - (b.currentHighBid || 0));
    } else if (sort === "price_desc") {
      normalized.sort((a, b) => (b.currentHighBid || 0) - (a.currentHighBid || 0));
    } else if (sort === "year_desc") {
      normalized.sort((a, b) => (b.year || 0) - (a.year || 0));
    } else if (sort === "mileage_asc") {
      normalized.sort((a, b) => (a.mileage || 0) - (b.mileage || 0));
    } else {
      // Default: prioritize lots with upcoming end date or recent
      normalized.sort((a, b) => {
        if (a.auctionEndDate && b.auctionEndDate) return a.auctionEndDate - b.auctionEndDate;
        if (a.auctionEndDate) return -1;
        if (b.auctionEndDate) return 1;
        return 0;
      });
    }

    // Compute popular makes facets
    const makeCounts = {};
    for (const v of rawLots) {
      const m = v.make || "Other";
      makeCounts[m] = (makeCounts[m] || 0) + 1;
    }
    const popularMakes = Object.entries(makeCounts)
      .map(([make_name, count]) => ({ make_name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    const total = normalized.length;
    const totalPages = Math.ceil(total / limit);
    const paginatedItems = normalized.slice(offset, offset + limit);

    return Response.json({
      vehicles: paginatedItems,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
      facets: {
        popularMakes,
      },
    });
  } catch (error) {
    console.error("[Salvato Inventory API Error]:", error);
    return Response.json(
      { error: "Failed to fetch Salvato inventory", message: error.message },
      { status: 500 }
    );
  }
}
