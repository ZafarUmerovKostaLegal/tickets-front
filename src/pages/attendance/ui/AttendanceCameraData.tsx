import { useCallback, useEffect, useRef, useState } from 'react';
import {
    fetchCameraIngestStatus,
    importAttendanceTransactionCsv,
    startCameraBackfill,
    type CameraIngestStatus,
} from '@entities/attendance';
import { useI18n } from '@shared/i18n';
import { useAppToast } from '@shared/ui';

function fill(template: string, values: Record<string, string | number>): string {
    return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ''));
}

function shortDate(iso: string | null | undefined, locale: string): string {
    if (!iso)
        return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime()))
        return iso.slice(0, 10);
    return d.toLocaleDateString(locale === 'en' ? 'en-GB' : 'ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function clock(iso: string | null | undefined, locale: string): string {
    if (!iso)
        return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime()))
        return '—';
    return d.toLocaleTimeString(locale === 'en' ? 'en-GB' : 'ru-RU', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Where attendance comes from: the door terminals are polled automatically; managers can
 * re-pull a period from the cameras or load a Transaction CSV export with older history.
 */
export function AttendanceCameraData({ periodFrom, periodTo, canManage, onDataChanged }: {
    periodFrom: string;
    periodTo: string;
    canManage: boolean;
    onDataChanged: () => void;
}) {
    const { t, locale } = useI18n();
    const { pushToast } = useAppToast();
    const [status, setStatus] = useState<CameraIngestStatus | null>(null);
    const [busy, setBusy] = useState<'refresh' | 'import' | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);
    const waitingBackfill = useRef(false);

    const loadStatus = useCallback(async () => {
        try {
            const next = await fetchCameraIngestStatus();
            setStatus(next);
            return next;
        }
        catch {
            return null;
        }
    }, []);

    useEffect(() => {
        void loadStatus();
        const timer = window.setInterval(() => {
            if (!document.hidden)
                void loadStatus();
        }, 60_000);
        return () => window.clearInterval(timer);
    }, [loadStatus]);

    // While a backfill runs, follow it and reload the report once it is done.
    useEffect(() => {
        if (busy !== 'refresh')
            return;
        const timer = window.setInterval(async () => {
            const next = await loadStatus();
            if (!next || next.backfill_running)
                return;
            window.clearInterval(timer);
            setBusy(null);
            if (!waitingBackfill.current)
                return;
            waitingBackfill.current = false;
            if (next.backfill_error) {
                pushToast({ message: next.backfill_error, variant: 'error' });
                return;
            }
            pushToast({
                message: fill(t('attendancePage.camera.refreshDone'), { count: next.backfill_result?.upserted ?? 0 }),
                variant: 'success',
            });
            onDataChanged();
        }, 3000);
        return () => window.clearInterval(timer);
    }, [busy, loadStatus, onDataChanged, pushToast, t]);

    const refreshFromCameras = async () => {
        setBusy('refresh');
        try {
            await startCameraBackfill(periodFrom, periodTo);
            waitingBackfill.current = true;
        }
        catch (e) {
            setBusy(null);
            pushToast({ message: e instanceof Error ? e.message : String(e), variant: 'error' });
        }
    };

    const importCsv = async (file: File) => {
        if (!file.name.toLowerCase().endsWith('.csv')) {
            pushToast({ message: t('attendancePage.camera.onlyCsv'), variant: 'error' });
            return;
        }
        if (file.size === 0) {
            pushToast({ message: t('attendancePage.camera.importEmpty'), variant: 'error' });
            return;
        }
        setBusy('import');
        try {
            const result = await importAttendanceTransactionCsv(file);
            if (!result.rows_mapped) {
                pushToast({ message: t('attendancePage.camera.importEmpty'), variant: 'error' });
            }
            else {
                pushToast({
                    message: fill(t('attendancePage.camera.importDone'), {
                        count: result.upserted || result.rows_mapped,
                        from: shortDate(result.date_min, locale),
                        to: shortDate(result.date_max, locale),
                    }),
                    variant: 'success',
                });
            }
            const unmapped = Object.keys(result.unmapped_names ?? {});
            if (unmapped.length) {
                pushToast({
                    message: fill(t('attendancePage.camera.importUnmapped'), {
                        names: unmapped.slice(0, 8).join(', ') + (unmapped.length > 8 ? ` +${unmapped.length - 8}` : ''),
                    }),
                    variant: 'warning',
                });
            }
            await loadStatus();
            onDataChanged();
        }
        catch (e) {
            pushToast({ message: e instanceof Error ? e.message : String(e), variant: 'error' });
        }
        finally {
            setBusy(null);
        }
    };

    const stored = status && status.events_total > 0
        ? fill(t('attendancePage.camera.stored'), {
            count: status.events_total.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU'),
            from: shortDate(status.min_event_time, locale),
            to: shortDate(status.max_event_time, locale),
        })
        : status ? t('attendancePage.camera.storedEmpty') : '…';
    const poll = !status
        ? null
        : status.last_poll_error
            ? { tone: 'error', text: fill(t('attendancePage.camera.pollError'), { error: status.last_poll_error.slice(0, 120) }) }
            : status.poller_running === false
                ? { tone: 'warn', text: t('attendancePage.camera.pollerOff') }
                : status.last_poll_at
                    ? { tone: 'ok', text: fill(t('attendancePage.camera.lastPoll'), { time: clock(status.last_poll_at, locale) }) }
                    : null;

    return (
        <div className="att-camera" aria-label={t('attendancePage.camera.title')}>
            <span className={`att-camera__dot att-camera__dot--${poll?.tone ?? 'idle'}`} aria-hidden />
            <div className="att-camera__info">
                <strong>{t('attendancePage.camera.title')}</strong>
                <span>
                    {stored}
                    {poll ? <> · <span className={`att-camera__poll att-camera__poll--${poll.tone}`}>{poll.text}</span></> : null}
                </span>
            </div>
            {canManage ? (
                <div className="att-camera__actions">
                    <button
                        type="button"
                        className="att-camera__btn"
                        title={t('attendancePage.camera.refreshHint')}
                        disabled={busy !== null || Boolean(status?.backfill_running)}
                        onClick={() => void refreshFromCameras()}
                    >
                        {busy === 'refresh' || status?.backfill_running ? t('attendancePage.camera.refreshing') : t('attendancePage.camera.refresh')}
                    </button>
                    <button
                        type="button"
                        className="att-camera__btn"
                        title={t('attendancePage.camera.importHint')}
                        disabled={busy !== null}
                        onClick={() => fileRef.current?.click()}
                    >
                        {busy === 'import' ? t('attendancePage.camera.importing') : t('attendancePage.camera.import')}
                    </button>
                    <input
                        ref={fileRef}
                        type="file"
                        accept=".csv,text/csv"
                        hidden
                        onChange={(event) => {
                            const file = event.target.files?.[0];
                            event.target.value = '';
                            if (file)
                                void importCsv(file);
                        }}
                    />
                </div>
            ) : null}
        </div>
    );
}
