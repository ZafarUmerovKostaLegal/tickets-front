import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
    type KeyboardEvent,
    type ClipboardEvent,
    type ReactNode,
    type RefObject,
} from 'react';
import {
    letterBodyIsEmpty,
    ensureLetterEditorHtml,
    normalizeLetterBodyHtml,
    plainTextToLetterHtml,
    sanitizeLetterHtml,
} from '../lib/correspondenceLetterHtml';

export type LetterFormatCmd =
    | 'bold'
    | 'italic'
    | 'underline'
    | 'strikeThrough'
    | 'insertUnorderedList'
    | 'insertOrderedList'
    | 'justifyLeft'
    | 'justifyCenter'
    | 'justifyRight'
    | 'justifyFull'
    | 'undo'
    | 'redo'
    | 'removeFormat'
    | 'indent'
    | 'outdent';

type ActiveMap = Partial<Record<LetterFormatCmd, boolean>>;

type LetterEditorContextValue = {
    editable: boolean;
    editorId: string;
    empty: boolean;
    active: ActiveMap;
    run: (cmd: LetterFormatCmd, arg?: string) => void;
    adjustIndent: (deltaPx: number) => void;
    refreshActive: () => void;
    editorRef: RefObject<HTMLDivElement | null>;
    emitChange: () => void;
    placeholder: string;
    surfaceProps: {
        onInput: () => void;
        onBlur: () => void;
        onKeyUp: () => void;
        onMouseUp: () => void;
        onFocus: () => void;
        onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void;
        onPaste: (e: ClipboardEvent<HTMLDivElement>) => void;
    };
};

const LetterEditorContext = createContext<LetterEditorContextValue | null>(null);

const INDENT_STEP_PX = 36;

