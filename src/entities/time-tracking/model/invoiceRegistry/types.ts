export type InvoiceRegistryYearId =
    | '2026'
    | '2026-system'
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
    label: string;
    wide?: boolean;
    editor?: 'text' | 'status' | 'pdf' | 'note';
};

export type InvoiceRegistrySheetMeta = {
    year: InvoiceRegistryYearId;
    sheetName: string;
    columns: InvoiceRegistryColumnDef[];
};
