import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { formatHoursClockFromDecimalHours } from '@shared/lib/formatTrackingHours';
import { useI18n } from '@shared/i18n';

export type TimesheetDeleteEntry = {
    id: string;
    project: string;
    client: string;
    task: string;
    notes: string;
    hours: number;
    color: string;
};

type TimesheetGrantUnlockConfirmProps = {
    workDateYmd: string;
    busy: boolean;
    onCancel: () => void;
    onConfirm: () => void | Promise<void>;
};

export function TimesheetGrantUnlockConfirm({ workDateYmd, busy, onCancel, onConfirm }: TimesheetGrantUnlockConfirmProps) {
    const { t } = useI18n();
    const titleId = useId();
    const cancelRef = useRef<HTMLButtonElement | null>(null);
    useEffect(() => {
        const timer = window.setTimeout(() => cancelRef.current?.focus(), 0);
        return () => window.clearTimeout(timer);
    }, []);
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                if (!busy)
                    onCancel();
            }
            else if (e.key === 'Enter') {
                e.preventDefault();
                if (!busy)
                    void onConfirm();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [busy, onCancel, onConfirm]);
    if (typeof document === 'undefined')
        return null;

    return createPortal(<div className="tsp-cfm__overlay" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="tsp-cfm__modal" onClick={(e) => e.stopPropagation()}>
            <div className="tsp-cfm__head">
                <div className="tsp-cfm__ico tsp-cfm__ico--unlock" aria-hidden>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        <path d="M9 12l2 2 4-4" />
                    </svg>
                </div>
                <div className="tsp-cfm__head-txt">
                    <h3 id={titleId} className="tsp-cfm__title">{t('timeTrackingPage.grantUnlockConfirm.title')}</h3>
                    <p className="tsp-cfm__sub">{t('timeTrackingPage.grantUnlockConfirm.sub')}</p>
                </div>
                <button type="button" className="tsp-cfm__close" onClick={onCancel} disabled={busy} aria-label={t('timeTrackingPage.close')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
            </div>
            <div className="tsp-cfm__grant-body">
                <p className="tsp-cfm__grant-body-p">
                    {t('timeTrackingPage.grantUnlockConfirm.bodyPrefix')} (<strong>{workDateYmd}</strong>). {t('timeTrackingPage.grantUnlockConfirm.bodySuffix')}
                </p>
            </div>
            <div className="tsp-cfm__foot">
                <button ref={cancelRef} type="button" className="tsp-cfm__btn tsp-cfm__btn--ghost" onClick={onCancel} disabled={busy}>
                    {t('timeTrackingPage.cancel')}
                </button>
                <button type="button" className="tsp-cfm__btn tsp-cfm__btn--primary" onClick={() => void onConfirm()} disabled={busy}>
                    {t('timeTrackingPage.grantUnlockConfirm.confirm')}
                </button>
            </div>
        </div>
    </div>, document.body);
}

type TimesheetDeleteConfirmProps = {
    entry: TimesheetDeleteEntry;
    busy: boolean;
    onCancel: () => void;
    onConfirm: () => void | Promise<void>;
};

export function TimesheetDeleteConfirm({ entry, busy, onCancel, onConfirm }: TimesheetDeleteConfirmProps) {
    const { t } = useI18n();
    const cancelRef = useRef<HTMLButtonElement | null>(null);
    useEffect(() => {
        const timer = window.setTimeout(() => cancelRef.current?.focus(), 0);
        return () => window.clearTimeout(timer);
    }, []);
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                if (!busy)
                    onCancel();
            }
            else if (e.key === 'Enter') {
                e.preventDefault();
                if (!busy)
                    void onConfirm();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [busy, onCancel, onConfirm]);
    if (typeof document === 'undefined')
        return null;

    const hoursLabel = formatHoursClockFromDecimalHours(entry.hours);

    return createPortal(<div className="tsp-cfm__overlay" role="dialog" aria-modal="true" aria-labelledby="tsp-cfm-title">
        <div className="tsp-cfm__modal" onClick={(e) => e.stopPropagation()}>
            <div className="tsp-cfm__head">
                <div className="tsp-cfm__ico" aria-hidden>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 9v4M12 17h.01" />
                        <path d="M10.3 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.7 3.86a2 2 0 00-3.4 0z" />
                    </svg>
                </div>
                <div className="tsp-cfm__head-txt">
                    <h3 id="tsp-cfm-title" className="tsp-cfm__title">{t('timeTrackingPage.deleteConfirm.title')}</h3>
                    <p className="tsp-cfm__sub">{t('timeTrackingPage.deleteConfirm.sub')}</p>
                </div>
                <button type="button" className="tsp-cfm__close" onClick={onCancel} disabled={busy} aria-label={t('timeTrackingPage.close')}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
            </div>
            <div className="tsp-cfm__card">
                <span className="tsp-cfm__card-bar" style={{ background: entry.color }} aria-hidden />
                <div className="tsp-cfm__card-txt">
                    <p className="tsp-cfm__card-proj">
                        <strong>{entry.project}</strong>
                        <span className="tsp-cfm__card-client">({entry.client})</span>
                    </p>
                    {entry.task ? <p className="tsp-cfm__card-task">{entry.task}</p> : null}
                    {entry.notes ? <p className="tsp-cfm__card-notes">{entry.notes}</p> : null}
                </div>
                <div className="tsp-cfm__card-h">{hoursLabel}</div>
            </div>
            <div className="tsp-cfm__foot">
                <button ref={cancelRef} type="button" className="tsp-cfm__btn tsp-cfm__btn--ghost" onClick={onCancel} disabled={busy}>
                    {t('timeTrackingPage.cancel')}
                </button>
                <button type="button" className="tsp-cfm__btn tsp-cfm__btn--danger" onClick={() => void onConfirm()} disabled={busy}>
                    {busy ? t('timeTrackingPage.deleting') : t('timeTrackingPage.delete')}
                </button>
            </div>
        </div>
    </div>, document.body);
}
