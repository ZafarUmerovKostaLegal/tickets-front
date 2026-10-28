const STORAGE_KEY_V1 = 'tt_firm_banking_details_v1';
const STORAGE_KEY = 'tt_firm_banking_profiles_v2';
export const EMPTY_FIRM_BANKING_DETAILS = {
    tin: '',
    bankName: '',
    bankAddress: '',
    accountCurrency: 'EUR',
    accountNumber: '',
    bankCode: '',
    swift: '',
    correspondentBank: '',
    correspondentAccount: '',
};
function clean(v) {
    return typeof v === 'string' ? v.trim() : '';
}
function newId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
        return crypto.randomUUID();
    return `bank_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
function normalizeDetails(raw) {
    const currency = clean(raw?.accountCurrency).toUpperCase() || EMPTY_FIRM_BANKING_DETAILS.accountCurrency;
    return {
        tin: clean(raw?.tin),
        bankName: clean(raw?.bankName),
        bankAddress: clean(raw?.bankAddress),
        accountCurrency: currency,
        accountNumber: clean(raw?.accountNumber),
        bankCode: clean(raw?.bankCode),
        swift: clean(raw?.swift),
        correspondentBank: clean(raw?.correspondentBank),
        correspondentAccount: clean(raw?.correspondentAccount),
    };
}
function normalizeProfile(raw) {
    const details = normalizeDetails(raw);
    return {
        id: clean(raw.id) || newId(),
        title: clean(raw.title),
        isDefault: Boolean(raw.isDefault),
        ...details,
    };
}
function ensureOneDefault(list) {
    if (list.length === 0)
        return list;
    const defaults = list.filter((p) => p.isDefault);
    if (defaults.length === 1)
        return list;
    return list.map((p, i) => ({ ...p, isDefault: i === 0 }));
}
function migrateFromV1() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY_V1);
        if (!raw)
            return [];
        const parsed = JSON.parse(raw);
        const details = normalizeDetails(parsed);
        const hasAny = Object.entries(details).some(([k, v]) => k !== 'accountCurrency' && Boolean(String(v).trim()));
        if (!hasAny && details.accountCurrency === 'EUR')
            return [];
        return [{
                id: newId(),
                title: details.accountCurrency || 'EUR',
                isDefault: true,
                ...details,
            }];
    }
    catch {
        return [];
    }
}
export function listFirmBankingProfiles() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            const migrated = migrateFromV1();
            if (migrated.length)
                setFirmBankingProfiles(migrated);
            return migrated;
        }
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed))
            return [];
        const list = ensureOneDefault(parsed.map((item) => normalizeProfile(item)));
        return list;
    }
    catch {
        return [];
    }
}
export function setFirmBankingProfiles(profiles) {
    const list = ensureOneDefault(profiles.map((p) => normalizeProfile(p)));
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
        localStorage.removeItem(STORAGE_KEY_V1);
    }
    catch {
        // ignore
    }
}
export function getDefaultFirmBankingProfile(profiles = listFirmBankingProfiles()) {
    if (!profiles.length)
        return null;
    return profiles.find((p) => p.isDefault) ?? profiles[0] ?? null;
}
/** @deprecated Prefer listFirmBankingProfiles / getDefaultFirmBankingProfile. */
export function getFirmBankingDetails() {
    const d = getDefaultFirmBankingProfile();
    if (!d)
        return { ...EMPTY_FIRM_BANKING_DETAILS };
    const { id: _id, title: _title, isDefault: _def, ...details } = d;
    return details;
}
/** @deprecated Prefer setFirmBankingProfiles. */
export function setFirmBankingDetails(value) {
    const existing = listFirmBankingProfiles();
    const def = getDefaultFirmBankingProfile(existing);
    const next = normalizeProfile({
        ...(def ?? { id: newId(), title: value.accountCurrency || 'EUR', isDefault: true }),
        ...normalizeDetails(value),
        isDefault: true,
    });
    const others = existing.filter((p) => p.id !== next.id).map((p) => ({ ...p, isDefault: false }));
    setFirmBankingProfiles([next, ...others]);
}
export function createEmptyFirmBankingProfile(partial) {
    return normalizeProfile({
        id: newId(),
        title: clean(partial?.title),
        isDefault: false,
        ...EMPTY_FIRM_BANKING_DETAILS,
        ...partial,
    });
}
export function upsertFirmBankingProfile(profile, options) {
    const list = listFirmBankingProfiles();
    const next = normalizeProfile(profile);
    const makeDefault = options?.makeDefault ?? next.isDefault;
    let found = false;
    const mapped = list.map((p) => {
        if (p.id !== next.id)
            return makeDefault ? { ...p, isDefault: false } : p;
        found = true;
        return { ...next, isDefault: makeDefault || p.isDefault };
    });
    if (!found)
        mapped.push({ ...next, isDefault: makeDefault || mapped.length === 0 });
    const out = ensureOneDefault(mapped);
    setFirmBankingProfiles(out);
    return out;
}
export function deleteFirmBankingProfile(id) {
    const out = ensureOneDefault(listFirmBankingProfiles().filter((p) => p.id !== id));
    setFirmBankingProfiles(out);
    return out;
}
export function setDefaultFirmBankingProfile(id) {
    const out = listFirmBankingProfiles().map((p) => ({ ...p, isDefault: p.id === id }));
    const ensured = ensureOneDefault(out);
    setFirmBankingProfiles(ensured);
    return ensured;
}
export function profileDisplayTitle(profile, untitledLabel) {
    if (profile.title.trim())
        return profile.title.trim();
    if (profile.bankName.trim() && profile.accountCurrency.trim())
        return `${profile.bankName.trim()} · ${profile.accountCurrency.trim()}`;
    if (profile.bankName.trim())
        return profile.bankName.trim();
    if (profile.accountCurrency.trim())
        return profile.accountCurrency.trim();
    return untitledLabel;
}
/** Defaults for invoice legal masthead — empty strings stay unset so placeholders show. */
export function firmBankingToLegalOverrides(details = getDefaultFirmBankingProfile()) {
    if (!details)
        return {};
    const orNull = (v) => (v.trim() ? v.trim() : null);
    return {
        tin: orNull(details.tin),
        bankName: orNull(details.bankName),
        bankAddress: orNull(details.bankAddress),
        accountCurrency: orNull(details.accountCurrency),
        accountNumber: orNull(details.accountNumber),
        bankCode: orNull(details.bankCode),
        swift: orNull(details.swift),
        correspondentBank: orNull(details.correspondentBank),
        correspondentAccount: orNull(details.correspondentAccount),
    };
}
export function pickFirmBankingProfileForCurrency(profiles, currency) {
    if (!profiles.length)
        return null;
    const cur = clean(currency).toUpperCase();
    if (cur) {
        const match = profiles.find((p) => p.accountCurrency.toUpperCase() === cur);
        if (match)
            return match;
    }
    return getDefaultFirmBankingProfile(profiles);
}
/** Merge bank fields from a profile into legal overrides (keeps invoice-number / dates / etc.). */
export function applyFirmBankingProfileToLegalOverrides(prev, profile) {
    const bank = firmBankingToLegalOverrides(profile);
    return {
        ...prev,
        tin: bank.tin ?? null,
        bankName: bank.bankName ?? null,
        bankAddress: bank.bankAddress ?? null,
        accountCurrency: bank.accountCurrency ?? null,
        accountNumber: bank.accountNumber ?? null,
        bankCode: bank.bankCode ?? null,
        swift: bank.swift ?? null,
        correspondentBank: bank.correspondentBank ?? null,
        correspondentAccount: bank.correspondentAccount ?? null,
    };
}
