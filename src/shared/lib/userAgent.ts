/** Human-readable device from a User-Agent string (for the profile → Devices list). */
export type DeviceKind = 'phone' | 'tablet' | 'desktop';

export type DeviceInfo = { browser: string; os: string; kind: DeviceKind };

export function describeUserAgent(ua: string): DeviceInfo {
    const s = ua || '';
    let os = '';
    if (/iPhone/.test(s))
        os = 'iPhone';
    else if (/iPad/.test(s) || (/Macintosh/.test(s) && /Mobile/.test(s)))
        os = 'iPad';
    else if (/Android/.test(s))
        os = 'Android';
    else if (/Windows NT/.test(s))
        os = 'Windows';
    else if (/Mac OS X|Macintosh/.test(s))
        os = 'macOS';
    else if (/CrOS/.test(s))
        os = 'ChromeOS';
    else if (/Linux/.test(s))
        os = 'Linux';

    let browser = '';
    if (/Edg(e|A|iOS)?\//.test(s))
        browser = 'Edge';
    else if (/OPR\/|Opera/.test(s))
        browser = 'Opera';
    else if (/YaBrowser\//.test(s))
        browser = 'Яндекс Браузер';
    else if (/Firefox\/|FxiOS\//.test(s))
        browser = 'Firefox';
    else if (/Chrome\/|CriOS\//.test(s))
        browser = 'Chrome';
    else if (/Safari\//.test(s))
        browser = 'Safari';
    else if (/Outlook|Microsoft Office/.test(s))
        browser = 'Outlook';

    const kind: DeviceKind = os === 'iPad' || (/Android/.test(s) && !/Mobile/.test(s))
        ? 'tablet'
        : os === 'iPhone' || /Mobile/.test(s)
            ? 'phone'
            : 'desktop';
    return { browser, os, kind };
}
