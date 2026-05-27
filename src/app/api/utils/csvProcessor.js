import sql from "@/app/api/utils/sql";
import { parse, isValid, format } from "date-fns";
import Papa from "papaparse";
import { decodeVinForSizeClass } from "@/app/api/utils/vinDecoder";
import { resolveClient, formatDescription } from "@/app/api/utils/vehicleLogic";

/**
 * Clean price strings like "$7,595.00" to valid decimals
 */
export function sanitizePrice(priceString) {
    if (!priceString) return 0;
    const clean = priceString.toString().replace(/[^0-9.]/g, '');
    const price = parseFloat(clean);
    return isNaN(price) ? 0 : price;
}

/**
 * Normaliza nombres de locación para corregir ZIP codes de 4 dígitos (añadiendo cero a la izquierda)
 * y unificar formato (Mayúsculas, espacios extra).
 */
export function normalizeLocationName(name) {
    if (!name) return "";
    let normalized = name.toString().toUpperCase().trim();
    
    // Remplazar múltiples espacios internos por uno solo
    normalized = normalized.replace(/\s+/g, ' ');
    
    // Detectar si termina en exactamente 4 dígitos precedidos por un espacio
    // Ejemplo: "SOMERVILLE NJ 8844" -> "SOMERVILLE NJ 08844"
    if (/\s\d{4}$/.test(normalized)) {
        normalized = normalized.replace(/\s(\d{4})$/, ' 0$1');
    }
    
    return normalized;
}

/**
 * Handle M/D/YYYY or ISO date format for DB compatibility
 */
export function parseDate(dateString) {
    if (!dateString) return null;
    const trimmed = dateString.trim();
    
    // Try M/d/yyyy first
    try {
        const parsed = parse(trimmed, 'M/d/yyyy', new Date());
        if (isValid(parsed)) return format(parsed, 'yyyy-MM-dd');
    } catch (e) {}

    // Try ISO/Generic
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return format(d, 'yyyy-MM-dd');

    return null;
}

/**
 * 🚀 PROD READY: 11-Column CSV Processor (Fixed Triage & Zero-Friction)
 * Mappings: Date, Auction, Locations, LOT, Vehicle, VIN#, Name, Price, DL, Buyer, PIN#
 */
