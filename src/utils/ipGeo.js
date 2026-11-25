import geoip from "geoip-lite";

const regionNames =
    typeof Intl !== "undefined" && typeof Intl.DisplayNames === "function"
        ? new Intl.DisplayNames(["en"], { type: "region" })
        : null;

/**
 * Clean raw IP header or stored IP string into a bare IPv4/IPv6 address.
 */
export function normalizeIpAddress(rawIp) {
    if (!rawIp || typeof rawIp !== "string") return "";
    let ip = rawIp.split(",")[0].trim();
    ip = ip.replace(/\s*\(.*?\)\s*/g, "").trim();
    if (ip.startsWith("::ffff:")) {
        ip = ip.slice(7);
    }
    if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(ip)) {
        ip = ip.split(":")[0];
    }
    if (!ip || ip.toLowerCase() === "unknown") return "";
    return ip;
}

/**
 * Check if IP is localhost or RFC1918 / private LAN address.
 */
export function isPrivateOrLocalIp(ip) {
    if (!ip) return true;
    const lower = ip.toLowerCase();
    if (
        lower === "127.0.0.1" ||
        lower === "::1" ||
        lower === "localhost" ||
        lower === "0.0.0.0" ||
        lower.startsWith("10.") ||
        lower.startsWith("192.168.") ||
        lower.startsWith("169.254.") ||
        lower.startsWith("fc") ||
        lower.startsWith("fd") ||
        lower.startsWith("fe80:")
    ) {
        return true;
    }
    const match172 = /^172\.(\d{1,3})\./.exec(lower);
    if (match172) {
        const octet = parseInt(match172[1], 10);
        if (octet >= 16 && octet <= 31) return true;
    }
    return false;
}

function safeDecode(val) {
    if (!val || typeof val !== "string") return "";
    try {
        return decodeURIComponent(val).trim();
    } catch {
        return val.trim();
    }
}

/**
 * Always-available IP geolocation resolver.
 * Uses CDN headers when available (Cloudflare/Vercel) and falls back immediately
 * to the bundled offline MaxMind GeoLite2 database (`geoip-lite`) so geolocation
 * works 100% of the time without external API failures or rate limits.
 */
export function resolveIpLocation(rawIp, headers = null) {
    const ip = normalizeIpAddress(rawIp);

    const hdrCountryRaw =
        headers?.get?.("cf-ipcountry") ||
        headers?.get?.("x-vercel-ip-country") ||
        null;
    const hdrCityRaw =
        headers?.get?.("cf-ipcity") ||
        headers?.get?.("x-vercel-ip-city") ||
        null;
    const hdrRegionRaw =
        headers?.get?.("cf-region-code") ||
        headers?.get?.("x-vercel-ip-country-region") ||
        null;

    const hdrCountry =
        hdrCountryRaw && hdrCountryRaw !== "XX" && hdrCountryRaw !== "T1"
            ? hdrCountryRaw.trim().toUpperCase()
            : null;
    const hdrCity = safeDecode(hdrCityRaw);
    const hdrRegion = safeDecode(hdrRegionRaw);

    if (hdrCity && hdrCountry) {
        const parts = [hdrCity, hdrRegion || null, hdrCountry].filter(Boolean);
        return {
            ip,
            locationName: parts.join(", "),
            countryCode: hdrCountry,
            city: hdrCity,
            region: hdrRegion || null,
        };
    }

    if (!ip) {
        return {
            ip: "",
            locationName: "Unknown",
            countryCode: hdrCountry,
            city: null,
            region: null,
        };
    }

    if (isPrivateOrLocalIp(ip)) {
        return {
            ip,
            locationName: "Localhost",
            countryCode: null,
            city: null,
            region: null,
        };
    }

    try {
        const geo = geoip.lookup(ip);
        if (geo) {
            const country = (geo.country || hdrCountry || "").toUpperCase() || null;
            const region = (geo.region || hdrRegion || "").trim() || null;
            const city = (geo.city || hdrCity || "").trim() || null;

            if (city && region && country) {
                return { ip, locationName: `${city}, ${region}, ${country}`, countryCode: country, city, region };
            }
            if (city && country) {
                return { ip, locationName: `${city}, ${country}`, countryCode: country, city, region };
            }
            if (region && country) {
                return { ip, locationName: `${region}, ${country}`, countryCode: country, city, region };
            }
            if (country) {
                const fullName = regionNames?.of?.(country) || country;
                return { ip, locationName: fullName, countryCode: country, city: null, region: null };
            }
        }
    } catch (err) {
        console.warn("[ipGeo] geoip-lite lookup error:", err.message);
    }

    if (hdrCountry) {
        const fullName = regionNames?.of?.(hdrCountry) || hdrCountry;
        return { ip, locationName: fullName, countryCode: hdrCountry, city: null, region: null };
    }

    return {
        ip,
        locationName: "Unknown",
        countryCode: null,
        city: null,
        region: null,
    };
}

