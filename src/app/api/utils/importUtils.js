import sql from "@/app/api/utils/sql";
import { parseMDY } from "@/utils/dateUtils";

// ── Flexible date parser ───────────────────────────────────────────────────
export function parseFlexDate(str) {
  if (!str) return null;
  str = String(str).trim();

  // Try parseMDY first (MM/DD/YYYY)
  try {
    const d = parseMDY(str);
    if (d instanceof Date && !isNaN(d)) return d;
  } catch { }

  // Try M/D/YYYY (single digit month/day)
  const mdy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    const d = new Date(`${mdy[3]}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`);
    if (!isNaN(d)) return d;
  }

  // Try ISO
  const iso = new Date(str);
  if (!isNaN(iso)) return iso;

  return null;
}

export async function processVehicleImport(vehicles, validateOnly = false) {
    // ── Load reference data for validation ──────────────────────────────────
    const [allClients, allAuctions, existingVinsRows] = await Promise.all([
      sql`SELECT id, email, name FROM auth_users WHERE role IN ('client', 'main_client')`,
      sql`SELECT id, name FROM auctions`,
      sql`SELECT vin FROM vehicles WHERE vin = ANY(${vehicles.map(v => (v.vin || "").trim())})`,
    ]);

    const clientEmailMap = new Map(allClients.map(c => [c.email?.toLowerCase(), c.id]));
    const clientNameMap = new Map(allClients.map(c => [c.name?.toLowerCase().trim(), c.id]));
    const auctionNameMap = new Map(allAuctions.map(a => [a.name?.toLowerCase(), a.id]));
    const existingVins = new Set(existingVinsRows.map(r => r.vin));

    const validationErrors = [];
    const skippedDuplicates = [];
    const validVehicles = [];

    // VINs in this batch — detect in-file duplicates
    const batchVins = new Set();

    for (let i = 0; i < vehicles.length; i++) {
        const v = vehicles[i];
        const rowErrors = [];
        const rowWarnings = [];

        // ── VIN ──────────────────────────────────────────────────────────────
        const vin = (v.vin || "").trim().replace(/\s/g, "");
        if (!vin) {
            rowErrors.push("VIN is missing");
        } else if (vin.length !== 17) {
            rowErrors.push(`VIN must be 17 characters (got ${vin.length})`);
        } else if (existingVins.has(vin)) {
            skippedDuplicates.push({ row: i + 1, vin, reason: "Already exists in database" });
            continue;
        } else if (batchVins.has(vin)) {
            rowErrors.push("Duplicate VIN within this import file");
        } else {
            batchVins.add(vin);
        }

        // ── Client lookup (by name OR email) ─────────────────────────────────
        let clientId = null;
        if (v.client_email) {
            clientId = clientEmailMap.get(v.client_email.toLowerCase()) ?? null;
            if (!clientId) rowErrors.push(`No client found with email "${v.client_email}"`);
        } else if (v.client_name) {
            const normalizedName = v.client_name.toLowerCase().trim();
            clientId = clientNameMap.get(normalizedName) ?? null;
            if (!clientId) {
                for (const [name, id] of clientNameMap) {
                    if (name.includes(normalizedName) || normalizedName.includes(name)) {
                        clientId = id; break;
                    }
                }
            }
            if (!clientId) rowErrors.push(`No client found matching name "${v.client_name}"`);
        } else {
            rowErrors.push("client_name or client_email is required");
        }

        // ── Auction lookup ─────────────────────────────────────────────────
        let auctionId = null;
        if (v.auction_name) {
            auctionId = auctionNameMap.get(v.auction_name.toLowerCase()) ?? null;
            if (!auctionId) rowWarnings.push(`Auction "${v.auction_name}" not found — will be left blank`);
        }

        // ── Purchase price ────────────────────────────────────────────────────
        let price = null;
        if (v.purchase_price !== null && v.purchase_price !== undefined && v.purchase_price !== "") {
            const p = typeof v.purchase_price === "number" ? v.purchase_price : parseFloat(String(v.purchase_price).replace(/[$,\s"]/g, ""));
            if (isNaN(p)) rowErrors.push("purchase_price is not a valid number");
            else price = p;
        }

        // ── Purchase date ─────────────────────────────────────────────────────
        let purchaseDate = null;
        if (v.purchase_date) {
            purchaseDate = parseFlexDate(v.purchase_date);
            if (!purchaseDate) rowWarnings.push(`Date "${v.purchase_date}" could not be parsed — will be left blank`);
        }

        // ── Description ───────────────────────────────────────────────────────
        const description = v.description || v.vehicle || null;

        if (rowErrors.length > 0) {
            validationErrors.push({ row: i + 1, vin: vin || v.vin, errors: rowErrors, warnings: rowWarnings });
        } else {
            validVehicles.push({
                vin,
                client_id: clientId,
                description,
                auction_id: auctionId,
                purchase_price: price,
                purchase_date: purchaseDate,
                lot_number: v.lot || v.lot_number || null,
                current_status: "purchased",
                archive: v.archive || null,
                dealer: v.dl || v.dealer || null,
                buyer_number: v.buyer || v.buyer_number || null,
                pin_number: v.pin || v.pin_number || null,
            });
        }
    }

    if (validateOnly) {
        return {
            valid: validationErrors.length === 0,
            validCount: validVehicles.length,
            errorCount: validationErrors.length,
            duplicateCount: skippedDuplicates.length,
            errors: validationErrors,
            skippedDuplicates,
        };
    }

    const insertedVehicles = [];
    const insertErrors = [];

    for (const vehicle of validVehicles) {
        try {
            const [newVehicle] = await sql`
                INSERT INTO vehicles (
                    vin, client_id, description, auction_id,
                    purchase_price, purchase_date, current_status,
                    created_at, updated_at, dealer, buyer_number, pin_number
                ) VALUES (
                    ${vehicle.vin},
                    ${vehicle.client_id},
                    ${vehicle.description},
                    ${vehicle.auction_id},
                    ${vehicle.purchase_price},
                    ${vehicle.purchase_date},
                    ${vehicle.current_status},
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    ${vehicle.dealer},
                    ${vehicle.buyer_number},
                    ${vehicle.pin_number}
                )
                ON CONFLICT (vin) DO NOTHING
                RETURNING vin
            `;
            if (newVehicle) insertedVehicles.push(newVehicle.vin);
        } catch (err) {
            insertErrors.push({ vin: vehicle.vin, error: err.message });
        }
    }

    return {
        success: true,
        importedCount: insertedVehicles.length,
        totalSubmitted: vehicles.length,
        skippedDuplicates: skippedDuplicates.length,
        validationErrors: validationErrors.length,
        errors: [...validationErrors, ...insertErrors],
        insertedVehicles
    };
}
