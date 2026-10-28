const STUB_AUTH_USER_EMAIL = /^auth-user-\d+@tt\.local$/i;
export function isStubAuthUserEmail(value) {
    return STUB_AUTH_USER_EMAIL.test(String(value ?? '').trim());
}
export function firstNonStubUserText(...values) {
    for (const value of values) {
        const text = value?.trim();
        if (text && !isStubAuthUserEmail(text))
            return text;
    }
    return undefined;
}
/** Never show TT stub emails (`auth-user-{id}@tt.local`) as a person label. */
export function pickUserDisplayLabel(displayName, email, fallbackId, fallbackTemplate = 'Пользователь {id}') {
    return firstNonStubUserText(displayName, email)
        ?? fallbackTemplate.replace('{id}', String(fallbackId));
}
/** Catalog (hydrated TT) → colleagues → workload member; never a stub email. */
export function resolveTimeUserDisplayName(sources, fallbackId, fallbackTemplate = 'Пользователь {id}') {
    return pickUserDisplayLabel(firstNonStubUserText(sources.catalog?.display_name, sources.colleague?.display_name, sources.member?.display_name), firstNonStubUserText(sources.catalog?.email, sources.colleague?.email, sources.member?.email), fallbackId, fallbackTemplate);
}
