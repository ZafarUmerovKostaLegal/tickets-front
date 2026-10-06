import { createPortal } from 'react-dom';
import {
    EQUIPMENT_SCORE_RANGES,
    equipmentAgeYears,
    equipmentScoreFromAgeYears,
    equipmentScoreText,
    equipmentScoreTier,
    isMonitorCategory,
    MONITOR_PORT_OPTIONS,
    MONITOR_RESOLUTION_PRESETS,
    type MonitorPanel,
} from '@entities/inventory';
import { useInventory } from '../model';

function IconClose() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
    );
}

function IconUpload() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
    );
}

export function ItemModal() {
    const {
        itemModal,
        setItemModal,
        itemForm,
        setItemForm,
        itemPhotoFile,
        setItemPhotoFile,
        formError,
        submitting,
        categories,
        statuses,
        photoInputRef,
        handleItemSubmit,
    } = useInventory();

    if (!itemModal)
        return null;

    const selectedCategory = categories.find((c) => c.id === itemForm.category_id);
    const isMonitor = isMonitorCategory(selectedCategory?.name);
    const selectedRange = EQUIPMENT_SCORE_RANGES.find((r) => r.code === itemForm.equipment_class);
    const formAgeYears = equipmentAgeYears(itemForm.purchase_date);
    const formScore = formAgeYears == null ? null : equipmentScoreFromAgeYears(formAgeYears);

    const togglePort = (port: string) => {
        setItemForm((f) => {
            const has = f.monitor_ports.includes(port);
            return {
                ...f,
                monitor_ports: has
                    ? f.monitor_ports.filter((p) => p !== port)
                    : [...f.monitor_ports, port],
            };
        });
    };

    const content = (
        <div className="inv__overlay" role="dialog" aria-modal="true" aria-labelledby="inv-item-modal-title">
            <div className="inv__modal inv__modal--item" onClick={(e) => e.stopPropagation()}>
                <div className="inv__modal-head">
                    <div className="inv__modal-head-text">
                        <h3 id="inv-item-modal-title" className="inv__modal-title">
                            {itemModal === 'add' ? 'Новая позиция' : 'Редактировать позицию'}
                        </h3>
                        <p className="inv__modal-subtitle">
                            {itemModal === 'add'
                                ? 'Заполните карточку техники и укажите класс от новой к устаревшей.'
                                : 'Измените данные позиции и сохраните.'}
                        </p>
                    </div>
                    <button type="button" className="inv__modal-close" onClick={() => setItemModal(null)} aria-label="Закрыть">
                        <IconClose />
                    </button>
                </div>

                {formError ? <p className="inv__form-err" role="alert">{formError}</p> : null}

                <form onSubmit={handleItemSubmit} className="inv__form inv__form--item">
                    <section className="inv__form-section">
                        <h4 className="inv__form-section-title">Основное</h4>
                        <div className="inv__form-grid">
                            <label className="inv__form-field inv__form-field--span2">
                                <span className="inv__form-label">Название <span className="inv__req">*</span></span>
                                <input
                                    className="inv__input"
                                    value={itemForm.name}
                                    onChange={(e) => setItemForm((f) => ({ ...f, name: e.target.value }))}
                                    required
                                    placeholder={isMonitor ? 'Например, Dell UltraSharp 27' : 'Например, MacBook Pro 14'}
                                />
                            </label>
                            <label className="inv__form-field">
                                <span className="inv__form-label">Категория <span className="inv__req">*</span></span>
                                <select
                                    className="inv__input"
                                    value={itemForm.category_id === '' ? '' : itemForm.category_id}
                                    onChange={(e) => setItemForm((f) => ({
                                        ...f,
                                        category_id: e.target.value === '' ? '' : Number(e.target.value),
                                    }))}
                                    required
                                >
                                    <option value="">Выберите</option>
                                    {categories.map((c) => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </label>
                            <div className="inv__form-field inv__form-field--span2">
                                <span className="inv__form-label">Оценка по 10-балльной шкале</span>
                                <div className="inv__score-pick" role="group" aria-label="Оценка техники">
                                    {EQUIPMENT_SCORE_RANGES.map((r) => (
                                        <button
                                            key={r.code}
                                            type="button"
                                            className={`inv__score-pick-btn inv__score-pick-btn--${r.code}${itemForm.equipment_class === r.code ? ' inv__score-pick-btn--on' : ''}`}
                                            title={r.summary}
                                            aria-pressed={itemForm.equipment_class === r.code}
                                            onClick={() => setItemForm((f) => ({
                                                ...f,
                                                equipment_class: f.equipment_class === r.code ? '' : r.code,
                                            }))}
                                        >
                                            {r.range}
                                        </button>
                                    ))}
                                </div>
                                {formScore != null ? (
                                    <p className="inv__score-pick-hint">
                                        По дате покупки — {equipmentScoreText(formScore)} ({equipmentScoreTier(formScore).summary}).
                                        Эта оценка и показывается в списке.
                                    </p>
                                ) : selectedRange ? (
                                    <p className="inv__score-pick-hint">
                                        {selectedRange.range} из 10 — {selectedRange.summary}. Укажите дату покупки, чтобы балл считался точно.
                                    </p>
                                ) : (
                                    <p className="inv__score-pick-hint inv__score-pick-hint--muted">
                                        10 — новая техника, 1 — к списанию. Точный балл считается по дате покупки.
                                    </p>
                                )}
                            </div>
                            {!isMonitor && (
                                <label className="inv__form-field inv__form-field--span2">
                                    <span className="inv__form-label">Описание</span>
                                    <textarea
                                        className="inv__input inv__input--textarea"
                                        rows={3}
                                        value={itemForm.description}
                                        onChange={(e) => setItemForm((f) => ({ ...f, description: e.target.value }))}
                                        placeholder="Модель, комплектация, заметки…"
                                    />
                                </label>
                            )}
                        </div>
                    </section>

                    {isMonitor && (
                        <section className="inv__form-section">
                            <h4 className="inv__form-section-title">Характеристики монитора</h4>
                            <div className="inv__form-grid">
                                <label className="inv__form-field">
                                    <span className="inv__form-label">Диагональ, дюймы</span>
                                    <input
                                        className="inv__input"
                                        inputMode="decimal"
                                        value={itemForm.monitor_diagonal}
                                        onChange={(e) => setItemForm((f) => ({ ...f, monitor_diagonal: e.target.value }))}
                                        placeholder="27"
                                    />
                                </label>
                                <label className="inv__form-field">
                                    <span className="inv__form-label">Разрешение</span>
                                    <input
                                        className="inv__input"
                                        list="inv-monitor-resolutions"
                                        value={itemForm.monitor_resolution}
                                        onChange={(e) => setItemForm((f) => ({ ...f, monitor_resolution: e.target.value }))}
                                        placeholder="2560×1440"
                                    />
                                    <datalist id="inv-monitor-resolutions">
                                        {MONITOR_RESOLUTION_PRESETS.map((r) => (
                                            <option key={r} value={r} />
                                        ))}
                                    </datalist>
                                </label>
                                <label className="inv__form-field">
                                    <span className="inv__form-label">Частота, Гц</span>
                                    <input
                                        className="inv__input"
                                        inputMode="numeric"
                                        value={itemForm.monitor_refresh_hz}
                                        onChange={(e) => setItemForm((f) => ({ ...f, monitor_refresh_hz: e.target.value }))}
                                        placeholder="60 / 144 / 165"
                                    />
                                </label>
                                <label className="inv__form-field">
                                    <span className="inv__form-label">Тип панели</span>
                                    <select
                                        className="inv__input"
                                        value={itemForm.monitor_panel}
                                        onChange={(e) => setItemForm((f) => ({
                                            ...f,
                                            monitor_panel: e.target.value as MonitorPanel,
                                        }))}
                                    >
                                        <option value="">Не указано</option>
                                        <option value="IPS">IPS</option>
                                        <option value="VA">VA</option>
                                        <option value="TN">TN</option>
                                        <option value="OLED">OLED</option>
                                        <option value="Mini-LED">Mini-LED</option>
                                    </select>
                                </label>
                                <div className="inv__form-field inv__form-field--span2">
                                    <span className="inv__form-label">Разъёмы</span>
                                    <div className="inv__chip-pick" role="group" aria-label="Разъёмы монитора">
                                        {MONITOR_PORT_OPTIONS.map((port) => {
                                            const on = itemForm.monitor_ports.includes(port);
                                            return (
                                                <button
                                                    key={port}
                                                    type="button"
                                                    className={`inv__chip-pick-btn${on ? ' inv__chip-pick-btn--on' : ''}`}
                                                    aria-pressed={on}
                                                    onClick={() => togglePort(port)}
                                                >
                                                    {port}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <label className="inv__form-field">
                                    <span className="inv__form-label">Крепление VESA</span>
                                    <select
                                        className="inv__input"
                                        value={itemForm.monitor_vesa}
                                        onChange={(e) => setItemForm((f) => ({
                                            ...f,
                                            monitor_vesa: e.target.value as '' | 'yes' | 'no',
                                        }))}
                                    >
                                        <option value="">Не указано</option>
                                        <option value="yes">Да</option>
                                        <option value="no">Нет</option>
                                    </select>
                                </label>
                                <label className="inv__form-field">
                                    <span className="inv__form-label">Изогнутый экран</span>
                                    <select
                                        className="inv__input"
                                        value={itemForm.monitor_curved}
                                        onChange={(e) => setItemForm((f) => ({
                                            ...f,
                                            monitor_curved: e.target.value as '' | 'yes' | 'no',
                                        }))}
                                    >
                                        <option value="">Не указано</option>
                                        <option value="yes">Да</option>
                                        <option value="no">Нет</option>
                                    </select>
                                </label>
                                <label className="inv__form-field inv__form-field--span2">
                                    <span className="inv__form-label">Дополнительные заметки</span>
                                    <textarea
                                        className="inv__input inv__input--textarea"
                                        rows={2}
                                        value={itemForm.description}
                                        onChange={(e) => setItemForm((f) => ({ ...f, description: e.target.value }))}
                                        placeholder="Модель, комплектация, особенности…"
                                    />
                                </label>
                            </div>
                        </section>
                    )}

                    <section className="inv__form-section">
                        <h4 className="inv__form-section-title">Учёт</h4>
                        <div className="inv__form-grid">
                            <label className="inv__form-field">
                                <span className="inv__form-label">Инв. номер <span className="inv__req">*</span></span>
                                <input
                                    className="inv__input inv__input--mono"
                                    value={itemForm.inventory_number}
                                    onChange={(e) => setItemForm((f) => ({ ...f, inventory_number: e.target.value }))}
                                    required
                                    placeholder="Уникальный номер"
                                />
                            </label>
                            <label className="inv__form-field">
                                <span className="inv__form-label">Серийный номер</span>
                                <input
                                    className="inv__input inv__input--mono"
                                    value={itemForm.serial_number}
                                    onChange={(e) => setItemForm((f) => ({ ...f, serial_number: e.target.value }))}
                                    placeholder="S/N с корпуса"
                                />
                            </label>
                            <label className="inv__form-field inv__form-field--span2">
                                <span className="inv__form-label">Статус</span>
                                <select
                                    className="inv__input"
                                    value={itemForm.status}
                                    onChange={(e) => setItemForm((f) => ({ ...f, status: e.target.value }))}
                                >
                                    {statuses.map((s) => (
                                        <option key={s.value} value={s.value}>{s.label}</option>
                                    ))}
                                </select>
                            </label>
                        </div>
                    </section>

                    <section className="inv__form-section">
                        <h4 className="inv__form-section-title">Сроки</h4>
                        <div className="inv__form-grid">
                            <label className="inv__form-field">
                                <span className="inv__form-label">Дата покупки</span>
                                <input
                                    type="date"
                                    className="inv__input"
                                    value={itemForm.purchase_date}
                                    onChange={(e) => setItemForm((f) => ({ ...f, purchase_date: e.target.value }))}
                                />
                            </label>
                            <label className="inv__form-field">
                                <span className="inv__form-label">Гарантия до</span>
                                <input
                                    type="date"
                                    className="inv__input"
                                    value={itemForm.warranty_until}
                                    onChange={(e) => setItemForm((f) => ({ ...f, warranty_until: e.target.value }))}
                                />
                            </label>
                        </div>
                    </section>

                    <section className="inv__form-section">
                        <h4 className="inv__form-section-title">Фото</h4>
                        <label className="inv__photo-upload">
                            <input
                                ref={photoInputRef}
                                type="file"
                                accept="image/*"
                                className="inv__photo-upload-input"
                                onChange={(e) => setItemPhotoFile(e.target.files?.[0] ?? null)}
                            />
                            <span className="inv__photo-upload-box">
                                <span className="inv__photo-upload-icon"><IconUpload /></span>
                                <span className="inv__photo-upload-text">
                                    {itemPhotoFile ? itemPhotoFile.name : 'Нажмите или перетащите изображение'}
                                </span>
                                <span className="inv__photo-upload-hint">PNG, JPG до 10 МБ</span>
                            </span>
                        </label>
                    </section>

                    <div className="inv__modal-foot">
                        <button type="button" className="inv__btn inv__btn--ghost" onClick={() => setItemModal(null)} disabled={submitting}>
                            Отмена
                        </button>
                        <button type="submit" className="inv__btn inv__btn--primary" disabled={submitting}>
                            {submitting ? 'Сохранение…' : 'Сохранить'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );

    return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}
