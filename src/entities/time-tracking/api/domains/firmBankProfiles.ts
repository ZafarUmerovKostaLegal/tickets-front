import { apiFetch } from '@shared/api';
import {
    createEmptyFirmBankingProfile,
    listFirmBankingProfiles,
    pickFirmBankingProfileForCurrency,
    setFirmBankingProfiles,
    type FirmBankingProfile,
} from '@entities/time-tracking/lib/firmBankingDetailsStorage';
import { throwIfNotOk } from './httpShared';

export { pickFirmBankingProfileForCurrency };

const BASE = '/api/v1/time-tracking/firm-bank-profiles';
const MIGRATION_FLAG = 'tt_firm_banking_server_synced_v1';

function clean(v: unknown): string {
    return typeof v === 'string' ? v.trim() : '';
}

function normalizeProfile(raw: unknown): FirmBankingProfile | null {
    if (raw == null || typeof raw !== 'object')
        return null;
    const o = raw as Record<string, unknown>;
    const id = clean(o.id);
    if (!id)
        return null;
    const currency = clean(o.accountCurrency ?? o.account_currency).toUpperCase() || 'EUR';
    return {
        id,
        title: clean(o.title),
        isDefault: Boolean(o.isDefault ?? o.is_default),
        tin: clean(o.tin),
        bankName: clean(o.bankName ?? o.bank_name),
        bankAddress: clean(o.bankAddress ?? o.bank_address),
        accountCurrency: currency,
        accountNumber: clean(o.accountNumber ?? o.account_number),
        bankCode: clean(o.bankCode ?? o.bank_code),
        swift: clean(o.swift),
        correspondentBank: clean(o.correspondentBank ?? o.correspondent_bank),
        correspondentAccount: clean(o.correspondentAccount ?? o.correspondent_account),
    };
}

function parseItems(raw: unknown): FirmBankingProfile[] {
    const arr = raw && typeof raw === 'object' && Array.isArray((raw as { items?: unknown }).items)
        ? (raw as { items: unknown[] }).items
        : Array.isArray(raw)
            ? raw
            : [];
    const items = arr.map(normalizeProfile).filter((p): p is FirmBankingProfile => p != null);
    if (items.length === 0)
        return items;
    const defaults = items.filter((p) => p.isDefault);
    if (defaults.length === 1)
        return items;
    return items.map((p, i) => ({ ...p, isDefault: i === 0 }));
}

function cacheProfiles(items: FirmBankingProfile[]): FirmBankingProfile[] {
    setFirmBankingProfiles(items);
    return items;
}

export async function listFirmBankProfiles(): Promise<FirmBankingProfile[]> {
    const res = await apiFetch(BASE);
    await throwIfNotOk(res);
    return parseItems(await res.json());
}

export async function createFirmBankProfile(
    profile: FirmBankingProfile,
    options?: { makeDefault?: boolean },
): Promise<FirmBankingProfile> {
    const makeDefault = options?.makeDefault ?? profile.isDefault;
    const res = await apiFetch(BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            id: profile.id,
            title: profile.title,
            isDefault: makeDefault,
            tin: profile.tin,
            bankName: profile.bankName,
            bankAddress: profile.bankAddress,
            accountCurrency: profile.accountCurrency,
            accountNumber: profile.accountNumber,
            bankCode: profile.bankCode,
            swift: profile.swift,
            correspondentBank: profile.correspondentBank,
            correspondentAccount: profile.correspondentAccount,
        }),
    });
    await throwIfNotOk(res);
    const row = normalizeProfile(await res.json());
    if (!row)
        throw new Error('Некорректный ответ сервера');
    return row;
}

