import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
    letterBodyIsEmpty,
    normalizeLetterBodyHtml,
    plainTextToLetterHtml,
    sanitizeLetterHtml,
} from '../lib/correspondenceLetterHtml';

type FormatCmd =
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
    | 'removeFormat';

type Props = {
    value: string;
    editable?: boolean;
    placeholder?: string;
    onChange?: (html: string) => void;
};

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
                // Keep selection inside the editor.
                e.preventDefault();
            }}
            onClick={onClick}
        >
            {children}
        </button>
    );
}

function IcoBold() {
    return <span className="corr-letter-editor__glyph corr-letter-editor__glyph--bold">B</span>;
}
function IcoItalic() {
    return <span className="corr-letter-editor__glyph corr-letter-editor__glyph--italic">I</span>;
}
function IcoUnderline() {
    return <span className="corr-letter-editor__glyph corr-letter-editor__glyph--underline">U</span>;
}
function IcoStrike() {
    return <span className="corr-letter-editor__glyph corr-letter-editor__glyph--strike">S</span>;
}

export function CorrespondenceLetterBodyEditor({
    value,
    editable = false,
    placeholder = 'Начните писать письмо…',
    onChange,
}: Props) {
    const editorId = useId();
    const editorRef = useRef<HTMLDivElement>(null);
    const lastEmittedRef = useRef(normalizeLetterBodyHtml(value));
    const [empty, setEmpty] = useState(() => letterBodyIsEmpty(value));
    const [active, setActive] = useState<Partial<Record<FormatCmd, boolean>>>({});

    const syncFromProp = useCallback((next: string) => {
        const normalized = normalizeLetterBodyHtml(next);
        const el = editorRef.current;
        if (!el)
            return;
        if (normalized === lastEmittedRef.current && el.innerHTML === normalized)
            return;
        if (document.activeElement === el && normalized === lastEmittedRef.current)
            return;
        el.innerHTML = normalized || '';
        lastEmittedRef.current = normalized;
        setEmpty(letterBodyIsEmpty(normalized));
    }, []);

    useEffect(() => {
        syncFromProp(value);
    }, [value, syncFromProp]);

    const emitChange = useCallback(() => {
        const el = editorRef.current;
        if (!el)
            return;
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

    const run = useCallback((cmd: FormatCmd, arg?: string) => {
        const el = editorRef.current;
        if (!el || !editable)
            return;
        el.focus();
        try {
            document.execCommand(cmd, false, arg);
        }
        catch {
            // Older browsers / unsupported command — ignore.
        }
        emitChange();
        refreshActive();
    }, [editable, emitChange, refreshActive]);

    if (!editable) {
        const html = normalizeLetterBodyHtml(value);
        if (!html) {
            return <div className="corr-letter-editor__readonly corr-letter-editor__readonly--empty" />;
        }
        return (
            <div
                className="corr-letter-editor__readonly"
                dangerouslySetInnerHTML={{ __html: html }}
            />
        );
    }

    return (
        <div className="corr-letter-editor">
            <div className="corr-letter-editor__toolbar" role="toolbar" aria-label="Форматирование текста" aria-controls={editorId}>
                <ToolbarBtn title="Жирный" active={active.bold} onClick={() => run('bold')}><IcoBold /></ToolbarBtn>
                <ToolbarBtn title="Курсив" active={active.italic} onClick={() => run('italic')}><IcoItalic /></ToolbarBtn>
                <ToolbarBtn title="Подчёркнутый" active={active.underline} onClick={() => run('underline')}><IcoUnderline /></ToolbarBtn>
                <ToolbarBtn title="Зачёркнутый" active={active.strikeThrough} onClick={() => run('strikeThrough')}><IcoStrike /></ToolbarBtn>
                <span className="corr-letter-editor__sep" aria-hidden />
                <ToolbarBtn title="Маркированный список" active={active.insertUnorderedList} onClick={() => run('insertUnorderedList')}>•≡</ToolbarBtn>
                <ToolbarBtn title="Нумерованный список" active={active.insertOrderedList} onClick={() => run('insertOrderedList')}>1.</ToolbarBtn>
                <span className="corr-letter-editor__sep" aria-hidden />
                <ToolbarBtn title="По левому краю" active={active.justifyLeft} onClick={() => run('justifyLeft')}>⫷</ToolbarBtn>
                <ToolbarBtn title="По центру" active={active.justifyCenter} onClick={() => run('justifyCenter')}>☰</ToolbarBtn>
                <ToolbarBtn title="По правому краю" active={active.justifyRight} onClick={() => run('justifyRight')}>⫸</ToolbarBtn>
                <ToolbarBtn title="По ширине" active={active.justifyFull} onClick={() => run('justifyFull')}>☰☰</ToolbarBtn>
                <span className="corr-letter-editor__sep" aria-hidden />
                <ToolbarBtn title="Отменить" onClick={() => run('undo')}>↶</ToolbarBtn>
                <ToolbarBtn title="Повторить" onClick={() => run('redo')}>↷</ToolbarBtn>
                <ToolbarBtn title="Очистить форматирование" onClick={() => run('removeFormat')}>Tx</ToolbarBtn>
            </div>
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
                    onInput={emitChange}
                    onBlur={emitChange}
                    onKeyUp={refreshActive}
                    onMouseUp={refreshActive}
                    onFocus={refreshActive}
                    onPaste={(e) => {
                        e.preventDefault();
                        const htmlClip = e.clipboardData.getData('text/html');
                        const textClip = e.clipboardData.getData('text/plain');
                        const safe = htmlClip
                            ? sanitizeLetterHtml(htmlClip)
                            : plainTextToLetterHtml(textClip);
                        try {
                            document.execCommand('insertHTML', false, safe || '<p><br></p>');
                        }
                        catch {
                            document.execCommand('insertText', false, textClip);
                        }
                        emitChange();
                    }}
                />
            </div>
        </div>
    );
}
