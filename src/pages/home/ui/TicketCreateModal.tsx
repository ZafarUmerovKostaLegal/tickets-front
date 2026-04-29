import { memo } from 'react';
import { createPortal } from 'react-dom';
import type { PriorityItem } from '@entities/ticket';
type TicketCreateModalProps = {
    onClose: () => void;
    onSubmit: (e: React.FormEvent) => void;
    theme: string;
    description: string;
    category: string;
    priority: string;
    onThemeChange: (v: string) => void;
    onDescriptionChange: (v: string) => void;
    onCategoryChange: (v: string) => void;
    onPriorityChange: (v: string) => void;
    categories: readonly string[];
    priorities: PriorityItem[];
    file: File | null;
    onFileChange: (f: File | null) => void;
    isDragging: boolean;
    onDragStart: () => void;
    onDragEnd: () => void;
    onDrop: (f: File) => void;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    categoryDropdownOpen: boolean;
    setCategoryDropdownOpen: (v: boolean) => void;
    priorityDropdownOpen: boolean;
    setPriorityDropdownOpen: (v: boolean) => void;
    categoryDropdownRef: React.RefObject<HTMLDivElement | null>;
    priorityDropdownRef: React.RefObject<HTMLDivElement | null>;
    submitting: boolean;
    error: string | null;
};
export const TicketCreateModal = memo(function TicketCreateModal(props: TicketCreateModalProps) {
    const { onClose, onSubmit, theme, description, category, priority, onThemeChange, onDescriptionChange, onCategoryChange, onPriorityChange, categories, priorities, file, onFileChange, isDragging, onDragStart, onDragEnd, onDrop, fileInputRef, categoryDropdownOpen, setCategoryDropdownOpen, priorityDropdownOpen, setPriorityDropdownOpen, submitting, error, } = props;
    const prettyPriority = (value: string): string => {
        const v = (value || '').toLowerCase();
        if (v === 'high')
            return 'Высокий';
        if (v === 'low')
            return 'Низкий';
        if (v === 'medium')
            return 'Средний';
        return value || 'Средний';
    };
    const modal = (<div className="tm" role="dialog" aria-modal="true" aria-labelledby="tm-title">
      <div className="tm__backdrop" aria-hidden/>
      <div className="tm__box">
        <div className="tm__head">
          <div className="tm__head-left">
            <span className="tm__head-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
            </span>
            <h2 id="tm-title" className="tm__title">Новая заявка</h2>
          </div>
          <button type="button" className="tm__close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <form className="tm__form" onSubmit={onSubmit}>
          <label className="tm__field">
            <span className="tm__label">Тема <span className="tm__req">*</span></span>
            <input type="text" className="tm__input" value={theme} onChange={(e) => onThemeChange(e.target.value)} required placeholder="О чём заявка?"/>
          </label>

          <label className="tm__field">
            <span className="tm__label">Описание <span className="tm__req">*</span></span>
            <textarea className="tm__input tm__input--area" value={description} onChange={(e) => onDescriptionChange(e.target.value)} required rows={3} placeholder="Подробно опишите проблему или запрос"/>
          </label>

          <div className="tm__meta-row">
            <span className="tm__meta-label">Статус</span>
            <span className="tm__chip tm__chip--status">Новая</span>
          </div>

          <div className="tm__row">
            <div className="tm__field" ref={props.categoryDropdownRef}>
              <span className="tm__label">Категория</span>
              <button type="button" className={`tm__select${categoryDropdownOpen ? ' tm__select--open' : ''}`} onClick={() => { setCategoryDropdownOpen(!categoryDropdownOpen); setPriorityDropdownOpen(false); }} aria-haspopup="listbox" aria-expanded={categoryDropdownOpen}>
                <span className="tm__select-val">{category || 'Выберите'}</span>
                <svg className="tm__select-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
              </button>
              <div className={`tm__drop${categoryDropdownOpen ? ' tm__drop--open' : ''}`} role="listbox">
                {categories.map((cat) => (<button key={cat} type="button" role="option" aria-selected={category === cat} className={`tm__opt${category === cat ? ' tm__opt--active' : ''}`} onClick={() => { onCategoryChange(cat); setCategoryDropdownOpen(false); }}>{cat}</button>))}
              </div>
            </div>
            <div className="tm__field" ref={props.priorityDropdownRef}>
              <span className="tm__label">Приоритет</span>
              <button type="button" className={`tm__select${priorityDropdownOpen ? ' tm__select--open' : ''}`} onClick={() => { setPriorityDropdownOpen(!priorityDropdownOpen); setCategoryDropdownOpen(false); }} aria-haspopup="listbox" aria-expanded={priorityDropdownOpen}>
                <span className="tm__select-val">{prettyPriority(priorities.find((p) => p.value === priority)?.label ?? priority)}</span>
                <svg className="tm__select-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
              </button>
              <div className={`tm__drop${priorityDropdownOpen ? ' tm__drop--open' : ''}`} role="listbox">
                {priorities.map((p) => (<button key={p.value} type="button" role="option" aria-selected={priority === p.value} className={`tm__opt${priority === p.value ? ' tm__opt--active' : ''}`} onClick={() => { onPriorityChange(p.value); setPriorityDropdownOpen(false); }}>{prettyPriority(p.label)}</button>))}
              </div>
            </div>
          </div>

          <div className="tm__field">
            <span className="tm__label">Вложение <span className="tm__label-hint">до 15 МБ</span></span>
            <div className={`tm__dropzone${isDragging ? ' tm__dropzone--drag' : ''}${file ? ' tm__dropzone--file' : ''}`} onDragOver={(e) => { e.preventDefault(); onDragStart(); }} onDragLeave={onDragEnd} onDrop={(e) => { e.preventDefault(); onDragEnd(); const f = e.dataTransfer.files?.[0]; if (f)
        onDrop(f); }} onClick={() => fileInputRef.current?.click()} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}>
              <input ref={fileInputRef} type="file" className="tm__file-input" onChange={(e) => onFileChange(e.target.files?.[0] ?? null)} accept="*/*" tabIndex={-1}/>
              {file ? (<div className="tm__dropzone-chosen">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
                  <span className="tm__dropzone-name">{file.name}</span>
                  <button type="button" className="tm__dropzone-remove" onClick={(e) => { e.stopPropagation(); onFileChange(null); }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>) : (<div className="tm__dropzone-empty">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  <span>Перетащите или <u>выберите файл</u></span>
                </div>)}
            </div>
          </div>

          {error && <p className="tm__error">{error}</p>}

          <div className="tm__foot">
            <button type="button" className="tm__btn tm__btn--ghost" onClick={onClose}>Отмена</button>
            <button type="submit" className="tm__btn tm__btn--primary" disabled={submitting}>
              {submitting ? (<><span className="tm__btn-spinner"/> Отправка…</>) : (<>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  Создать
                </>)}
            </button>
          </div>
        </form>
      </div>
    </div>);
    return typeof document !== 'undefined' ? createPortal(modal, document.body) : null;
});
