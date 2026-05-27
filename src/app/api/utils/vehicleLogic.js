import sql from "@/app/api/utils/sql";

/**
 * =====================================================
 * vehicleLogic.js — Unified Vehicle Resolution & Validation
 * Motor X — Adriel's Systems
 * =====================================================
 * Centralized business logic for client resolution and
 * data validation shared across Manual UI, CSV Import,
 * and API/Robot ingestion pipelines.
 * =====================================================
 */

/**
 * Resolve client_id using the staged ETL pipeline (5 pasos):
 *
 * 1. auction_accounts (buyer_number + auction_id → client_id)  [PRECISO — DB centralizada]
 * 2. AuctionGate (VIN → user_name)                             [Legado — compatibilidad]
 * 3. buyer_mappings (alias + auction_id opcional → client_id)  [Mejorado con contexto]
 * 4. Direct name match in auth_users                           [Fallback genérico]
 * 5. CHECK label (needs_review = true)                         [Último recurso]
 *
 * @param {string} vin - Vehicle Identification Number
 * @param {string|null} rawName - Raw name from CSV "Name" column or manual input
 * @param {string|null} buyerNumber - Buyer number from CSV or form
 * @param {number|null} auctionId - Auction ID (integer FK) for context-aware lookup
 * @returns {Promise<{client_id: string|null, resolved_name: string|null, auctionGateUserName: string|null, needs_review: boolean, review_reasons: string[]}>}
 */
export async function resolveClient(vin, rawName = null, buyerNumber = null, auctionId = null) {
    let client_id = null;
    let resolved_name = null;
    let needs_review = false;
    const review_reasons = [];

    // ──────────────────────────────────────────────────────────
    // PASO 1: auction_accounts — Resolución por Buyer # (más precisa)
    // Reemplaza la lógica manual de pestañas "ACV" y "Manheim"
    // ──────────────────────────────────────────────────────────
    if (buyerNumber) {
        // 1a: Búsqueda con contexto de subasta (más precisa, evita colisiones)
        if (auctionId) {
            const accountResult = await sql`
                SELECT aa.client_id, u.name as client_name
                FROM auction_accounts aa
                LEFT JOIN auth_users u ON aa.client_id = u.id
                WHERE LOWER(aa.buyer_number) = LOWER(${buyerNumber})
                  AND aa.auction_id = ${auctionId}
                  AND aa.is_active = TRUE
                LIMIT 1
            `;
            if (accountResult.length > 0 && accountResult[0].client_id) {
                client_id = accountResult[0].client_id;
                resolved_name = accountResult[0].client_name;
            }
        }

        // 1b: Fallback sin contexto de subasta (búsqueda global por buyer_number)
        if (!client_id) {
            const accountResult = await sql`
                SELECT aa.client_id, u.name as client_name
                FROM auction_accounts aa
                LEFT JOIN auth_users u ON aa.client_id = u.id
                WHERE LOWER(aa.buyer_number) = LOWER(${buyerNumber})
                  AND aa.is_active = TRUE
                ORDER BY aa.auction_id NULLS LAST
                LIMIT 1
            `;
            if (accountResult.length > 0 && accountResult[0].client_id) {
                client_id = accountResult[0].client_id;
                resolved_name = accountResult[0].client_name;
            }
        }
    }

    // ──────────────────────────────────────────────────────────
    // PASO 2: AuctionGate — Resolución por VIN (legado)
    // ──────────────────────────────────────────────────────────
    let auctionGateUserName = null;
    if (!client_id && vin) {
        const gateResult = await sql`
            SELECT user_name FROM auction_gate WHERE vin = ${vin} LIMIT 1
        `;
        if (gateResult.length > 0) {
            auctionGateUserName = gateResult[0].user_name;
        }
    }

    // TEXT_BEFORE logic: "JOHN DOE - BUYER123" → "JOHN DOE"
    const extractedGateName = auctionGateUserName
        ? auctionGateUserName.split(' - ')[0].trim()
        : null;

    const aliasToSearch = rawName || extractedGateName;

    // ──────────────────────────────────────────────────────────
    // PASO 3: buyer_mappings — Resolución por alias (con contexto de subasta mejorado)
    // ──────────────────────────────────────────────────────────
    if (!client_id && aliasToSearch) {
        // 3a: Alias específico de subasta (más preciso)
        if (auctionId) {
            const mappingResult = await sql`
                SELECT bm.client_id, u.name as client_name
                FROM buyer_mappings bm
                LEFT JOIN auth_users u ON bm.client_id = u.id
                WHERE LOWER(bm.alias_name) = LOWER(${aliasToSearch})
                  AND bm.auction_id = ${auctionId}
                LIMIT 1
            `;
            if (mappingResult.length > 0 && mappingResult[0].client_id) {
                client_id = mappingResult[0].client_id;
                resolved_name = mappingResult[0].client_name || aliasToSearch;
            }
        }

        // 3b: Alias global (sin contexto de subasta)
        if (!client_id) {
            const mappingResult = await sql`
                SELECT bm.client_id, u.name as client_name
                FROM buyer_mappings bm
                LEFT JOIN auth_users u ON bm.client_id = u.id
                WHERE LOWER(bm.alias_name) = LOWER(${aliasToSearch})
                  AND bm.auction_id IS NULL
                LIMIT 1
            `;
            if (mappingResult.length > 0 && mappingResult[0].client_id) {
                client_id = mappingResult[0].client_id;
                resolved_name = mappingResult[0].client_name || aliasToSearch;
            }
        }
    }

    // ──────────────────────────────────────────────────────────
    // PASO 4: Direct name match en auth_users
    // ──────────────────────────────────────────────────────────
    if (!client_id && aliasToSearch) {
        const directMatch = await sql`
            SELECT id, name FROM auth_users WHERE LOWER(name) = LOWER(${aliasToSearch}) LIMIT 1
        `;
        if (directMatch.length > 0) {
            client_id = directMatch[0].id;
            resolved_name = directMatch[0].name;
        }
    }

    // ──────────────────────────────────────────────────────────
    // PASO 5: Fallback — Quarantine para revisión manual
    // ──────────────────────────────────────────────────────────
    if (!client_id) {
        needs_review = true;
        review_reasons.push("[Client Not Found]");
        resolved_name = "CHECK";
    }

    return { client_id, resolved_name, auctionGateUserName, needs_review, review_reasons };
}