export async function patchFirmBankProfile(
    profileId: string,
    patch: Partial<FirmBankingProfile> & { isDefault?: boolean },
): Promise<FirmBankingProfile> {
    const body: Record<string, unknown> = {};
    if (patch.title !== undefined)
        body.title = patch.title;
    if (patch.tin !== undefined)
        body.tin = patch.tin;
    if (patch.bankName !== undefined)
        body.bankName = patch.bankName;
    if (patch.bankAddress !== undefined)
        body.bankAddress = patch.bankAddress;
    if (patch.accountCurrency !== undefined)
        body.accountCurrency = patch.accountCurrency;
    if (patch.accountNumber !== undefined)
        body.accountNumber = patch.accountNumber;
    if (patch.bankCode !== undefined)
        body.bankCode = patch.bankCode;
    if (patch.swift !== undefined)
        body.swift = patch.swift;
    if (patch.correspondentBank !== undefined)
        body.correspondentBank = patch.correspondentBank;
    if (patch.correspondentAccount !== undefined)
        body.correspondentAccount = patch.correspondentAccount;
    if (patch.isDefault !== undefined)
        body.isDefault = patch.isDefault;
    const res = await apiFetch(`${BASE}/${encodeURIComponent(profileId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    await throwIfNotOk(res);
    const row = normalizeProfile(await res.json());
    if (!row)
        throw new Error('Некорректный ответ сервера');
    return row;
}

export async function setDefaultFirmBankProfile(profileId: string): Promise<FirmBankingProfile> {
    const res = await apiFetch(`${BASE}/${encodeURIComponent(profileId)}/set-default`, {
        method: 'POST',
    });
    await throwIfNotOk(res);
    const row = normalizeProfile(await res.json());
    if (!row)
        throw new Error('Некорректный ответ сервера');
    return row;
}

export async function deleteFirmBankProfile(profileId: string): Promise<void> {
    const res = await apiFetch(`${BASE}/${encodeURIComponent(profileId)}`, {
        method: 'DELETE',
    });
    await throwIfNotOk(res);
}

export async function replaceFirmBankProfiles(items: FirmBankingProfile[]): Promise<FirmBankingProfile[]> {
    const res = await apiFetch(`${BASE}/replace`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            items: items.map((p, idx) => ({
                id: p.id,
                title: p.title,
                isDefault: p.isDefault,
                tin: p.tin,
                bankName: p.bankName,
                bankAddress: p.bankAddress,
                accountCurrency: p.accountCurrency,
                accountNumber: p.accountNumber,
                bankCode: p.bankCode,
                swift: p.swift,
                correspondentBank: p.correspondentBank,
                correspondentAccount: p.correspondentAccount,
                sortOrder: idx,
            })),
        }),
    });
    await throwIfNotOk(res);
    return parseItems(await res.json());
}

/**
 * Load profiles from API; if server is empty and localStorage has data, migrate once.
 * Falls back to localStorage when the API is unavailable.
 */
export async function loadFirmBankingProfiles(options?: {
    migrateLocal?: boolean;
}): Promise<FirmBankingProfile[]> {
    const migrateLocal = options?.migrateLocal !== false;
    try {
        const remote = await listFirmBankProfiles();
        if (remote.length > 0) {
            try {
                localStorage.setItem(MIGRATION_FLAG, '1');
            }
            catch {
                // ignore
            }
            return cacheProfiles(remote);
        }
        const local = listFirmBankingProfiles();
        if (!migrateLocal || local.length === 0)
            return cacheProfiles([]);
        let alreadyMigrated = false;
        try {
            alreadyMigrated = localStorage.getItem(MIGRATION_FLAG) === '1';
        }
        catch {
            alreadyMigrated = false;
        }
        if (alreadyMigrated)
            return cacheProfiles([]);
        try {
            const migrated = await replaceFirmBankProfiles(local);
            try {
                localStorage.setItem(MIGRATION_FLAG, '1');
            }
            catch {
                // ignore
            }
            return cacheProfiles(migrated);
        }
        catch {
            return local;
        }
    }
    catch {
        return listFirmBankingProfiles();
    }
}

export { createEmptyFirmBankingProfile };
