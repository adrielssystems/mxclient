import sql from "@/app/api/utils/sql";
import { getRequestInfo } from "@/utils/auditLogger";
import { resolveIpLocation, detectAppPlatform, normalizeIpAddress } from "@/utils/ipGeo";

let activityTableReady = false;

export async function ensureCustomerActivityTable() {
    if (activityTableReady) return;
    await sql`
        CREATE TABLE IF NOT EXISTS customer_activity_logs (
            id SERIAL PRIMARY KEY,
            activity_type VARCHAR(50) NOT NULL,
            client_id TEXT,
            placed_by_name VARCHAR(255),
            placed_by_email VARCHAR(255),
            account_source VARCHAR(100),
            account_identifier VARCHAR(255),
            target_type VARCHAR(50),
            target_title VARCHAR(255),
            vin VARCHAR(25),
            lot_number VARCHAR(100),
            thumbnail_url TEXT,
            bid_amount NUMERIC(12, 2),
            ip_address VARCHAR(100),
            country_code VARCHAR(10),
            location_name VARCHAR(150),
            app_platform VARCHAR(100),
            app_version VARCHAR(100),
            user_agent TEXT,
            metadata JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_customer_activity_created_at ON customer_activity_logs(created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_customer_activity_type ON customer_activity_logs(activity_type)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_customer_activity_client ON customer_activity_logs(client_id)`;
    activityTableReady = true;
}

/**
 * Logs a customer activity event (LOGIN, LOT_VIEWED, PLACED_BID, INCREASED_BID, WON, OUTBID)
 * for real-time monitoring in the Admin Auction Board (Customer Activity).
 */
export async function logCustomerActivity({
    request = null,
    activity_type,
    client_id = null,
    placed_by_name = null,
    placed_by_email = null,
    account_source = null,
    account_identifier = null,
    target_type = 'VEHICLE',
    target_title = null,
    vin = null,
    lot_number = null,
    thumbnail_url = null,
    bid_amount = null,
    metadata = {}
}) {
    try {
        await ensureCustomerActivityTable();

        const reqInfo = request ? getRequestInfo(request) : {};
        const rawIp = reqInfo.ipAddress || reqInfo.ip || '127.0.0.1';
        const ipAddress = normalizeIpAddress(rawIp) || '127.0.0.1';
        const userAgent = request?.headers?.get?.("user-agent") || reqInfo.userAgent || "";

        const geo = resolveIpLocation(ipAddress, request?.headers || null);
        const platformInfo = detectAppPlatform(userAgent, request?.headers || null);

        const enrichedMetadata = {
            ...(metadata || {}),
            ...(platformInfo.browser ? { browser: platformInfo.browser } : {}),
            ...(platformInfo.isNativeApp ? { is_native_app: true } : {}),
            ...(geo.city ? { geo_city: geo.city } : {}),
            ...(geo.region ? { geo_region: geo.region } : {}),
        };

        await sql`
            INSERT INTO customer_activity_logs (
                activity_type, client_id, placed_by_name, placed_by_email,
                account_source, account_identifier,
                target_type, target_title, vin, lot_number, thumbnail_url, bid_amount,
                ip_address, country_code, location_name, app_platform, app_version, user_agent, metadata
            ) VALUES (
                ${activity_type},
                ${client_id},
                ${placed_by_name},
                ${placed_by_email},
                ${account_source},
                ${account_identifier},
                ${target_type},
                ${target_title},
                ${vin ? vin.trim().toUpperCase() : null},
                ${lot_number ? String(lot_number).trim() : null},
                ${thumbnail_url || null},
                ${bid_amount !== null && bid_amount !== undefined ? Number(bid_amount) : null},
                ${ipAddress},
                ${geo.countryCode},
                ${geo.locationName},
                ${platformInfo.platform},
                ${platformInfo.appVersion || null},
                ${userAgent || null},
                ${JSON.stringify(enrichedMetadata)}::jsonb
            )
        `;
    } catch (err) {
        console.warn("[CustomerActivityLogger] Non-fatal logging error:", err.message);
    }
}
