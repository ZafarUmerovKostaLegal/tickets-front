export type OutgoingLetterDocxEditorHandle = {
    save: () => Promise<ArrayBuffer | null>;
    load: (bytes: Uint8Array) => void;
    focus: () => void;
};
