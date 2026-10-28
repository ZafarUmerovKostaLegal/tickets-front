import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, } from 'react';
import { letterBodyIsEmpty, ensureLetterEditorHtml, normalizeLetterBodyHtml, plainTextToLetterHtml, sanitizeLetterHtml, } from '../lib/correspondenceLetterHtml';
const LetterEditorContext = createContext(null);
const INDENT_STEP_PX = 36;
function getClosestBlock(node, root) {
    let cur = node;
    while (cur && cur !== root) {
        if (cur instanceof HTMLElement) {
            const tag = cur.tagName;
            if (tag === 'P' || tag === 'DIV' || tag === 'LI' || tag === 'H1' || tag === 'H2' || tag === 'H3' || tag === 'BLOCKQUOTE')
                return cur;
        }
        cur = cur.parentNode;
    }
    return null;
}
function readMarginLeftPx(el) {
    const inline = el.style.marginLeft;
    if (inline) {
        const n = Number.parseFloat(inline);
        if (Number.isFinite(n))
            return n;
    }
    return 0;
}
export function useLetterEditor() {
    const ctx = useContext(LetterEditorContext);
    if (!ctx)
        throw new Error('useLetterEditor must be used within CorrespondenceLetterEditorProvider');
    return ctx;
}
export function useLetterEditorOptional() {
    return useContext(LetterEditorContext);
}
export function CorrespondenceLetterEditorProvider({ value, editable = false, placeholder = 'Начните писать письмо…', onChange, children, }) {
    const editorId = useId();
    const editorRef = useRef(null);
    const lastEmittedRef = useRef(normalizeLetterBodyHtml(value));
    const [empty, setEmpty] = useState(() => letterBodyIsEmpty(value));
    const [active, setActive] = useState({});
    const syncFromProp = useCallback((next) => {
        const normalized = normalizeLetterBodyHtml(next);
        const el = editorRef.current;
        if (!el)
            return;
        // While typing, never rewrite DOM from props — that kills Enter / caret.
        if (document.activeElement === el)
            return;
        const seed = ensureLetterEditorHtml(normalized);
        if (seed === el.innerHTML)
            return;
        el.innerHTML = seed;
        lastEmittedRef.current = normalized;
        setEmpty(letterBodyIsEmpty(normalized));
    }, []);
    useEffect(() => {
        syncFromProp(value);
    }, [value, syncFromProp]);
    useEffect(() => {
        if (!editable)
            return;
        try {
            document.execCommand('defaultParagraphSeparator', false, 'p');
            document.execCommand('styleWithCSS', false, 'true');
        }
        catch {
            // ignore
        }
        const el = editorRef.current;
        if (el && !el.innerHTML.trim())
            el.innerHTML = '<p><br></p>';
    }, [editable]);
    const emitChange = useCallback(() => {
        const el = editorRef.current;
        if (!el)
            return;
        // Keep a seed paragraph so the next Enter still works after clearing.
        if (!el.innerHTML.trim() || el.innerHTML === '<br>')
            el.innerHTML = '<p><br></p>';
        const html = sanitizeLetterHtml(el.innerHTML);
        lastEmittedRef.current = html;
        setEmpty(letterBodyIsEmpty(html));
        onChange?.(html);
    }, [onChange]);
    const refreshActive = useCallback(() => {
        if (!editable || typeof document === 'undefined' || !document.queryCommandState)
            return;
        setActive({
            bold: document.queryCommandState('bold'),
            italic: document.queryCommandState('italic'),
            underline: document.queryCommandState('underline'),
            strikeThrough: document.queryCommandState('strikeThrough'),
            insertUnorderedList: document.queryCommandState('insertUnorderedList'),
            insertOrderedList: document.queryCommandState('insertOrderedList'),
            justifyLeft: document.queryCommandState('justifyLeft'),
            justifyCenter: document.queryCommandState('justifyCenter'),
            justifyRight: document.queryCommandState('justifyRight'),
            justifyFull: document.queryCommandState('justifyFull'),
        });
    }, [editable]);
    const ensureEditableStructure = useCallback(() => {
        const root = editorRef.current;
        if (!root || !editable)
            return;
        if (!root.innerHTML.trim() || root.innerHTML === '<br>') {
            root.innerHTML = '<p><br></p>';
            const sel = window.getSelection();
            const p = root.querySelector('p');
            if (sel && p) {
                const range = document.createRange();
                range.setStart(p, 0);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
            }
        }
    }, [editable]);
    const adjustIndent = useCallback((deltaPx) => {
        const root = editorRef.current;
        if (!root || !editable)
            return;
        root.focus();
        ensureEditableStructure();
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0)
            return;
        const block = getClosestBlock(sel.anchorNode, root);
        if (!block || !root.contains(block))
            return;
        if (block.closest('ul, ol')) {
            try {
                document.execCommand(deltaPx > 0 ? 'indent' : 'outdent');
            }
            catch {
                // ignore
            }
            emitChange();
            refreshActive();
            return;
        }
        const next = Math.max(0, Math.min(288, readMarginLeftPx(block) + deltaPx));
        if (next <= 0)
            block.style.marginLeft = '';
        else
            block.style.marginLeft = `${next}px`;
        emitChange();
        refreshActive();
    }, [editable, emitChange, ensureEditableStructure, refreshActive]);
    const run = useCallback((cmd, arg) => {
        const el = editorRef.current;
        if (!el || !editable)
            return;
        el.focus();
        ensureEditableStructure();
        if (cmd === 'indent') {
            adjustIndent(INDENT_STEP_PX);
            return;
        }
        if (cmd === 'outdent') {
            adjustIndent(-INDENT_STEP_PX);
            return;
        }
        try {
            document.execCommand('styleWithCSS', false, 'true');
            document.execCommand(cmd, false, arg);
        }
        catch {
            // ignore unsupported commands
        }
        emitChange();
        refreshActive();
    }, [editable, adjustIndent, emitChange, ensureEditableStructure, refreshActive]);
    const onKeyDown = useCallback((e) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            adjustIndent(e.shiftKey ? -INDENT_STEP_PX : INDENT_STEP_PX);
            return;
        }
        if (e.key === 'Enter') {
            ensureEditableStructure();
            if (e.shiftKey) {
                e.preventDefault();
                try {
                    document.execCommand('insertLineBreak');
                }
                catch {
                    document.execCommand('insertHTML', false, '<br>');
                }
                emitChange();
                return;
            }
            // Hard line break → new paragraph (Word-like).
            e.preventDefault();
            try {
                const ok = document.execCommand('insertParagraph');
                if (!ok)
                    document.execCommand('insertHTML', false, '<p><br></p>');
            }
            catch {
                document.execCommand('insertHTML', false, '<p><br></p>');
            }
            emitChange();
            return;
        }
        const mod = e.ctrlKey || e.metaKey;
        if (!mod)
            return;
        const key = e.key.toLowerCase();
        if (key === 'b') {
            e.preventDefault();
            run('bold');
        }
        else if (key === 'i') {
            e.preventDefault();
            run('italic');
        }
        else if (key === 'u') {
            e.preventDefault();
            run('underline');
        }
        else if (key === 'z' && !e.shiftKey) {
            e.preventDefault();
            run('undo');
        }
        else if (key === 'y' || (key === 'z' && e.shiftKey)) {
            e.preventDefault();
            run('redo');
        }
    }, [adjustIndent, emitChange, ensureEditableStructure, run]);
    const onPaste = useCallback((e) => {
        e.preventDefault();
        ensureEditableStructure();
        const htmlClip = e.clipboardData.getData('text/html');
        const textClip = e.clipboardData.getData('text/plain');
        // Prefer plain text paragraphs so pasted Word fonts never sneak in.
        const safe = textClip
            ? plainTextToLetterHtml(textClip)
            : sanitizeLetterHtml(htmlClip);
        try {
            // insertHTML of full <p> blocks can nest poorly — insert fragment lines.
            if (textClip) {
                const parts = textClip.replace(/\r\n/g, '\n').split('\n');
                const html = parts.map((line, i) => {
                    const esc = line
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;');
                    if (i === 0)
                        return esc || '<br>';
                    return `</p><p>${esc || '<br>'}`;
                }).join('');
                document.execCommand('insertHTML', false, html);
            }
            else {
                document.execCommand('insertHTML', false, safe || '<br>');
            }
        }
        catch {
            document.execCommand('insertText', false, textClip);
        }
        emitChange();
    }, [emitChange, ensureEditableStructure]);
    const onFocus = useCallback(() => {
        ensureEditableStructure();
        refreshActive();
    }, [ensureEditableStructure, refreshActive]);
    const ctx = useMemo(() => ({
        editable,
        editorId,
        empty,
        active,
        run,
        adjustIndent,
        refreshActive,
        editorRef,
        emitChange,
        placeholder,
        surfaceProps: {
            onInput: emitChange,
            onBlur: emitChange,
            onKeyUp: refreshActive,
            onMouseUp: refreshActive,
            onFocus,
            onKeyDown,
            onPaste,
        },
    }), [
        editable,
        editorId,
        empty,
        active,
        run,
        adjustIndent,
        refreshActive,
        emitChange,
        placeholder,
        onFocus,
        onKeyDown,
        onPaste,
    ]);
    return (_jsx(LetterEditorContext.Provider, { value: ctx, children: children }));
}
function ToolbarBtn({ title, active, disabled, onClick, children, }) {
    return (_jsx("button", { type: "button", className: `corr-letter-editor__btn${active ? ' corr-letter-editor__btn--active' : ''}`, title: title, "aria-label": title, "aria-pressed": active, disabled: disabled, onMouseDown: (e) => {
            e.preventDefault();
        }, onClick: onClick, children: children }));
}
/** Formatting bar — place in the page chrome (above the sheet). */
export function CorrespondenceLetterEditorToolbar() {
    const ctx = useLetterEditorOptional();
    if (!ctx?.editable)
        return null;
    const { active, run, editorId } = ctx;
    return (_jsxs("div", { className: "corr-letter-editor__toolbar corr-letter-editor__toolbar--chrome", role: "toolbar", "aria-label": "\u0424\u043E\u0440\u043C\u0430\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435 \u0442\u0435\u043A\u0441\u0442\u0430", "aria-controls": editorId, children: [_jsx(ToolbarBtn, { title: "\u0416\u0438\u0440\u043D\u044B\u0439 (Ctrl+B)", active: active.bold, onClick: () => run('bold'), children: _jsx("span", { className: "corr-letter-editor__glyph corr-letter-editor__glyph--bold", children: "B" }) }), _jsx(ToolbarBtn, { title: "\u041A\u0443\u0440\u0441\u0438\u0432 (Ctrl+I)", active: active.italic, onClick: () => run('italic'), children: _jsx("span", { className: "corr-letter-editor__glyph corr-letter-editor__glyph--italic", children: "I" }) }), _jsx(ToolbarBtn, { title: "\u041F\u043E\u0434\u0447\u0451\u0440\u043A\u043D\u0443\u0442\u044B\u0439 (Ctrl+U)", active: active.underline, onClick: () => run('underline'), children: _jsx("span", { className: "corr-letter-editor__glyph corr-letter-editor__glyph--underline", children: "U" }) }), _jsx(ToolbarBtn, { title: "\u0417\u0430\u0447\u0451\u0440\u043A\u043D\u0443\u0442\u044B\u0439", active: active.strikeThrough, onClick: () => run('strikeThrough'), children: _jsx("span", { className: "corr-letter-editor__glyph corr-letter-editor__glyph--strike", children: "S" }) }), _jsx("span", { className: "corr-letter-editor__sep", "aria-hidden": true }), _jsx(ToolbarBtn, { title: "\u041C\u0430\u0440\u043A\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u044B\u0439 \u0441\u043F\u0438\u0441\u043E\u043A", active: active.insertUnorderedList, onClick: () => run('insertUnorderedList'), children: "\u2022\u2022" }), _jsx(ToolbarBtn, { title: "\u041D\u0443\u043C\u0435\u0440\u043E\u0432\u0430\u043D\u043D\u044B\u0439 \u0441\u043F\u0438\u0441\u043E\u043A", active: active.insertOrderedList, onClick: () => run('insertOrderedList'), children: "1." }), _jsx("span", { className: "corr-letter-editor__sep", "aria-hidden": true }), _jsx(ToolbarBtn, { title: "\u0423\u0432\u0435\u043B\u0438\u0447\u0438\u0442\u044C \u043E\u0442\u0441\u0442\u0443\u043F (Tab)", onClick: () => run('indent'), children: _jsx("span", { "aria-hidden": true, children: "\u21E5" }) }), _jsx(ToolbarBtn, { title: "\u0423\u043C\u0435\u043D\u044C\u0448\u0438\u0442\u044C \u043E\u0442\u0441\u0442\u0443\u043F (Shift+Tab)", onClick: () => run('outdent'), children: _jsx("span", { "aria-hidden": true, children: "\u21E4" }) }), _jsx("span", { className: "corr-letter-editor__sep", "aria-hidden": true }), _jsx(ToolbarBtn, { title: "\u041F\u043E \u043B\u0435\u0432\u043E\u043C\u0443 \u043A\u0440\u0430\u044E", active: active.justifyLeft, onClick: () => run('justifyLeft'), children: _jsx("span", { className: "corr-letter-editor__align", "aria-hidden": true, children: "\u2261" }) }), _jsx(ToolbarBtn, { title: "\u041F\u043E \u0446\u0435\u043D\u0442\u0440\u0443", active: active.justifyCenter, onClick: () => run('justifyCenter'), children: _jsx("span", { className: "corr-letter-editor__align corr-letter-editor__align--center", "aria-hidden": true, children: "\u2261" }) }), _jsx(ToolbarBtn, { title: "\u041F\u043E \u043F\u0440\u0430\u0432\u043E\u043C\u0443 \u043A\u0440\u0430\u044E", active: active.justifyRight, onClick: () => run('justifyRight'), children: _jsx("span", { className: "corr-letter-editor__align corr-letter-editor__align--right", "aria-hidden": true, children: "\u2261" }) }), _jsx(ToolbarBtn, { title: "\u041F\u043E \u0448\u0438\u0440\u0438\u043D\u0435", active: active.justifyFull, onClick: () => run('justifyFull'), children: _jsx("span", { className: "corr-letter-editor__align corr-letter-editor__align--full", "aria-hidden": true, children: "\u2261" }) }), _jsx("span", { className: "corr-letter-editor__sep", "aria-hidden": true }), _jsx(ToolbarBtn, { title: "\u041E\u0442\u043C\u0435\u043D\u0438\u0442\u044C (Ctrl+Z)", onClick: () => run('undo'), children: "\u21B6" }), _jsx(ToolbarBtn, { title: "\u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u044C (Ctrl+Y)", onClick: () => run('redo'), children: "\u21B7" }), _jsx(ToolbarBtn, { title: "\u041E\u0447\u0438\u0441\u0442\u0438\u0442\u044C \u0444\u043E\u0440\u043C\u0430\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435", onClick: () => run('removeFormat'), children: "Tx" })] }));
}
/** Editable / readonly letter body surface (lives inside the A4 sheet). */
export function CorrespondenceLetterEditorSurface() {
    const ctx = useLetterEditorOptional();
    if (!ctx) {
        return _jsx("div", { className: "corr-letter-editor__readonly corr-letter-editor__readonly--empty" });
    }
    if (!ctx.editable) {
        // Provider still wraps readonly for preview when needed; fall back to empty.
        return _jsx("div", { className: "corr-letter-editor__readonly corr-letter-editor__readonly--empty" });
    }
    const { editorId, editorRef, empty, placeholder, surfaceProps } = ctx;
    return (_jsx("div", { className: "corr-letter-editor corr-letter-editor--surface-only", children: _jsxs("div", { className: "corr-letter-editor__surface-wrap", children: [empty ? (_jsx("div", { className: "corr-letter-editor__placeholder", "aria-hidden": true, children: placeholder })) : null, _jsx("div", { id: editorId, ref: editorRef, className: "corr-letter-editor__surface", contentEditable: true, suppressContentEditableWarning: true, role: "textbox", "aria-multiline": "true", "aria-label": "\u0422\u0435\u043A\u0441\u0442 \u043F\u0438\u0441\u044C\u043C\u0430", "aria-placeholder": placeholder, "data-placeholder": placeholder, ...surfaceProps })] }) }));
}
/** Standalone readonly body (preview without provider). */
export function CorrespondenceLetterBodyReadonly({ value }) {
    const html = normalizeLetterBodyHtml(value);
    if (!html)
        return _jsx("div", { className: "corr-letter-editor__readonly corr-letter-editor__readonly--empty" });
    return (_jsx("div", { className: "corr-letter-editor__readonly", dangerouslySetInnerHTML: { __html: html } }));
}
// Keep a thin compatibility export used by older imports.
export function CorrespondenceLetterBodyEditor(props) {
    if (!props.editable) {
        return _jsx(CorrespondenceLetterBodyReadonly, { value: props.value });
    }
    return (_jsxs(CorrespondenceLetterEditorProvider, { value: props.value, editable: true, placeholder: props.placeholder, onChange: props.onChange, children: [_jsx(CorrespondenceLetterEditorToolbar, {}), _jsx(CorrespondenceLetterEditorSurface, {})] }));
}
