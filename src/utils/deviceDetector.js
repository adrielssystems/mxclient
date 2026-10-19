/**
 * Utility to parse User-Agent headers into structured device information.
 */
export function parseUserAgent(userAgentString) {
    if (!userAgentString || typeof userAgentString !== 'string') {
        return {
            deviceType: 'unknown',
            os: 'Unknown',
            browser: 'Unknown',
            isMobile: false
        };
    }

    const ua = userAgentString;
    let deviceType = 'desktop';
    let isMobile = false;

    // Detect Device Type
    if (/tablet|ipad|playbook|silk/i.test(ua)) {
        deviceType = 'tablet';
        isMobile = true;
    } else if (/mobile|iphone|ipod|android.*mobile|blackberry|iemobile|opera mini/i.test(ua)) {
        deviceType = 'mobile';
        isMobile = true;
    }

    // Detect OS
    let os = 'Unknown';
    if (/windows phone/i.test(ua)) os = 'Windows Phone';
    else if (/windows nt 10/i.test(ua)) os = 'Windows 10/11';
    else if (/windows nt 6\.3/i.test(ua)) os = 'Windows 8.1';
    else if (/windows nt 6\.1/i.test(ua)) os = 'Windows 7';
    else if (/windows/i.test(ua)) os = 'Windows';
    else if (/android/i.test(ua)) os = 'Android';
    else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
    else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
    else if (/linux/i.test(ua)) os = 'Linux';
    else if (/cros/i.test(ua)) os = 'Chrome OS';

    // Detect Browser
    let browser = 'Unknown';
    if (/edg\//i.test(ua)) browser = 'Microsoft Edge';
    else if (/opr\//i.test(ua) || /opera/i.test(ua)) browser = 'Opera';
    else if (/chrome|crios/i.test(ua)) browser = 'Chrome';
    else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
    else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) browser = 'Safari';
    else if (/trident|msie/i.test(ua)) browser = 'Internet Explorer';

    return {
        deviceType,
        os,
        browser,
        isMobile
    };
}
