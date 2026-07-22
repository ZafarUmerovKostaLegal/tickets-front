import type { InvoiceLegalPageOverrides } from '@pages/invoice-preview/lib/invoiceLegalPageModel';

const STORAGE_KEY = 'tt_firm_banking_details_v1';

export type FirmBankingDetails = {
    tin: string;
    bankName: string;
    bankAddress: string;
    accountCurrency: string;
    accountNumber: string;
    bankCode: string;
    swift: string;
    correspondentBank: string;
    correspondentAccount: string;
};

export const EMPTY_FIRM_BANKING_DETAILS: FirmBankingDetails = {
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

function clean(v: unknown): string {
    return typeof v === 'string' ? v.trim() : '';
}

export function getFirmBankingDetails(): FirmBankingDetails {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw)
            return { ...EMPTY_FIRM_BANKING_DETAILS };
        const parsed = JSON.parse(raw) as Partial<FirmBankingDetails>;
        const currency = clean(parsed.accountCurrency).toUpperCase() || EMPTY_FIRM_BANKING_DETAILS.accountCurrency;
        return {
            tin: clean(parsed.tin),
            bankName: clean(parsed.bankName),
            bankAddress: clean(parsed.bankAddress),
            accountCurrency: currency,
            accountNumber: clean(parsed.accountNumber),
            bankCode: clean(parsed.bankCode),
            swift: clean(parsed.swift),
            correspondentBank: clean(parsed.correspondentBank),
            correspondentAccount: clean(parsed.correspondentAccount),
        };
    }
    catch {
        return { ...EMPTY_FIRM_BANKING_DETAILS };
    }
}

export function setFirmBankingDetails(value: FirmBankingDetails): void {
    const next: FirmBankingDetails = {
        tin: value.tin.trim(),
        bankName: value.bankName.trim(),
        bankAddress: value.bankAddress.trim(),
        accountCurrency: (value.accountCurrency.trim().toUpperCase() || 'EUR'),
        accountNumber: value.accountNumber.trim(),
        bankCode: value.bankCode.trim(),
        swift: value.swift.trim(),
        correspondentBank: value.correspondentBank.trim(),
        correspondentAccount: value.correspondentAccount.trim(),
    };
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
    catch {
        // ignore quota / private mode
    }
}

/** Defaults for invoice legal masthead — empty strings stay unset so placeholders show. */
export function firmBankingToLegalOverrides(details: FirmBankingDetails = getFirmBankingDetails()): InvoiceLegalPageOverrides {
    const orNull = (v: string) => (v.trim() ? v.trim() : null);
    return {
        tin: orNull(details.tin),
        bankName: orNull(details.bankName),
        bankAddress: orNull(details.bankAddress),
        accountNumber: orNull(details.accountNumber),
        bankCode: orNull(details.bankCode),
        swift: orNull(details.swift),
        correspondentBank: orNull(details.correspondentBank),
        correspondentAccount: orNull(details.correspondentAccount),
    };
}
