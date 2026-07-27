import { ReportPreviewFilterPopover } from './ReportPreviewFilterPopover';

export const SCOPE_COLOR_NONE = '__none__';

export function ReportPreviewScopeColorFilterPopover({
    usedColors,
    selected,
    onChange,
}: {
    usedColors: string[];
    /** Hex colors and/or SCOPE_COLOR_NONE. Empty = no filter. */
    selected: string[];
    onChange: (next: string[]) => void;
}) {
    const active = selected.length > 0;
    const toggle = (key: string) => {
        if (selected.includes(key))
            onChange(selected.filter((x) => x !== key));
        else
            onChange([...selected, key]);
    };
    return (
        <ReportPreviewFilterPopover
            aria-label="Фильтр: цвет Scope"
            title={active ? `Фильтр Scope (${selected.length})` : 'Фильтр по цвету Scope'}
            active={active}
        >
            <div className="tt-rp-xlf__section">
                <p className="tt-rp-xlf__hint">Показать строки с выбранными цветами. Можно отметить несколько. Окрашенные строки в таблице сразу группируются по цвету.</p>
                <div className="tt-rp-scope-filter__chips" role="group" aria-label="Цвета Scope">
                    <button
                        type="button"
                        className={`tt-rp-scope-filter__chip tt-rp-scope-filter__chip--none${selected.includes(SCOPE_COLOR_NONE) ? ' tt-rp-scope-filter__chip--on' : ''}`}
                        aria-pressed={selected.includes(SCOPE_COLOR_NONE)}
                        onClick={() => toggle(SCOPE_COLOR_NONE)}
                        title="Строки без цвета"
                    >
                        Без цвета
                    </button>
                    {usedColors.length === 0 ? (
                        <p className="tt-rp-xlf__hint tt-rp-scope-filter__empty">В таблице пока нет окрашенных строк.</p>
                    ) : (
                        usedColors.map((color) => (
                            <button
                                key={color}
                                type="button"
                                className={`tt-rp-scope-filter__chip${selected.includes(color) ? ' tt-rp-scope-filter__chip--on' : ''}`}
                                aria-pressed={selected.includes(color)}
                                onClick={() => toggle(color)}
                                title={color}
                            >
                                <span className="tt-rp-scope-filter__swatch" style={{ background: color }} aria-hidden />
                                <span className="tt-rp-scope-filter__hex">{color}</span>
                            </button>
                        ))
                    )}
                </div>
                {active ? (
                    <button type="button" className="tt-rp-xlf__clear" onClick={() => onChange([])}>
                        Сбросить фильтр
                    </button>
                ) : null}
            </div>
        </ReportPreviewFilterPopover>
    );
}
