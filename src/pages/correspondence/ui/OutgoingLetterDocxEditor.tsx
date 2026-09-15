import { forwardRef, useImperativeHandle, useRef } from 'react';
import { DocxEditor, useFonts, type DocxEditorRef } from '@docx-editor.dev/react';
import { packagedFonts } from '@docx-editor.dev/fonts';
import '@docx-editor.dev/core/styles/editor.css';
import '@docx-editor.dev/react/styles.css';
import type { OutgoingLetterDocxEditorHandle } from './outgoingLetterDocxEditorHandle';

export type { OutgoingLetterDocxEditorHandle } from './outgoingLetterDocxEditorHandle';

type Props = {
    documentBytes: Uint8Array;
    title: string;
    /** Remount key when the blank template is rebuilt. */
    templateKey: string;
    disabled?: boolean;
    onReady?: () => void;
    onChange?: () => void;
    onSaveRequest?: () => void;
};

/**
 * In-app WYSIWYG .docx surface (replaces Word Online for outgoing letters).
 * Must render client-side only — text measurement needs the DOM.
 */
export const OutgoingLetterDocxEditor = forwardRef<OutgoingLetterDocxEditorHandle, Props>(
    function OutgoingLetterDocxEditor(
        { documentBytes, title, templateKey, disabled, onReady, onChange, onSaveRequest },
        ref,
    ) {
        const innerRef = useRef<DocxEditorRef>(null);
        const fonts = useFonts(packagedFonts());

        useImperativeHandle(ref, () => ({
            save: async () => {
                const buf = await innerRef.current?.save();
                return buf ?? null;
            },
            load: (bytes) => {
                innerRef.current?.load(bytes);
            },
            focus: () => {
                innerRef.current?.focus();
            },
        }), []);

        return (
            <div className={`corr-docx-editor${disabled ? ' corr-docx-editor--disabled' : ''}`}>
                <DocxEditor
                    key={templateKey}
                    ref={innerRef}
                    document={documentBytes}
                    fonts={fonts}
                    mode={disabled ? 'view' : 'edit'}
                    locale="ru-RU"
                    title={title || 'Исходящее письмо'}
                    chrome
                    colorMode="light"
                    menu
                    navigation={false}
                    rulers
                    onReady={() => {
                        onReady?.();
                    }}
                    onChange={() => {
                        onChange?.();
                    }}
                    onSave={() => {
                        onSaveRequest?.();
                    }}
                />
            </div>
        );
    },
);
