import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
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
    templateKey: string;
    disabled?: boolean;
    onReady?: () => void;
    onChange?: () => void;
    onSaveRequest?: () => void;
    onNewCommentRequest?: () => void;
};

function useAppColorMode(): 'light' | 'dark' {
    const [mode, setMode] = useState<'light' | 'dark'>(() => (
        typeof document !== 'undefined' && document.body.getAttribute('data-theme') === 'dark'
            ? 'dark'
            : 'light'
    ));

    useEffect(() => {
        const sync = () => {
            setMode(document.body.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
        };
        sync();
        const observer = new MutationObserver(sync);
        observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
        return () => observer.disconnect();
    }, []);

    return mode;
}

function isFormFieldTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Element))
        return false;
    return Boolean(target.closest('input, textarea, select'));
}


function bindLayoutSafeEditorHotkeys(
    root: HTMLElement,
    getEditor: () => Editor | null,
    onSaveRequest?: () => void,
    onNewCommentRequest?: () => void,
): () => void {
    const onKeyDown = (event: KeyboardEvent) => {
        // Word: Ctrl+Alt+M — new comment (works even when Alt is held).
        if ((event.ctrlKey || event.metaKey) && event.altKey && !event.shiftKey && event.code === 'KeyM') {
            if (event.defaultPrevented)
                return;
            const active = document.activeElement;
            const target = event.target;
            const inEditorRoot = root.contains(target as Node) || (active instanceof Node && root.contains(active));
            if (!inEditorRoot || !onNewCommentRequest)
                return;
            if (isFormFieldTarget(target) || isFormFieldTarget(active))
                return;
            event.preventDefault();
            event.stopPropagation();
            onNewCommentRequest();
            return;
        }

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

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
}

/**
 * In-app WYSIWYG .docx surface (replaces Word Online for outgoing letters).
 * Must render client-side only — text measurement needs the DOM.
 */
export const OutgoingLetterDocxEditor = forwardRef<OutgoingLetterDocxEditorHandle, Props>(
    function OutgoingLetterDocxEditor(
        { documentBytes, title, templateKey, disabled, onReady, onChange, onSaveRequest, onNewCommentRequest },
        ref,
    ) {
        const rootRef = useRef<HTMLDivElement>(null);
        const innerRef = useRef<DocxEditorRef>(null);
        const fonts = useFonts(outgoingLetterEditorFonts);
        const colorMode = useAppColorMode();
        const onSaveRequestRef = useRef(onSaveRequest);
        onSaveRequestRef.current = onSaveRequest;
        const onNewCommentRequestRef = useRef(onNewCommentRequest);
        onNewCommentRequestRef.current = onNewCommentRequest;

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
            getSelectionSnapshot: () => {
                const editor = innerRef.current?.getEditor();
                if (!editor) {
                    return { text: '', collapsed: true, selectionJson: null };
                }
                const snap = editor.snapshot();
                let text = '';
                try {
                    text = String(editor.query({ type: 'selectedText' }) ?? '')
                        .replace(/\u00a0/g, ' ')
                        .trim();
                }
                catch {
                    text = '';
                }
                let selectionJson: string | null = null;
                if (snap.selection && !snap.selectionCollapsed) {
                    try {
                        selectionJson = JSON.stringify(snap.selection);
                    }
                    catch {
                        selectionJson = null;
                    }
                }
                return {
                    text,
                    collapsed: Boolean(snap.selectionCollapsed) || !text,
                    selectionJson,
                };
            },
            restoreSelection: (selectionJson) => {
                const editor = innerRef.current?.getEditor();
                if (!editor || !selectionJson.trim())
                    return false;
                try {
                    const range = JSON.parse(selectionJson) as { from: unknown; to: unknown };
                    if (!range?.from || !range?.to)
                        return false;
                    const result = editor.exec({
                        type: 'setSelection',
                        range,
                    } as Parameters<Editor['exec']>[0]);
                    if (result.ok) {
                        innerRef.current?.focus();
                        return true;
                    }
                }
                catch {
                }
                return false;
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
                () => { onNewCommentRequestRef.current?.(); },
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
                    colorMode={colorMode}
                    menu
                    navigation={false}
                    rulers
                    onReady={() => {
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