function getClosestBlock(node: Node | null, root: HTMLElement): HTMLElement | null {
    let cur: Node | null = node;
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

function readMarginLeftPx(el: HTMLElement): number {
    const inline = el.style.marginLeft;
    if (inline) {
        const n = Number.parseFloat(inline);
        if (Number.isFinite(n))
            return n;
    }
    return 0;
}

export function useLetterEditor(): LetterEditorContextValue {
    const ctx = useContext(LetterEditorContext);
    if (!ctx)
        throw new Error('useLetterEditor must be used within CorrespondenceLetterEditorProvider');
    return ctx;
}

export function useLetterEditorOptional(): LetterEditorContextValue | null {
    return useContext(LetterEditorContext);
}

export function CorrespondenceLetterEditorProvider({
    value,
    editable = false,
    placeholder = 'Начните писать письмо…',
    onChange,
    children,
}: {
    value: string;
    editable?: boolean;
    placeholder?: string;
    onChange?: (html: string) => void;
    children: ReactNode;
}) {
    const editorId = useId();
    const editorRef = useRef<HTMLDivElement>(null);
    const lastEmittedRef = useRef(normalizeLetterBodyHtml(value));
    const [empty, setEmpty] = useState(() => letterBodyIsEmpty(value));
    const [active, setActive] = useState<ActiveMap>({});

    const syncFromProp = useCallback((next: string) => {
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

    const adjustIndent = useCallback((deltaPx: number) => {
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

    const run = useCallback((cmd: LetterFormatCmd, arg?: string) => {
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

    const onKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
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

    const onPaste = useCallback((e: ClipboardEvent<HTMLDivElement>) => {
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

    const ctx = useMemo<LetterEditorContextValue>(() => ({
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

    return (
        <LetterEditorContext.Provider value={ctx}>
            {children}
        </LetterEditorContext.Provider>
    );
}

function ToolbarBtn({
    title,
    active,
    disabled,
    onClick,
    children,
}: {
    title: string;
    active?: boolean;
    disabled?: boolean;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            className={`corr-letter-editor__btn${active ? ' corr-letter-editor__btn--active' : ''}`}
            title={title}
            aria-label={title}
            aria-pressed={active}
            disabled={disabled}
            onMouseDown={(e) => {
                e.preventDefault();
            }}
            onClick={onClick}
        >
            {children}
        </button>
    );
}

/** Formatting bar — place in the page chrome (above the sheet). */
export function CorrespondenceLetterEditorToolbar() {
    const ctx = useLetterEditorOptional();
    if (!ctx?.editable)
        return null;
    const { active, run, editorId } = ctx;

    return (
        <div
            className="corr-letter-editor__toolbar corr-letter-editor__toolbar--chrome"
            role="toolbar"
            aria-label="Форматирование текста"
            aria-controls={editorId}
        >
            <ToolbarBtn title="Жирный (Ctrl+B)" active={active.bold} onClick={() => run('bold')}>
                <span className="corr-letter-editor__glyph corr-letter-editor__glyph--bold">B</span>
            </ToolbarBtn>
            <ToolbarBtn title="Курсив (Ctrl+I)" active={active.italic} onClick={() => run('italic')}>
                <span className="corr-letter-editor__glyph corr-letter-editor__glyph--italic">I</span>
            </ToolbarBtn>
            <ToolbarBtn title="Подчёркнутый (Ctrl+U)" active={active.underline} onClick={() => run('underline')}>
                <span className="corr-letter-editor__glyph corr-letter-editor__glyph--underline">U</span>
            </ToolbarBtn>
            <ToolbarBtn title="Зачёркнутый" active={active.strikeThrough} onClick={() => run('strikeThrough')}>
                <span className="corr-letter-editor__glyph corr-letter-editor__glyph--strike">S</span>
            </ToolbarBtn>

            <span className="corr-letter-editor__sep" aria-hidden />

            <ToolbarBtn title="Маркированный список" active={active.insertUnorderedList} onClick={() => run('insertUnorderedList')}>
                ••
            </ToolbarBtn>
            <ToolbarBtn title="Нумерованный список" active={active.insertOrderedList} onClick={() => run('insertOrderedList')}>
                1.
            </ToolbarBtn>

            <span className="corr-letter-editor__sep" aria-hidden />

            <ToolbarBtn title="Увеличить отступ (Tab)" onClick={() => run('indent')}>
                <span aria-hidden>⇥</span>
            </ToolbarBtn>
            <ToolbarBtn title="Уменьшить отступ (Shift+Tab)" onClick={() => run('outdent')}>
                <span aria-hidden>⇤</span>
            </ToolbarBtn>

            <span className="corr-letter-editor__sep" aria-hidden />

            <ToolbarBtn title="По левому краю" active={active.justifyLeft} onClick={() => run('justifyLeft')}>
                <span className="corr-letter-editor__align" aria-hidden>≡</span>
            </ToolbarBtn>
            <ToolbarBtn title="По центру" active={active.justifyCenter} onClick={() => run('justifyCenter')}>
                <span className="corr-letter-editor__align corr-letter-editor__align--center" aria-hidden>≡</span>
            </ToolbarBtn>
            <ToolbarBtn title="По правому краю" active={active.justifyRight} onClick={() => run('justifyRight')}>
                <span className="corr-letter-editor__align corr-letter-editor__align--right" aria-hidden>≡</span>
            </ToolbarBtn>
            <ToolbarBtn title="По ширине" active={active.justifyFull} onClick={() => run('justifyFull')}>
                <span className="corr-letter-editor__align corr-letter-editor__align--full" aria-hidden>≡</span>
            </ToolbarBtn>

            <span className="corr-letter-editor__sep" aria-hidden />

            <ToolbarBtn title="Отменить (Ctrl+Z)" onClick={() => run('undo')}>↶</ToolbarBtn>
            <ToolbarBtn title="Повторить (Ctrl+Y)" onClick={() => run('redo')}>↷</ToolbarBtn>
            <ToolbarBtn title="Очистить форматирование" onClick={() => run('removeFormat')}>Tx</ToolbarBtn>
        </div>
    );
}

/** Editable / readonly letter body surface (lives inside the A4 sheet). */
export function CorrespondenceLetterEditorSurface() {
    const ctx = useLetterEditorOptional();
    if (!ctx) {
        return <div className="corr-letter-editor__readonly corr-letter-editor__readonly--empty" />;
    }

    if (!ctx.editable) {
        // Provider still wraps readonly for preview when needed; fall back to empty.
        return <div className="corr-letter-editor__readonly corr-letter-editor__readonly--empty" />;
    }

    const { editorId, editorRef, empty, placeholder, surfaceProps } = ctx;

    return (
        <div className="corr-letter-editor corr-letter-editor--surface-only">
            <div className="corr-letter-editor__surface-wrap">
                {empty ? (
                    <div className="corr-letter-editor__placeholder" aria-hidden>
                        {placeholder}
                    </div>
                ) : null}
                <div
                    id={editorId}
                    ref={editorRef}
                    className="corr-letter-editor__surface"
                    contentEditable
                    suppressContentEditableWarning
                    role="textbox"
                    aria-multiline="true"
                    aria-label="Текст письма"
                    aria-placeholder={placeholder}
                    data-placeholder={placeholder}
                    {...surfaceProps}
                />
            </div>
        </div>
    );
}

/** Standalone readonly body (preview without provider). */
export function CorrespondenceLetterBodyReadonly({ value }: { value: string }) {
    const html = normalizeLetterBodyHtml(value);
    if (!html)
        return <div className="corr-letter-editor__readonly corr-letter-editor__readonly--empty" />;
    return (
        <div
            className="corr-letter-editor__readonly"
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}

// Keep a thin compatibility export used by older imports.
export function CorrespondenceLetterBodyEditor(props: {
    value: string;
    editable?: boolean;
    placeholder?: string;
    onChange?: (html: string) => void;
}) {
    if (!props.editable) {
        return <CorrespondenceLetterBodyReadonly value={props.value} />;
    }
    return (
        <CorrespondenceLetterEditorProvider
            value={props.value}
            editable
            placeholder={props.placeholder}
            onChange={props.onChange}
        >
            <CorrespondenceLetterEditorToolbar />
            <CorrespondenceLetterEditorSurface />
        </CorrespondenceLetterEditorProvider>
    );
}
