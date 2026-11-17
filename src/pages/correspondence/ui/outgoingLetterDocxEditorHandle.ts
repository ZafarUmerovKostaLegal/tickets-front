export type OutgoingLetterSelectionSnapshot = {
    text: string;
    collapsed: boolean;
    selectionJson: string | null;
};

export type OutgoingLetterDocxEditorHandle = {
    save: () => Promise<ArrayBuffer | null>;
    load: (bytes: Uint8Array) => void;
    focus: () => void;
    getSelectionSnapshot: () => OutgoingLetterSelectionSnapshot;
    restoreSelection: (selectionJson: string) => boolean;
};
