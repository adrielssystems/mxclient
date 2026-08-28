/**
 * NHTSA VIN Decoder — Size Class Classification
 * Uses the free NHTSA vPIC API to determine vehicle size class
 * for dispatch pricing multipliers.
 */

const NHTSA_API = 'https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin';
const TIMEOUT_MS = 5000;

// Mapping keywords to size classes
const MOTORCYCLE_KEYWORDS = ['MOTORCYCLE', 'MOTOR BIKE', 'MOPED', 'SCOOTER', 'TRIKE', 'MOTOR DRIVEN'];
const REGULAR_KEYWORDS = ['SEDAN', 'COUPE', 'HATCHBACK', 'CONVERTIBLE', 'WAGON', 'SALOON', 'SPORT UTILITY', 'SUV', 'MINIVAN', 'CROSSOVER', 'MPV', 'MULTIPURPOSE', 'PASSENGER CAR'];
const LARGE_KEYWORDS = ['PICKUP', 'TRUCK', 'VAN', 'FULL-SIZE TRUCK'];
const OVERSIZED_KEYWORDS = ['BUS', 'TRAILER', 'HEAVY TRUCK', 'INCOMPLETE', 'MOTORHOME', 'LOW SPEED'];

/**
 * Decode a VIN via NHTSA and return the MotorX size class.
 * @param {string} vin - 17-character VIN
 * @returns {Promise<{size_class: string, vehicle_type: string|null, body_class: string|null}>}
 */
export async function decodeVinForSizeClass(vin) {
    const fallback = { size_class: 'regular', vehicle_type: null, body_class: null };

    if (!vin || vin.length !== 17) {
        console.warn(`[VIN Decoder] Invalid VIN length: "${vin}"`);
        return fallback;
    }

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

        const response = await fetch(`${NHTSA_API}/${vin}?format=json`, {
            signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!response.ok) {
            console.warn(`[VIN Decoder] NHTSA API returned ${response.status} for VIN ${vin}`);
            return fallback;
        }

        const data = await response.json();
        const results = data.Results || [];

        // Extract target variables
        let vehicleType = null;
        let bodyClass = null;
        let make = null;
        let model = null;
        let year = null;

        for (const item of results) {
            if (item.Variable === 'Vehicle Type' && item.Value) {
                vehicleType = item.Value.toUpperCase().trim();
            }
            if (item.Variable === 'Body Class' && item.Value) {
                bodyClass = item.Value.toUpperCase().trim();
            }
            if (item.Variable === 'Make' && item.Value) {
                make = item.Value.toUpperCase().trim();
            }
            if (item.Variable === 'Model' && item.Value) {
                model = item.Value.toUpperCase().trim();
            }
            if (item.Variable === 'Model Year' && item.Value) {
                year = item.Value.toUpperCase().trim();
            }
        }

        const sizeClass = classifySize(vehicleType, bodyClass);

        console.log(`[VIN Decoder] VIN: ${vin} | Type: "${vehicleType}" | Body: "${bodyClass}" → ${sizeClass}`);

        return { 
            size_class: sizeClass, 
            vehicle_type: vehicleType, 
            body_class: bodyClass,
            make,
            model,
            year
        };
    } catch (error) {
        if (error.name === 'AbortError') {
            console.warn(`[VIN Decoder] Timeout for VIN ${vin} (${TIMEOUT_MS}ms)`);
        } else {
            console.error(`[VIN Decoder] Error decoding VIN ${vin}:`, error.message);
        }
        return fallback;
    }
}

/**
 * Classify vehicle into MotorX size class based on NHTSA data.
 * Priority: Motorcycle > Oversized > Large > Regular (fallback)
 */
function classifySize(vehicleType, bodyClass) {
    const combined = `${vehicleType || ''} ${bodyClass || ''}`;

    // 1. Motorcycle check
    if (matchesAny(combined, MOTORCYCLE_KEYWORDS)) return 'motorcycle';

    // 2. Oversized check (buses, trailers, heavy trucks)
    if (matchesAny(combined, OVERSIZED_KEYWORDS)) return 'oversized';

    // 3. Regular check (sedans, SUVs, MPVs, Minivans, etc.) OR explicit PASSENGER CAR type
    if (matchesAny(combined, REGULAR_KEYWORDS) || vehicleType === 'PASSENGER CAR') return 'regular';

    // 4. Large check (pickups, trucks, vans)
    if (matchesAny(combined, LARGE_KEYWORDS)) return 'large';

    // 5. Fallback
    return 'regular';
}

/**
 * Check if text contains any of the keywords.
 */
function matchesAny(text, keywords) {
    return keywords.some(kw => text.includes(kw));
}