export async function processRobustCSV(csvText, options = { userId: null, createMissingLocations: false }) {
    const { userId, createMissingLocations } = options;

    // Parse CSV
    const { data: rows, meta, errors: parseErrors } = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: 'greedy',
        transformHeader: h => h.replace(/[\u200B-\u200D\uFEFF]/g, '').trim()
    });

    // Production Header Validation
    const requiredHeaders = ['Date', 'Auction', 'Locations', 'LOT', 'Vehicle', 'VIN#', 'Name', 'Price', 'DL', 'Buyer', 'PIN#'];
    const missingHeaders = requiredHeaders.filter(h => !meta.fields.includes(h));
    
    if (missingHeaders.length > 0) {
        throw new Error(`Invalid CSV structure. Missing required columns: ${missingHeaders.join(", ")}`);
    }

    if (parseErrors.length > 0) {
        throw new Error("CSV Parsing Error: " + JSON.stringify(parseErrors));
    }

    const results = {
        success_count: 0,
        rows_with_warnings: []
    };

    const successfulInsertions = [];

    // Master Data for lookups
    const allAuctions = await sql`SELECT id, name FROM auctions`;
    let allLocations = await sql`SELECT id, name, auction_id FROM locations`;

    const getLocationsMap = (locs) => {
        const map = new Map();
        locs.forEach(loc => {
            if (!map.has(loc.auction_id)) map.set(loc.auction_id, []);
            map.get(loc.auction_id).push(loc);
        });
        return map;
    };
    let locationsByAuction = getLocationsMap(allLocations);

    // Process Each Row
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2; 
        
        // 1. Exact Column Extraction
        const rawDate = row['Date']?.trim();
        const rawAuction = row['Auction']?.trim();
        const rawLocation = row['Locations']?.trim();
        const rawLot = row['LOT']?.trim();
        let rawVehicleDesc = row['Vehicle']?.trim();
        const rawVin = row['VIN#']?.trim();
        const rawNameForClient = row['Name']?.trim();
        const rawPrice = row['Price']?.trim();
        const rawDl = row['DL']?.trim();
        let rawBuyerStrict = row['Buyer']?.trim();
        let rawPin = row['PIN#']?.trim();

        // 🚀 HOTFIX: Shifted Column Triage
        // Si el CSV tiene columnas extra (ej. 'Archive', 'Canceled') pero las filas
        // de datos tienen menos valores, PapaParse empuja los valores hacia la izquierda.
        // Recuperamos Buyer y PIN de las columnas 'Archive' y 'Canceled' si están vacíos.
        if (!rawBuyerStrict && !rawPin) {
            const possibleBuyer = row['Archive']?.trim();
            const possiblePin = row['Canceled']?.trim();
            // Verificación heurística básica: suelen ser números o alfanuméricos
            if (possibleBuyer && possiblePin && /^[A-Za-z0-9]+$/.test(possibleBuyer) && /^[A-Za-z0-9]+$/.test(possiblePin)) {
                rawBuyerStrict = possibleBuyer;
                rawPin = possiblePin;
            }
        }

        if (!rawVin) {
            results.rows_with_warnings.push({ row_index: rowNum, errors: ["VIN MISSING"] });
            continue;
        }

        // Triage Flags
        let needs_review = false;
        let review_reasons = [];

        // 2. Auction Resolution — MUST come first so auctionId is available for resolveClient()
        let auctionId = null;
        const isOnlineAuction = rawAuction && (rawAuction.toLowerCase() === 'acv' || rawAuction.toLowerCase() === 'manheim');

        if (rawAuction) {
            const match = allAuctions.find(a => a.name.toLowerCase() === rawAuction.toLowerCase());
            if (match) auctionId = match.id;
        }

        let locationId = null;
        const isNaLocation = rawLocation && rawLocation.toString().toUpperCase() === 'NA';

        if (isOnlineAuction) {
            // ACV / Manheim: dirección es informativa — no está en el Tariff Manager.
            // Se guarda en la descripción del vehículo para referencia del equipo.
            // NO se pone en quarantine — el flete se gestiona normalmente.
            locationId = null;
            if (rawLocation) {
                rawVehicleDesc = `${rawVehicleDesc} | Pickup: ${rawLocation}`;
            }
        } else if (isNaLocation) {
            // 'NA' explícito = cotización de flete manual requerida
            locationId = null;
            needs_review = true;
            review_reasons.push("[Manual Freight Quote Required]");
        } else if (rawLocation && auctionId) {
            const possibleLocs = locationsByAuction.get(auctionId) || [];
            const normalizedCsvLoc = normalizeLocationName(rawLocation);

            const match = possibleLocs.find(l => {
                const normalizedDbLoc = normalizeLocationName(l.name);
                return normalizedDbLoc === normalizedCsvLoc || normalizedCsvLoc.includes(normalizedDbLoc);
            });

            if (match) {
                locationId = match.id;
            } else if (createMissingLocations) {
                try {
                    const [newLoc] = await sql`
                        INSERT INTO locations (auction_id, name, address, postal_code)
                        VALUES (${auctionId}, ${rawLocation}, ${rawLocation}, '00000')
                        RETURNING id, name, auction_id
                    `;
                    locationId = newLoc.id;
                    allLocations.push(newLoc);
                    locationsByAuction = getLocationsMap(allLocations);
                } catch (e) {
                    needs_review = true;
                    review_reasons.push("[Error Creating Location]");
                }
            } else {
                needs_review = true;
                review_reasons.push("[Auction or Location Not Found]");
            }
        } else {
            needs_review = true;
            review_reasons.push("[Auction or Location Not Found]");
        }

        // 3. Client Resolution (UNIFIED via vehicleLogic.js)
        // auctionId is now resolved above — safe to pass to resolveClient()
        // Pipeline: auction_accounts (Buyer#) → AuctionGate (VIN) → BuyersDB (alias) → Direct Match → CHECK label
        const clientResolution = await resolveClient(rawVin, rawNameForClient, rawBuyerStrict, auctionId);
        let client_id = clientResolution.client_id;
        if (clientResolution.needs_review) {
            needs_review = true;
            review_reasons.push(...clientResolution.review_reasons);
        }

        // Enrich description: suffix with AuctionGate user name if available, else resolved client name
        rawVehicleDesc = formatDescription(
            clientResolution.resolved_name,
            rawVehicleDesc,
            clientResolution.auctionGateUserName
        );

        // Fetch client profile flags from rules (motorx_pickup → auto-dispatch, buyer_pays_auction/buyer_payment → alternate invoice)
        let motorXPickup = false;
        let buyerPayment = false; // If true: client pays auction directly → exclude purchase price from invoice
        if (client_id) {
            const clientProfile = await sql`SELECT id, is_main_client, main_client_id, buyer_payment FROM auth_users WHERE id = ${client_id} LIMIT 1`;
            const profile = clientProfile[0];
            if (profile) {
                buyerPayment = profile.buyer_payment || false;
                const targetMainClientId = profile.is_main_client ? profile.id : profile.main_client_id;

                if (auctionId) {
                    const auctionData = await sql`SELECT name FROM auctions WHERE id = ${auctionId} LIMIT 1`;
                    const auctionProvider = auctionData[0]?.name;

                    if (targetMainClientId && auctionProvider) {
                        const rules = await sql`
                            SELECT motorx_pickup, buyer_pays_auction FROM client_auction_rules 
                            WHERE client_id = ${targetMainClientId} 
                            AND LOWER(auction_provider) = LOWER(${auctionProvider})
                            LIMIT 1
                        `;
                        const rule = rules[0];
                        if (rule) {
                            motorXPickup = rule.motorx_pickup || false;
                            if (rule.buyer_pays_auction) {
                                buyerPayment = true;
                            }
                        }
                    }
                }
            }
        }

        // 4. Data Preparation
        const purchaseDate = parseDate(rawDate);
        const purchasePrice = sanitizePrice(rawPrice);
        if (!purchaseDate) {
            needs_review = true;
            review_reasons.push("[Invalid Date]");
        }

        // Price validation: zero price → quarantine
        if (!purchasePrice || purchasePrice <= 0) {
            needs_review = true;
            review_reasons.push("[Price is Zero]");
        }

        // Duplicate Check (STRICT INDEX COMPATIBLE)
        let finalVin = rawVin;
        const exists = await sql`SELECT id FROM vehicles WHERE vin = ${rawVin} AND master_status != 'cancelled' LIMIT 1`;
        if (exists.length > 0) {
            finalVin = `${rawVin}-DUP-${Math.floor(1000 + Math.random() * 9000)}`;
            needs_review = true;
            review_reasons.push("[Duplicate VIN Injected]");
        }

        // Final Reason String
        const reviewReasonStr = review_reasons.length > 0 ? review_reasons.join(" | ") : null;

        // 5. Database Insertion (HARDENED PERSISTENCE)
        try {
            // Determine dispatch status: auto-activate if client has motor_x_pickup = true
            const csvDispatchStatus = motorXPickup ? 'assignment_pending' : 'not_applicable';

            const [newVehicle] = await sql`
                INSERT INTO vehicles (
                    vin, 
                    client_id, 
                    description, 
                    auction_id, 
                    location_id, 
                    purchase_price, 
                    purchase_date, 
                    lot_number,
                    dl_number,
                    buyer_number,
                    pin_number,
                    master_status, 
                    purchase_status, 
                    dispatch_status, 
                    title_status,
                    entry_method,
                    needs_review,
                    review_reason,
                    created_at,
                    updated_at
                ) VALUES (
                    ${finalVin}, 
                    ${client_id}, 
                    ${rawVehicleDesc}, 
                    ${auctionId}, 
                    ${locationId},
                    ${purchasePrice}, 
                    ${purchaseDate}, 
                    ${rawLot},
                    ${rawDl || null},
                    ${rawBuyerStrict || null}, 
                    ${rawPin || null},
                    'entered', 
                    'payment_pending', 
                    ${csvDispatchStatus}, 
                    'waiting_documents',
                    'CSV_IMPORT',
                    ${needs_review},
                    ${reviewReasonStr},
                    NOW(),
                    NOW()
                )
                RETURNING id
            `;

            results.success_count++;
            successfulInsertions.push({ id: newVehicle.id, vin: rawVin });
            if (purchasePrice > 0) {
                try {
                    await sql`
                        INSERT INTO invoice_line_items (vehicle_id, description, amount, type)
                        VALUES (${newVehicle.id}, 'Vehicle Purchase Price', ${purchasePrice}, 'PURCHASE')
                    `;
                    if (buyerPayment) {
                        await sql`
                            INSERT INTO invoice_line_items (vehicle_id, description, amount, type)
                            VALUES (${newVehicle.id}, 'Client pay to the auction', ${-purchasePrice}, 'FEE')
                        `;
                    }
                } catch (e) {
                    console.warn(`[csvProcessor] Could not insert purchase price or adjustment line item for vehicle ${newVehicle.id}:`, e.message);
                }
            }
            if (needs_review) {
                results.rows_with_warnings.push({ row_index: rowNum, vin: rawVin, reasons: review_reasons });
            }

        } catch (dbError) {
            results.rows_with_warnings.push({ row_index: rowNum, vin: rawVin, errors: [dbError.message] });
        }
    }

    // Background VIN Decoding (Batched to avoid NHTSA 403 Rate Limits)
    if (successfulInsertions.length > 0) {
        // Execute background job without blocking the main response
        (async () => {
            const chunkSize = 3;
            for (let i = 0; i < successfulInsertions.length; i += chunkSize) {
                const chunk = successfulInsertions.slice(i, i + chunkSize);
                await Promise.allSettled(chunk.map(async (v) => {
                    try {
                        const decoded = await decodeVinForSizeClass(v.vin);
                        
                        // If we got valid Make/Model data from NHTSA, reconstruct a clean description
                        if (decoded.make && decoded.model) {
                            const newDesc = `${decoded.year || ''} ${decoded.make} ${decoded.model}`.trim();
                            // We only overwrite if the current description is blank, or we can just append it if needed.
                            // But usually if it's blank in UI, it was just the "(Client Name)" inside the DB. Let's force an update to construct it properly.
                            await sql`
                                UPDATE vehicles 
                                SET size_class = ${decoded.size_class},
                                    description = CASE 
                                        WHEN description = '' OR description IS NULL THEN ${newDesc}
                                        -- If description is just the client name in parentheses, prepend the decoded description
                                        WHEN description LIKE '(%)' THEN ${newDesc} || ' ' || description
                                        -- If it already contains the make or model, don't double it (very basic check)
                                        WHEN description ILIKE ${'%' + decoded.make + '%'} OR description ILIKE ${'%' + decoded.model + '%'} THEN description
                                        -- Otherwise prepend the clean decoded info
                                        ELSE ${newDesc} || ' | ' || description
                                    END
                                WHERE id = ${v.id}
                            `;
                        } else {
                            await sql`UPDATE vehicles SET size_class = ${decoded.size_class} WHERE id = ${v.id}`;
                        }
                    } catch (e) {}
                }));
                // Wait 500ms between chunks to respect NHTSA API limits
                if (i + chunkSize < successfulInsertions.length) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
        })().catch(e => console.error("[Background VIN Decode Error]", e));
    }

    return results;
}

