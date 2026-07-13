import { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { ExpenseRequest, ExpenseStatus, ExpenseType, PaymentMethod } from '@entities/expenses/model/types';
import { EXPENSE_TYPES, PAYMENT_METHODS, STATUS_META } from '@entities/expenses/model/constants';
import { exportExpensesToExcel, DEFAULT_REPORT_CONFIG, type ReportConfig, } from '@entities/expenses/lib/exportExpenses';
type Props = {
    isOpen: boolean;
    requests: ExpenseRequest[];
    onClose: () => void;
};
const STATUS_OPTIONS = (Object.keys(STATUS_META) as ExpenseStatus[]).map(s => ({
    value: s,
    label: STATUS_META[s].label,
}));
function ReportAllToggle({ id, label, checked, onToggle, }: {
    id: string;
    label: string;
    checked: boolean;
    onToggle: (next: boolean) => void;
}) {
    const labelId = `rep-all-${id}-label`;
    return (<div className="exp-form-switch-row rep-report-all-row">
      <span id={labelId} className="rep-report-all-text">
        {label}
      </span>
      <button type="button" role="switch" aria-labelledby={labelId} aria-checked={checked} className={`exp-form-switch${checked ? ' exp-form-switch--on' : ''}`} onClick={() => onToggle(!checked)}>
        <span className="exp-form-switch__thumb"/>
      </button>
    </div>);
}
export function ExpensesReportModal({ isOpen, requests, onClose }: Props) {
    const [config, setConfig] = useState<ReportConfig>(DEFAULT_REPORT_CONFIG);
    const [isLoading, setIsLoading] = useState(false);
    const [exportErr, setExportErr] = useState<string | null>(null);
    const [allTypes, setAllTypes] = useState(true);
    const [allStatuses, setAllStatuses] = useState(true);
    const [allPayments, setAllPayments] = useState(true);
    useEffect(() => {
        if (isOpen) {
            setConfig(DEFAULT_REPORT_CONFIG);
            setAllTypes(true);
            setAllStatuses(true);
            setAllPayments(true);
            setIsLoading(false);
            setExportErr(null);
        }
    }, [isOpen]);
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && isOpen)
            onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);
    useEffect(() => {
        if (isOpen)
            document.body.style.overflow = 'hidden';
        else
            document.body.style.overflow = '';
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);
    const set = useCallback(<K extends keyof ReportConfig>(key: K, val: ReportConfig[K]) => {
        setConfig(prev => ({ ...prev, [key]: val }));
    }, []);
    const toggleType = useCallback((type: ExpenseType) => {
        setConfig(prev => {
            const has = prev.selectedTypes.includes(type);
            return {
                ...prev,
                selectedTypes: has
                    ? prev.selectedTypes.filter(t => t !== type)
                    : [...prev.selectedTypes, type],
            };
        });
    }, []);
    const toggleStatus = useCallback((status: ExpenseStatus) => {
        setConfig(prev => {
            const has = prev.selectedStatuses.includes(status);
            return {
                ...prev,
                selectedStatuses: has
                    ? prev.selectedStatuses.filter(s => s !== status)
                    : [...prev.selectedStatuses, status],
            };
        });
    }, []);
    const togglePayment = useCallback((method: PaymentMethod) => {
        setConfig(prev => {
            const has = prev.selectedPaymentMethods.includes(method);
            return {
                ...prev,
                selectedPaymentMethods: has
                    ? prev.selectedPaymentMethods.filter(m => m !== method)
                    : [...prev.selectedPaymentMethods, method],
            };
        });
    }, []);
    const handleAllTypes = useCallback((checked: boolean) => {
        setAllTypes(checked);
        if (checked)
            setConfig(prev => ({ ...prev, selectedTypes: [] }));
    }, []);
    const handleAllStatuses = useCallback((checked: boolean) => {
        setAllStatuses(checked);
        if (checked)
            setConfig(prev => ({ ...prev, selectedStatuses: [] }));
    }, []);
    const handleAllPayments = useCallback((checked: boolean) => {
        setAllPayments(checked);
        if (checked)
            setConfig(prev => ({ ...prev, selectedPaymentMethods: [] }));
    }, []);
    const handleGenerate = useCallback(async () => {
        setIsLoading(true);
        setExportErr(null);
        try {
            await exportExpensesToExcel(requests, config);
            onClose();
        }
        catch (err) {
            setExportErr(err instanceof Error ? err.message : 'Не удалось сформировать файл');
        }
        finally {
            setIsLoading(false);
        }
    }, [requests, config, onClose]);
    if (!isOpen)
        return null;
    const previewCount = requests.filter(r => {
        if (config.dateFrom && r.expenseDate < config.dateFrom)
            return false;
        if (config.dateTo && r.expenseDate > config.dateTo)
            return false;
        if (!allTypes && config.selectedTypes.length && !config.selectedTypes.includes(r.expenseType as ExpenseType))
            return false;
        if (!allStatuses && config.selectedStatuses.length && !config.selectedStatuses.includes(r.status))
            return false;
        if (!allPayments && config.selectedPaymentMethods.length) {
            const pm = r.paymentMethod as string | null | undefined;
            if (pm == null || pm === '' || !config.selectedPaymentMethods.includes(pm as PaymentMethod))
                return false;
        }
        if (config.reimbursable === 'reimbursable' && !r.isReimbursable)
            return false;
        if (config.reimbursable === 'non_reimbursable' && r.isReimbursable)
            return false;
        return true;
    }).length;
    const modal = (<>
      <div className="rep-overlay" aria-hidden/>
      <div className="rep-modal" role="dialog" aria-modal aria-labelledby="rep-modal-title">
        <div className="rep-modal__hd">
          <div className="rep-modal__hd-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
          </div>
          <div>
            <h2 id="rep-modal-title" className="rep-modal__title">Создать отчёт Excel</h2>
            <p className="rep-modal__sub">Фильтры, как в заявках: дата расхода, тип, статус, оплата, возмещение</p>
          </div>
          <button type="button" className="rep-modal__close" onClick={onClose} aria-label="Закрыть">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="rep-modal__body">
          <div className="rep-field">
            <label className="rep-label">Название отчёта</label>
            <input type="text" className="rep-input" value={config.title} onChange={e => set('title', e.target.value)} placeholder="Отчёт по расходам компании"/>
          </div>

          <div className="rep-field">
            <label className="rep-label">Период (дата расхода)</label>
            <div className="rep-date-row">
              <div className="rep-date-wrap">
                <span className="rep-date-label">С</span>
                <input type="date" className="rep-input rep-input--date" value={config.dateFrom} onChange={e => set('dateFrom', e.target.value)}/>
              </div>
              <div className="rep-date-wrap">
                <span className="rep-date-label">По</span>
                <input type="date" className="rep-input rep-input--date" value={config.dateTo} onChange={e => set('dateTo', e.target.value)}/>
              </div>
            </div>
            <p className="rep-field-hint">Пустое «С» — без нижней границы; пустое «По» — без верхней. Оба пустые — все даты расхода из списка.</p>
          </div>

          <div className="rep-field rep-field--note">
            <p className="rep-label" style={{ marginBottom: '0.35rem' }}>Содержимое файла</p>
            <p className="rep-field-hint">
              В таблицу выгружаются поля заявки: сумма в <strong>UZS</strong>, курс <strong>UZS/USD</strong>, эквивалент в <strong>USD</strong> (как в системе),
              срок оплаты, проект, контрагент, комментарий, способ оплаты и статус.
            </p>
          </div>

          <div className="rep-field">
            <label className="rep-label">Типы расходов</label>
            <ReportAllToggle id="types" label="Все типы" checked={allTypes} onToggle={handleAllTypes}/>
            {!allTypes && (<div className="rep-check-grid rep-check-grid--wide">
                {EXPENSE_TYPES.map(t => (<label key={t.value} className={`rep-check${config.selectedTypes.includes(t.value) ? ' rep-check--on' : ''}`}>
                    <input type="checkbox" checked={config.selectedTypes.includes(t.value)} onChange={() => toggleType(t.value)}/>
                    <span>{t.label}</span>
                  </label>))}
              </div>)}
          </div>

          <div className="rep-field">
            <label className="rep-label">Статусы заявок</label>
            <ReportAllToggle id="statuses" label="Все статусы" checked={allStatuses} onToggle={handleAllStatuses}/>
            {!allStatuses && (<div className="rep-check-grid rep-check-grid--wide">
                {STATUS_OPTIONS.map(s => (<label key={s.value} className={`rep-check${config.selectedStatuses.includes(s.value) ? ' rep-check--on' : ''}`}>
                    <input type="checkbox" checked={config.selectedStatuses.includes(s.value)} onChange={() => toggleStatus(s.value)}/>
                    <span className={`exp-status exp-status--${s.value}`}>{s.label}</span>
                  </label>))}
              </div>)}
          </div>

          <div className="rep-field">
            <label className="rep-label">Способ оплаты</label>
            <ReportAllToggle id="payments" label="Все способы" checked={allPayments} onToggle={handleAllPayments}/>
            {!allPayments && (<div className="rep-check-grid rep-check-grid--wide">
                {PAYMENT_METHODS.map(m => (<label key={m.value} className={`rep-check${config.selectedPaymentMethods.includes(m.value) ? ' rep-check--on' : ''}`}>
                    <input type="checkbox" checked={config.selectedPaymentMethods.includes(m.value)} onChange={() => togglePayment(m.value)}/>
                    <span>{m.label}</span>
                  </label>))}
              </div>)}
            <p className="rep-field-hint">Заявки без указанного способа оплаты попадут в отчёт только при включённом «Все способы».</p>
          </div>

          <div className="rep-field">
            <label className="rep-label">Возмещаемость</label>
            <div className="rep-radio-row rep-radio-row--wide">
              {[
            { value: 'all', label: 'Все' },
            { value: 'reimbursable', label: 'Возмещаемые' },
            { value: 'non_reimbursable', label: 'Невозмещаемые' },
        ].map(o => (<label key={o.value} className={`rep-radio${config.reimbursable === o.value ? ' rep-radio--on' : ''}`}>
                  <input type="radio" name="reimbursable" value={o.value} checked={config.reimbursable === o.value} onChange={() => set('reimbursable', o.value as ReportConfig['reimbursable'])}/>
                  {o.label}
                </label>))}
            </div>
          </div>

          {exportErr && (<p className="rep-field-error" role="alert">{exportErr}</p>)}
        </div>

        <div className="rep-modal__ft">
          <div className="rep-modal__preview">
            <svg viewBox="0 0 20 20" fill="currentColor"><path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
            В отчёт войдёт <strong>{previewCount}</strong>{' '}
            {previewCount === 1 ? 'запись' : previewCount < 5 ? 'записи' : 'записей'}
          </div>
          <div className="rep-modal__actions">
            <button type="button" className="rep-btn rep-btn--ghost" onClick={onClose} disabled={isLoading}>
              Отмена
            </button>
            <button type="button" className="rep-btn rep-btn--primary" onClick={handleGenerate} disabled={isLoading || previewCount === 0}>
              {isLoading ? (<>
                  <svg className="rep-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                  </svg>
                  Формирование…
                </>) : (<>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Скачать Excel
                </>)}
            </button>
          </div>
        </div>
      </div>
    </>);
    return typeof document !== 'undefined' ? createPortal(modal, document.body) : null;
}
