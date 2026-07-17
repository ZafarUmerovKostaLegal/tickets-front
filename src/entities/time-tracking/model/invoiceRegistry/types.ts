export type InvoiceRegistryYearId =
    | '2026'
    | '2025'
    | '2024'
    | '2023'
    | '2022'
    | '2021'
    | '2020'
    | 'checklist';

export type InvoiceRegistryRow = {
    id: string;
} & Record<string, string>;

export type InvoiceRegistryColumnDef = {
    key: string;
    /** Excel header (RU) — shown 1:1 in the table */
    label: string;
    wide?: boolean;
};

export type InvoiceRegistrySheetMeta = {
    year: InvoiceRegistryYearId;
    sheetName: string;
    columns: InvoiceRegistryColumnDef[];
};
