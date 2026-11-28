import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiFetch } from '@shared/api';
import { routes } from '@shared/config';
import { useI18n } from '@shared/i18n';
import './OutlookPairPage.css';

type Phase = 'idle' | 'busy' | 'done';

function cleanCode(raw: string): string {
    const value = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    return value.length > 4 ? `${value.slice(0, 4)}-${value.slice(4)}` : value;
}

function deviceLabel(userAgent: string): string {
    const ua = userAgent || '';
    const os = /iPhone|iPad|iOS/i.test(ua) ? 'iOS' : /Android/i.test(ua) ? 'Android' : /Mac OS X|Macintosh/i.test(ua) ? 'macOS' : /Windows/i.test(ua) ? 'Windows' : '';
    const app = /Outlook/i.test(ua) ? 'Outlook' : /Edg\//i.test(ua) ? 'Edge' : /Chrome\//i.test(ua) ? 'Chrome' : /Safari\//i.test(ua) ? 'Safari' : '';
    return [app, os].filter(Boolean).join(' · ') || ua.slice(0, 80);
}

export function OutlookPairPage() {
    const { t } = useI18n();
    const [params] = useSearchParams();
    const [code, setCode] = useState(() => cleanCode(params.get('code') ?? ''));
    const [info, setInfo] = useState<{ code: string; device: string } | null>(null);
    const [phase, setPhase] = useState<Phase>('idle');
    const [error, setError] = useState('');
    const ready = code.replace('-', '').length === 8;
    const device = info?.code === code ? info.device : '';

    useEffect(() => {
        if (!ready)
            return;
        const controller = new AbortController();
        void apiFetch(`/api/v1/auth/outlook/pair/info?code=${encodeURIComponent(code)}`, { signal: controller.signal })
            .then(async (response) => {
                if (response.status === 404) {
                    setError(t('outlookPair.notFound'));
                    return;
                }
                if (response.ok) {
                    const body = await response.json() as { device?: string };
                    setError('');
                    setInfo({ code, device: deviceLabel(body.device ?? '') });
                }
            })
            .catch(() => undefined);
        return () => controller.abort();
    }, [code, ready, t]);

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        if (!ready || phase === 'busy')
            return;
        setPhase('busy');
        setError('');
        try {
            const response = await apiFetch('/api/v1/auth/outlook/pair/confirm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code }),
            });
            if (response.ok) {
                setPhase('done');
                return;
            }
            setError(t(response.status === 404 ? 'outlookPair.notFound' : 'outlookPair.failed'));
        }
        catch {
            setError(t('outlookPair.failed'));
        }
        setPhase('idle');
    };

    return (
        <main className="op-pair">
            <section className="op-pair__card" aria-live="polite">
                {phase === 'done' ? (
                    <>
                        <span className="op-pair__icon op-pair__icon--ok" aria-hidden>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
                        </span>
                        <h1>{t('outlookPair.doneTitle')}</h1>
                        <p className="op-pair__lead">{t('outlookPair.doneText')}</p>
                        <Link className="op-pair__link" to={routes.home}>{t('outlookPair.cancel')}</Link>
                    </>
                ) : (
                    <form onSubmit={(event) => void submit(event)}>
                        <span className="op-pair__icon" aria-hidden>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="5" width="17" height="14" rx="2.5" /><path d="m4 7 8 6 8-6" /></svg>
                        </span>
                        <h1>{t('outlookPair.title')}</h1>
                        <p className="op-pair__lead">{t('outlookPair.lead')}</p>
                        <label className="op-pair__field">
                            <span>{t('outlookPair.codeLabel')}</span>
                            <input value={code} onChange={(event) => setCode(cleanCode(event.target.value))}
                                inputMode="text" autoCapitalize="characters" autoComplete="one-time-code" spellCheck={false}
                                placeholder="ABCD-EFGH" maxLength={9} />
                        </label>
                        {device ? <p className="op-pair__device">{t('outlookPair.device')}: <strong>{device}</strong></p> : null}
                        {error ? <p className="op-pair__error" role="alert">{error}</p> : null}
                        <button type="submit" className="op-pair__btn" disabled={!ready || phase === 'busy'}>
                            {phase === 'busy' ? t('outlookPair.confirming') : t('outlookPair.confirm')}
                        </button>
                        <p className="op-pair__warn">{t('outlookPair.warning')}</p>
                    </form>
                )}
            </section>
        </main>
    );
}
