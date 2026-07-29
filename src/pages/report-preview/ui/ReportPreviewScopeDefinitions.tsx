import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ProjectScopeDefinition } from '@entities/time-tracking';

export function ReportPreviewScopeLegend({
    definitions,
    loading = false,
    disabled = false,
    onEdit,
}: {
    definitions: readonly ProjectScopeDefinition[];
    loading?: boolean;
    disabled?: boolean;
    onEdit: (definition: ProjectScopeDefinition) => void;
}) {
    if (!loading && definitions.length === 0)
        return null;

    return (<div className="tt-rp-scope-legend" aria-label="Описание цветов Scope">
        <span className="tt-rp-scope-legend__label">Scope:</span>
        <div className="tt-rp-scope-legend__colors">
            {definitions.map((definition) => (<button
                key={definition.color}
                type="button"
                className="tt-rp-scope-legend__color"
                style={{ backgroundColor: definition.color }}
                title={`${definition.description}\nНажмите, чтобы изменить`}
                aria-label={`${definition.color}: ${definition.description}. Нажмите, чтобы изменить.`}
                disabled={disabled}
                onClick={() => onEdit(definition)}
            />))}
            {loading ? <span className="tt-rp-scope-legend__loading" aria-label="Загрузка описаний Scope" /> : null}
        </div>
    </div>);
}

export function ReportPreviewScopeDescriptionModal({
    open,
    color,
    initialDescription,
    firstUse,
    saving,
    onCancel,
    onSave,
}: {
    open: boolean;
    color: string;
    initialDescription: string;
    firstUse: boolean;
    saving: boolean;
    onCancel: () => void;
    onSave: (description: string) => void | Promise<void>;
}) {
    const [description, setDescription] = useState(initialDescription);

    useEffect(() => {
        if (open)
            setDescription(initialDescription);
    }, [color, initialDescription, open]);

    useEffect(() => {
        if (!open)
            return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !saving)
                onCancel();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [onCancel, open, saving]);

    if (!open)
        return null;

    const trimmedDescription = description.trim();
    return createPortal(<div className="tt-rp-scope-modal" role="presentation" onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving)
            onCancel();
    }}>
        <form className="tt-rp-scope-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="tt-rp-scope-modal-title" onSubmit={(event) => {
            event.preventDefault();
            if (trimmedDescription)
                void onSave(trimmedDescription);
        }}>
            <div className="tt-rp-scope-modal__head">
                <div>
                    <h2 id="tt-rp-scope-modal-title" className="tt-rp-scope-modal__title">
                        {firstUse ? 'Описание нового Scope' : 'Редактировать Scope'}
                    </h2>
                    <p className="tt-rp-scope-modal__hint">
                        {firstUse
                            ? 'Этот цвет выбран в проекте впервые. Добавьте описание, чтобы сохранить и применить его.'
                            : 'Описание отображается при наведении на цвет в панели над таблицей.'}
                    </p>
                </div>
                <button type="button" className="tt-rp-scope-modal__close" onClick={onCancel} disabled={saving} aria-label="Закрыть">×</button>
            </div>
            <div className="tt-rp-scope-modal__color-row">
                <span className="tt-rp-scope-modal__swatch" style={{ backgroundColor: color }} aria-hidden />
                <span className="tt-rp-scope-modal__hex">{color}</span>
            </div>
            <label className="tt-rp-scope-modal__field">
                <span>Описание</span>
                <textarea
                    autoFocus
                    rows={4}
                    maxLength={1000}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Например: требуется дополнительная проверка партнёра"
                    disabled={saving}
                />
                <small>{description.length}/1000</small>
            </label>
            <div className="tt-rp-scope-modal__actions">
                <button type="button" className="tt-reports__btn tt-reports__btn--outline" onClick={onCancel} disabled={saving}>Отмена</button>
                <button type="submit" className="tt-reports__btn tt-rp-scope-modal__save" disabled={!trimmedDescription || saving}>
                    {saving ? 'Сохранение…' : firstUse ? 'Сохранить и применить' : 'Сохранить'}
                </button>
            </div>
        </form>
    </div>, document.body);
}
