import { useCallback, useEffect, useRef, useState } from 'react';

export type VacationScheduleHeaderMenuProps = {
    canManage: boolean;
    onAddEmployee: () => void;
    payrollShowColumns: boolean;
    onPayrollToggle: () => void;
    onPayrollParams: () => void;
};

export function VacationScheduleHeaderMenu({
    canManage,
    onAddEmployee,
    payrollShowColumns,
    onPayrollToggle,
    onPayrollParams,
}: VacationScheduleHeaderMenuProps) {
    const [open, setOpen] = useState(false);
    const wrapRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open)
            return;
        const onDown = (e: MouseEvent) => {
            const el = wrapRef.current;
            if (el && e.target instanceof Node && !el.contains(e.target))
                setOpen(false);
        };
        document.addEventListener('mousedown', onDown);
        return () => document.removeEventListener('mousedown', onDown);
    }, [open]);

    const run = useCallback((fn: () => void) => {
        setOpen(false);
        fn();
    }, []);

    return (<div className="vac-page-menu" ref={wrapRef}>
      <button type="button" className={`vac-page-menu__trigger${open ? ' vac-page-menu__trigger--open' : ''}`} onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu">
        Действия
        <svg className="vac-page-menu__chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>
      {open && (<div className="vac-page-menu__dropdown" role="menu">
          {canManage && (<>
              <button type="button" className="vac-page-menu__item" role="menuitem" onClick={() => run(onAddEmployee)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M19 8v6M22 11h-6"/>
                </svg>
                Добавить сотрудника
              </button>
              <div className="vac-page-menu__sep" role="separator"/>
            </>)}
          <button
            type="button"
            className={`vac-page-menu__item vac-page-menu__item--check${payrollShowColumns ? ' vac-page-menu__item--checked' : ''}`}
            role="menuitemcheckbox"
            aria-checked={payrollShowColumns}
            onClick={() => run(onPayrollToggle)}
          >
            <span className="vac-page-menu__check" aria-hidden>{payrollShowColumns ? '✓' : ''}</span>
            Оценка отпускных и больничных
          </button>
          {payrollShowColumns && (<button type="button" className="vac-page-menu__item" role="menuitem" onClick={() => run(onPayrollParams)}>
              Параметры расчёта…
            </button>)}
        </div>)}
    </div>);
}