/**
 * Normalize OS / App platform to clean executive labels:
 * Windows, Mac, iOS, Android, Linux, Chrome OS (plus future native app headers).
 */
export function detectAppPlatform(userAgent = "", headers = null, existingDeviceInfo = null) {
    const explicitApp =
        headers?.get?.("x-motorx-platform") ||
        headers?.get?.("x-app-platform") ||
        null;
    const appVersion =
        headers?.get?.("x-motorx-app-version") ||
        headers?.get?.("x-app-version") ||
        null;

    if (explicitApp) {
        const clean = explicitApp.trim();
        if (/ios|iphone|ipad/i.test(clean)) {
            return { platform: "iOS", browser: null, appVersion, isNativeApp: true };
        }
        if (/android/i.test(clean)) {
            return { platform: "Android", browser: null, appVersion, isNativeApp: true };
        }
        if (/mac/i.test(clean)) {
            return { platform: "Mac", browser: null, appVersion, isNativeApp: true };
        }
        if (/win/i.test(clean)) {
            return { platform: "Windows", browser: null, appVersion, isNativeApp: true };
        }
        return { platform: clean, browser: null, appVersion, isNativeApp: true };
    }

    const ua = typeof userAgent === "string" ? userAgent : "";

    let parsedDevice = existingDeviceInfo;
    if (typeof parsedDevice === "string") {
        try {
            parsedDevice = JSON.parse(parsedDevice);
        } catch {
            parsedDevice = null;
        }
    }

    let browser = null;
    if (/edg\//i.test(ua)) browser = "Edge";
    else if (/opr\//i.test(ua) || /opera/i.test(ua)) browser = "Opera";
    else if (/chrome|crios/i.test(ua)) browser = "Chrome";
    else if (/firefox|fxios/i.test(ua)) browser = "Firefox";
    else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) browser = "Safari";
    else if (parsedDevice?.browser && parsedDevice.browser !== "Unknown") {
        browser = parsedDevice.browser;
    }

    const chPlatform = (headers?.get?.("sec-ch-ua-platform") || "").replace(/"/g, "").trim();
    if (chPlatform) {
        if (/windows/i.test(chPlatform)) return { platform: "Windows", browser, appVersion, isNativeApp: false };
        if (/macos|mac os|mac/i.test(chPlatform)) return { platform: "Mac", browser, appVersion, isNativeApp: false };
        if (/android/i.test(chPlatform)) return { platform: "Android", browser, appVersion, isNativeApp: false };
        if (/ios/i.test(chPlatform)) return { platform: "iOS", browser, appVersion, isNativeApp: false };
        if (/chrome os|cros/i.test(chPlatform)) return { platform: "Chrome OS", browser, appVersion, isNativeApp: false };
        if (/linux/i.test(chPlatform)) return { platform: "Linux", browser, appVersion, isNativeApp: false };
    }

    if (ua) {
        if (/iphone|ipad|ipod|cfnetwork.*darwin/i.test(ua)) {
            return { platform: "iOS", browser, appVersion, isNativeApp: false };
        }
        if (/android/i.test(ua)) {
            return { platform: "Android", browser, appVersion, isNativeApp: false };
        }
        if (/windows/i.test(ua)) {
            return { platform: "Windows", browser, appVersion, isNativeApp: false };
        }
        if (/macintosh|mac os x|macintel/i.test(ua)) {
            return { platform: "Mac", browser, appVersion, isNativeApp: false };
        }
        if (/cros/i.test(ua)) {
            return { platform: "Chrome OS", browser, appVersion, isNativeApp: false };
        }
        if (/linux/i.test(ua)) {
            return { platform: "Linux", browser, appVersion, isNativeApp: false };
        }
    }

    const storedOs = parsedDevice?.os || "";
    if (storedOs && storedOs !== "Unknown") {
        if (/windows/i.test(storedOs)) return { platform: "Windows", browser, appVersion, isNativeApp: false };
        if (/mac/i.test(storedOs)) return { platform: "Mac", browser, appVersion, isNativeApp: false };
        if (/ios/i.test(storedOs)) return { platform: "iOS", browser, appVersion, isNativeApp: false };
        if (/android/i.test(storedOs)) return { platform: "Android", browser, appVersion, isNativeApp: false };
        if (/linux/i.test(storedOs)) return { platform: "Linux", browser, appVersion, isNativeApp: false };
        if (/chrome os/i.test(storedOs)) return { platform: "Chrome OS", browser, appVersion, isNativeApp: false };
        return { platform: storedOs, browser, appVersion, isNativeApp: false };
    }

    return { platform: "Web", browser, appVersion, isNativeApp: false };
}
