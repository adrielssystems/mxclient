import sql from "@/app/api/utils/sql";

// In-memory mutex to ensure only one token refresh occurs at a time in this process
let activeRefreshPromise = null;

export function getQuickBooksBaseUrl() {
    return process.env.QB_ENVIRONMENT === 'sandbox'
        ? "https://sandbox-quickbooks.api.intuit.com"
        : "https://quickbooks.api.intuit.com";
}

export async function getValidTokens() {
    const settings = await sql`
        SELECT access_token, refresh_token, realm_id, token_expires_at
        FROM settings_integrations
        WHERE provider = 'quickbooks' AND is_connected = TRUE
    `;

    if (settings.length === 0) {
        throw new Error("QuickBooks is not connected.");
    }

    const { access_token, refresh_token, realm_id, token_expires_at } = settings[0];
    const expirationBufferMs = 5 * 60 * 1000;
    const now = new Date();
    const expiresAt = new Date(token_expires_at);

    if (expiresAt.getTime() - now.getTime() > expirationBufferMs) {
        return { accessToken: access_token, realmId: realm_id };
    }

    // Concurrency Lock: If another refresh is already in-flight, await that same Promise
    if (activeRefreshPromise) {
        console.log("[QB Utils MXCLIENT] Another token refresh is in progress. Awaiting existing refresh...");
        return await activeRefreshPromise;
    }

    activeRefreshPromise = (async () => {
        try {
            // Re-check DB in case another process/worker just refreshed it milliseconds ago
            const fresh = await sql`
                SELECT access_token, refresh_token, realm_id, token_expires_at
                FROM settings_integrations
                WHERE provider = 'quickbooks' AND is_connected = TRUE
            `;
            if (fresh.length > 0) {
                const freshExpires = new Date(fresh[0].token_expires_at);
                if (freshExpires.getTime() - Date.now() > expirationBufferMs) {
                    console.log("[QB Utils MXCLIENT] Token was already refreshed by another worker. Reusing.");
                    return { accessToken: fresh[0].access_token, realmId: fresh[0].realm_id };
                }
            }

            console.log("[QB Utils MXCLIENT] Token expired or near expiration. Refreshing...");
            return await refreshQuickBooksToken(fresh[0]?.refresh_token || refresh_token, realm_id);
        } finally {
            activeRefreshPromise = null;
        }
    })();

    return await activeRefreshPromise;
}

async function refreshQuickBooksToken(storedRefreshToken, realmId) {
    // SAFETY GUARD: Do NOT rotate production refresh tokens from local development
    if (process.env.NODE_ENV === 'development' && process.env.ENABLE_LOCAL_QB_REFRESH !== 'true') {
        console.warn("[QB Utils MXCLIENT] Token refresh prevented in local development to protect production session. Set ENABLE_LOCAL_QB_REFRESH=true to allow.");
        throw new Error("QuickBooks token refresh disabled in local development to protect production.");
    }

    const clientId = process.env.QB_CLIENT_ID;
    const clientSecret = process.env.QB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error("Missing QuickBooks environment variables (QB_CLIENT_ID, QB_CLIENT_SECRET)");
    }

    const tokenEndpoint = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const body = new URLSearchParams();
    body.append("grant_type", "refresh_token");
    body.append("refresh_token", storedRefreshToken);

    const response = await fetch(tokenEndpoint, {
        method: "POST",
        headers: {
            "Authorization": `Basic ${authHeader}`,
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json"
        },
        body: body
    });

    const data = await response.json();

    if (!response.ok) {
        console.error("[QB Utils MXCLIENT] Refresh Token Error:", data);
        if (data.error === "invalid_grant") {
            // Check if another concurrent process just updated the tokens within the last 30 seconds
            const recent = await sql`
                SELECT access_token, realm_id, token_expires_at, updated_at
                FROM settings_integrations
                WHERE provider = 'quickbooks' AND is_connected = TRUE
                  AND updated_at > NOW() - INTERVAL '30 seconds'
            `;
            if (recent.length > 0 && new Date(recent[0].token_expires_at) > new Date()) {
                console.log("[QB Utils MXCLIENT] Another worker updated the token recently. Using new token instead of disconnecting.");
                return { accessToken: recent[0].access_token, realmId: recent[0].realm_id };
            }

            await sql`
                UPDATE settings_integrations 
                SET is_connected = FALSE, updated_at = NOW() 
                WHERE provider = 'quickbooks'
            `;
            throw new Error("QuickBooks session expired. Please reconnect manually in Settings.");
        }
        throw new Error(data.error_description || data.error || "Failed to refresh QuickBooks token");
    }

    const newExpiresAt = new Date(Date.now() + data.expires_in * 1000);

    await sql`
        UPDATE settings_integrations 
        SET 
            access_token = ${data.access_token},
            refresh_token = ${data.refresh_token},
            token_expires_at = ${newExpiresAt},
            updated_at = NOW()
        WHERE provider = 'quickbooks'
    `;

    console.log("[QB Utils MXCLIENT] Token refreshed successfully.");

    return {
        accessToken: data.access_token,
        realmId: realmId
    };
}