/**
 * Validate vehicle data against business rules.
 * Returns accumulated flags and reasons without throwing.
 *
 * @param {object} data - { vin, purchase_price, auction_id, location_id }
 * @returns {Promise<{needs_review: boolean, review_reasons: string[]}>}
 */
export async function validateVehicleData(data) {
    let needs_review = false;
    const review_reasons = [];

    // Rule 1: Price must be > 0
    const price = parseFloat(data.purchase_price);
    if (!price || price <= 0) {
        needs_review = true;
        review_reasons.push("[Price is Zero]");
    }

    // Rule 2: Location must match Auction (if both provided)
    if (data.auction_id && data.location_id) {
        const locationCheck = await sql`
            SELECT id FROM locations
            WHERE id = ${data.location_id} AND auction_id = ${data.auction_id}
            LIMIT 1
        `;
        if (locationCheck.length === 0) {
            needs_review = true;
            review_reasons.push("[Auction/Location Mismatch]");
        }
    } else if (!data.location_id && data.auction_id) {
        // Location missing — quarantine for manual freight quote
        needs_review = true;
        review_reasons.push("[Location Missing]");
    }

    // Rule 3: Duplicate VIN (only active records)
    if (data.vin) {
        const duplicateCheck = await sql`
            SELECT id FROM vehicles
            WHERE vin = ${data.vin} AND master_status != 'cancelled'
            LIMIT 1
        `;
        if (duplicateCheck.length > 0) {
            needs_review = true;
            review_reasons.push("[Duplicate VIN]");
        }
    }

    return { needs_review, review_reasons };
}

/**
 * Format vehicle description with user name suffix.
 * Spec: "Vehicle Description (User Name From AuctionGate)" or "Vehicle Description (Client Name)"
 *
 * Priority:
 * 1. If auctionGateUserName is available, use that as the suffix (raw, as it appears in AuctionGate).
 * 2. Else, fall back to the resolved clientName.
 * 3. If neither, return the raw description unchanged.
 *
 * @param {string|null} clientName - Resolved client name
 * @param {string} vehicleDesc - Raw vehicle description
 * @param {string|null} auctionGateUserName - Raw user name from AuctionGate (optional, takes priority)
 * @returns {string}
 */
export function formatDescription(clientName, vehicleDesc, auctionGateUserName = null) {
    if (!vehicleDesc) return "";
    // Determine the label to append
    const label = auctionGateUserName || clientName;
    if (!label || label === "CHECK") return vehicleDesc;
    return `${vehicleDesc} (${label})`;
}
