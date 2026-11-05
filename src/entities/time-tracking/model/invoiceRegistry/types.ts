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
    /** Excel header (RU) — shown 1:1 in the table */
    label: string;
    wide?: boolean;
    /** Dropdown, a PDF download, or a partner note edited in a dialog. */
    editor?: 'text' | 'status' | 'pdf' | 'note';
};

export type InvoiceRegistrySheetMeta = {
    year: InvoiceRegistryYearId;
    sheetName: string;
    columns: InvoiceRegistryColumnDef[];
};
