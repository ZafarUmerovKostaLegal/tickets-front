export type OutgoingLetterSelectionSnapshot = {
    text: string;
    collapsed: boolean;
    /** JSON-serialized DocRange when available. */
    selectionJson: string | null;
};

export type OutgoingLetterDocxEditorHandle = {
    save: () => Promise<ArrayBuffer | null>;
    load: (bytes: Uint8Array) => void;
    focus: () => void;
    getSelectionSnapshot: () => OutgoingLetterSelectionSnapshot;
    /** Best-effort restore of a previously captured DocRange. */
    restoreSelection: (selectionJson: string) => boolean;
};
