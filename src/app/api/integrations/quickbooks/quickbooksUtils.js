import sql from "@/app/api/utils/sql";

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

    console.log("[QB Utils MXCLIENT] Token expired or near expiration. Refreshing...");
    return await refreshQuickBooksToken(refresh_token, realm_id);
}

async function refreshQuickBooksToken(storedRefreshToken, realmId) {
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
