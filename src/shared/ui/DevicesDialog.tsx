import { useCallback, useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiFetch } from '@shared/api';
import { useI18n } from '@shared/i18n';
import { describeUserAgent, type DeviceKind } from '@shared/lib/userAgent';
import './DevicesDialog.css';

type DeviceSession = {
    id: number;
    userAgent: string;
    ip: string;
    createdAt: string | null;
    lastSeenAt: string | null;
    current: boolean;
};

const BASE = '/api/v1/auth/azure/sessions';

function DeviceIcon({ kind }: { kind: DeviceKind }) {
    if (kind === 'phone')
        return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><rect x="7" y="2.5" width="10" height="19" rx="2.2" /><path d="M11 18.5h2" /></svg>;
    if (kind === 'tablet')
        return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><rect x="4.5" y="2.5" width="15" height="19" rx="2.2" /><path d="M11 18.5h2" /></svg>;
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><rect x="3" y="4" width="18" height="12" rx="1.8" /><path d="M8 20h8M12 16v4" /></svg>;
}

/** Profile → Devices: every signed-in device of this account, each can be signed out. */
export function DevicesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { t, locale } = useI18n();
    const titleId = useId();
    const [sessions, setSessions] = useState<DeviceSession[] | null>(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState<number | 'others' | null>(null);

    const load = useCallback(async () => {
        setError('');
        try {
            const response = await apiFetch(BASE, { skipGetDedupe: true });
            if (!response.ok)
                throw new Error(t('header.devicesError'));
            setSessions(((await response.json()) as { sessions: DeviceSession[] }).sessions);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : t('header.devicesError'));
        }
    }, [t]);

    useEffect(() => {
        if (!open)
            return;
        setSessions(null);
        void load();
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, load, onClose]);

    const when = (iso: string | null) => {
        if (!iso)
            return '—';
        const date = new Date(iso);
        const minutes = Math.round((Date.now() - date.getTime()) / 60000);
        if (minutes < 6)
            return t('header.devicesNow');
        return date.toLocaleString(locale === 'en' ? 'en-GB' : 'ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    };

    const end = async (target: number | 'others') => {
        setBusy(target);
        try {
            const response = target === 'others'
                ? await apiFetch(`${BASE}/end-others`, { method: 'POST' })
                : await apiFetch(`${BASE}/${target}`, { method: 'DELETE' });
            if (!response.ok && response.status !== 404)
                throw new Error(t('header.devicesError'));
            await load();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : t('header.devicesError'));
        }
        finally {
            setBusy(null);
        }
    };

    if (!open || typeof document === 'undefined')
        return null;
    const others = (sessions ?? []).filter((row) => !row.current).length;
    return createPortal(
        <div className="devices-dialog" role="presentation" onMouseDown={(event) => {
            if (event.target === event.currentTarget)
                onClose();
        }}>
            <div className="devices-dialog__panel" role="dialog" aria-modal="true" aria-labelledby={titleId}>
                <header className="devices-dialog__head">
                    <h2 id={titleId}>{t('header.devicesTitle')}</h2>
                    <button type="button" className="devices-dialog__close" aria-label={t('header.devicesClose')} onClick={onClose}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M6 6l12 12M18 6 6 18" /></svg>
                    </button>
                </header>
                <p className="devices-dialog__hint">{t('header.devicesHint')}</p>
                {error ? <p className="devices-dialog__error" role="alert">{error}</p> : null}
                {sessions === null && !error ? (
                    <ul className="devices-dialog__list" aria-busy="true">
                        {[0, 1].map((key) => <li key={key} className="devices-dialog__row devices-dialog__row--skeleton"><span /><span /></li>)}
                    </ul>
                ) : null}
                {sessions ? (
                    <ul className="devices-dialog__list">
                        {sessions.map((row) => {
                            const device = describeUserAgent(row.userAgent);
                            const title = [device.browser, device.os].filter(Boolean).join(' · ') || t('header.devicesUnknown');
                            return (
                                <li key={row.id} className={`devices-dialog__row${row.current ? ' is-current' : ''}`}>
                                    <span className="devices-dialog__icon"><DeviceIcon kind={device.kind} /></span>
                                    <span className="devices-dialog__info">
                                        <strong>
                                            {title}
                                            {row.current ? <em>{t('header.devicesCurrent')}</em> : null}
                                        </strong>
                                        <small>
                                            {[row.ip, t('header.devicesLastSeen').replace('{when}', when(row.lastSeenAt)), t('header.devicesSince').replace('{when}', when(row.createdAt))].filter(Boolean).join(' · ')}
                                        </small>
                                    </span>
                                    {row.current ? null : (
                                        <button type="button" className="devices-dialog__end" disabled={busy !== null} onClick={() => void end(row.id)}>
                                            {busy === row.id ? '…' : t('header.devicesEnd')}
                                        </button>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                ) : null}
                <footer className="devices-dialog__foot">
                    <button type="button" className="devices-dialog__btn" onClick={onClose}>{t('header.devicesClose')}</button>
                    {others > 0 ? (
                        <button type="button" className="devices-dialog__btn devices-dialog__btn--danger" disabled={busy !== null} onClick={() => void end('others')}>
                            {t('header.devicesEndOthers').replace('{count}', String(others))}
                        </button>
                    ) : null}
                </footer>
            </div>
        </div>,
        document.body,
    );
}
