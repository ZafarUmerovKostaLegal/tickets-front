import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import {
    DocxEditor,
    runToolbarCommand,
    useFonts,
    type DocxEditorRef,
    type Editor,
} from '@docx-editor.dev/react';
import '@docx-editor.dev/core/styles/editor.css';
import '@docx-editor.dev/react/styles.css';
import type { OutgoingLetterDocxEditorHandle } from './outgoingLetterDocxEditorHandle';
import { outgoingLetterEditorFonts } from '../lib/outgoingLetterEditorFonts';
import { docxEditorRu } from '../lib/docxEditorRu';

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

function isFormFieldTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Element))
        return false;
    return Boolean(target.closest('input, textarea, select'));
}

/**
 * Packaged chrome binds Ctrl/Cmd shortcuts via `event.key` ("b"/"i"/…), which breaks on
 * non-Latin keyboard layouts (RU/etc.). Bridge the same chords via physical `event.code`.
 */
function bindLayoutSafeEditorHotkeys(
    root: HTMLElement,
    getEditor: () => Editor | null,
    onSaveRequest?: () => void,
): () => void {
    const onKeyDown = (event: KeyboardEvent) => {
        if (!(event.ctrlKey || event.metaKey) || event.altKey)
            return;
        if (event.defaultPrevented)
            return;

        const active = document.activeElement;
        const target = event.target;
        const inEditorRoot = root.contains(target as Node) || (active instanceof Node && root.contains(active));
        if (!inEditorRoot)
            return;
        // Title/search fields inside packaged chrome — leave browser shortcuts alone.
        if (isFormFieldTarget(target) || isFormFieldTarget(active))
            return;

        const editor = getEditor();
        if (!editor)
            return;

        const code = event.code;
        let handled = false;

        switch (code) {
            case 'KeyB':
                if (!event.shiftKey)
                    handled = runToolbarCommand(editor, 'text.bold').ok;
                break;
            case 'KeyI':
                if (!event.shiftKey)
                    handled = runToolbarCommand(editor, 'text.italic').ok;
                break;
            case 'KeyU':
                if (!event.shiftKey)
                    handled = runToolbarCommand(editor, 'text.underline').ok;
                break;
            case 'KeyZ':
                handled = event.shiftKey
                    ? editor.exec({ type: 'redo' }).ok
                    : editor.exec({ type: 'undo' }).ok;
                break;
            case 'KeyY':
                if (!event.shiftKey)
                    handled = editor.exec({ type: 'redo' }).ok;
                break;
            case 'KeyS':
                if (!event.shiftKey && onSaveRequest) {
                    event.preventDefault();
                    event.stopPropagation();
                    onSaveRequest();
                    return;
                }
                break;
            case 'KeyL':
                if (!event.shiftKey)
                    handled = runToolbarCommand(editor, 'alignment.left').ok;
                break;
            case 'KeyE':
                if (!event.shiftKey)
                    handled = runToolbarCommand(editor, 'alignment.center').ok;
                break;
            case 'KeyR':
                if (!event.shiftKey)
                    handled = runToolbarCommand(editor, 'alignment.right').ok;
                break;
            case 'KeyJ':
                if (!event.shiftKey)
                    handled = runToolbarCommand(editor, 'alignment.justify').ok;
                break;
            default:
                break;
        }

        if (handled) {
            event.preventDefault();
            event.stopPropagation();
        }
    };

    // Capture phase: win over layout-sensitive `event.key` handlers and keep focus path stable.
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
}

/**
 * In-app WYSIWYG .docx surface (replaces Word Online for outgoing letters).
 * Must render client-side only — text measurement needs the DOM.
 */
export const OutgoingLetterDocxEditor = forwardRef<OutgoingLetterDocxEditorHandle, Props>(
    function OutgoingLetterDocxEditor(
        { documentBytes, title, templateKey, disabled, onReady, onChange, onSaveRequest },
        ref,
    ) {
        const rootRef = useRef<HTMLDivElement>(null);
        const innerRef = useRef<DocxEditorRef>(null);
        const fonts = useFonts(outgoingLetterEditorFonts);
        const onSaveRequestRef = useRef(onSaveRequest);
        onSaveRequestRef.current = onSaveRequest;

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

        useEffect(() => {
            if (disabled)
                return;
            const root = rootRef.current;
            if (!root)
                return;
            return bindLayoutSafeEditorHotkeys(
                root,
                () => innerRef.current?.getEditor() ?? null,
                () => { onSaveRequestRef.current?.(); },
            );
        }, [disabled, templateKey]);

        return (
            <div
                ref={rootRef}
                className={`corr-docx-editor${disabled ? ' corr-docx-editor--disabled' : ''}`}
            >
                <DocxEditor
                    key={templateKey}
                    ref={innerRef}
                    document={documentBytes}
                    fonts={fonts}
                    mode={disabled ? 'view' : 'edit'}
                    locale="ru-RU"
                    i18n={docxEditorRu}
                    title={title || 'Исходящее письмо'}
                    chrome
                    colorMode="light"
                    menu
                    navigation={false}
                    rulers
                    onReady={() => {
                        // Ensure caret/hotkeys land in the document, not page chrome.
                        requestAnimationFrame(() => {
                            innerRef.current?.focus();
                        });
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
