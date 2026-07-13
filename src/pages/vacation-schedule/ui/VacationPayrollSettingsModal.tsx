import { useEffect, useRef, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import type { VacationPayrollParams } from '../lib/vacationPayrollFormulas';
import './VacationScheduleImportModal.css';

type Props = {
    open: boolean;
    onClose: () => void;
    params: VacationPayrollParams;
    onSave: (patch: Partial<VacationPayrollParams>) => void;
};

export function VacationPayrollSettingsModal({ open, onClose, params, onSave }: Props) {
    const prevOpenRef = useRef(false);

    useEffect(() => {
        prevOpenRef.current = open;
    }, [open]);

    useEffect(() => {
        if (!open)
            return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape')
                onClose();
        };
        document.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = '';
        };
    }, [open, onClose]);

    if (!open)
        return null;

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        onClose();
    };

    return createPortal(
        <div className="vac-import-modal" role="dialog" aria-modal="true" aria-labelledby="vac-payroll-modal-title">
            <button type="button" className="vac-import-modal__backdrop" aria-label="Закрыть" onClick={onClose}/>
            <form className="vac-import-modal__panel" onSubmit={handleSubmit}>
                <header className="vac-import-modal__header">
                    <h2 id="vac-payroll-modal-title" className="vac-import-modal__title">
                        Параметры расчёта выплат
                    </h2>
                    <button type="button" className="vac-import-modal__close" onClick={onClose} aria-label="Закрыть">
                        ×
                    </button>
                </header>
                <div className="vac-import-modal__body vac-vsg__payroll-fields vac-vsg__payroll-fields--modal">
                    <label className="vac-vsg__payroll-field">
                        <span>Средняя зарплата / мес., ₽</span>
                        <input
                            type="number"
                            min={0}
                            step={1000}
                            className="vac-vsg__payroll-input"
                            value={params.avgMonthlySalary > 0 ? params.avgMonthlySalary : ''}
                            onChange={(e) => {
                                const raw = e.target.value.trim();
                                if (raw === '') {
                                    onSave({ avgMonthlySalary: 0 });
                                    return;
                                }
                                const v = Number.parseFloat(raw);
                                onSave({ avgMonthlySalary: Number.isFinite(v) && v >= 0 ? v : 0 });
                            }}
                            placeholder="0"
                        />
                    </label>
                    <label className="vac-vsg__payroll-field">
                        <span>Ср. кал. дней в мес.</span>
                        <input
                            type="number"
                            min={1}
                            max={31}
                            step={0.1}
                            className="vac-vsg__payroll-input vac-vsg__payroll-input--narrow"
                            value={params.avgCalendarDaysPerMonth}
                            onChange={(e) => {
                                const v = Number.parseFloat(e.target.value);
                                onSave({
                                    avgCalendarDaysPerMonth: Number.isFinite(v) ? Math.min(31, Math.max(1, v)) : 29.3,
                                });
                            }}
                        />
                    </label>
                    <label className="vac-vsg__payroll-field">
                        <span>Ставка больничного (0–1)</span>
                        <input
                            type="number"
                            min={0}
                            max={1}
                            step={0.05}
                            className="vac-vsg__payroll-input vac-vsg__payroll-input--narrow"
                            value={params.sickLeavePayRate}
                            onChange={(e) => {
                                const v = Number.parseFloat(e.target.value);
                                onSave({
                                    sickLeavePayRate: Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.6,
                                });
                            }}
                        />
                    </label>
                    <label className="vac-vsg__payroll-field">
                        <span>Коэфф. отпуска (0–2)</span>
                        <input
                            type="number"
                            min={0}
                            max={2}
                            step={0.05}
                            className="vac-vsg__payroll-input vac-vsg__payroll-input--narrow"
                            value={params.vacationPayRate}
                            onChange={(e) => {
                                const v = Number.parseFloat(e.target.value);
                                onSave({
                                    vacationPayRate: Number.isFinite(v) ? Math.min(2, Math.max(0, v)) : 1,
                                });
                            }}
                        />
                    </label>
                </div>
                <p className="vac-vsg__payroll-note">
                    Ориентир: среднедневной = зарплата / ср. дней в месяце. Не учитывает лимиты ФСС, стаж, МРОТ и пр.
                </p>
                <footer className="vac-import-modal__footer">
                    <button type="button" className="vac-import-modal__btn vac-import-modal__btn--ghost" onClick={onClose}>
                        Закрыть
                    </button>
                    <button type="submit" className="vac-import-modal__btn vac-import-modal__btn--primary">
                        Готово
                    </button>
                </footer>
            </form>
        </div>,
        document.body,
    );
}
