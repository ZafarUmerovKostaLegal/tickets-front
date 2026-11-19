import { useState, useSyncExternalStore } from 'react';
import { formatBytes } from '../lib/filesFormat';
import {
    cancelUpload,
    clearFinished,
    pauseUpload,
    queueSnapshot,
    resumeUpload,
    subscribeQueue,
    type QueueItem,
} from '../lib/uploadQueue';
import { Icon, useFm } from './fmShared';

function eta(item: QueueItem): number {
    return item.speed > 0 ? Math.max(0, (item.file.size - item.sent) / item.speed) : 0;
}

function formatEta(seconds: number, tr: ReturnType<typeof useFm>['tr']): string {
    if (seconds <= 0)
        return '';
    if (seconds < 60)
        return tr('uploads.etaSeconds', { count: Math.ceil(seconds) });
    if (seconds < 3600)
        return tr('uploads.etaMinutes', { count: Math.ceil(seconds / 60) });
    return tr('uploads.etaHours', { hours: Math.floor(seconds / 3600), minutes: Math.ceil((seconds % 3600) / 60) });
}

/** Floating panel with large uploads: progress, speed, time left, pause / resume / cancel / retry. */
export function UploadQueuePanel({ onOpen }: { onOpen?: (item: QueueItem) => void }) {
    const { tr, locale } = useFm();
    const items = useSyncExternalStore(subscribeQueue, queueSnapshot, queueSnapshot);
    const [collapsed, setCollapsed] = useState(false);
    if (items.length === 0)
        return null;
    const active = items.filter((item) => item.status === 'uploading' || item.status === 'queued');
    const total = items.reduce((sum, item) => sum + (item.status === 'canceled' ? 0 : item.file.size), 0);
    const sent = items.reduce((sum, item) => sum + (item.status === 'canceled' ? 0 : item.sent), 0);
    const percent = total > 0 ? Math.min(100, Math.round((sent / total) * 100)) : 0;
    const title = active.length
        ? tr('uploads.titleActive', { count: active.length, percent })
        : tr('uploads.titleDone');
    return (
        <section className={`fm-upq${collapsed ? ' is-collapsed' : ''}`} aria-label={tr('uploads.aria')}>
            <header className="fm-upq__head">
                <strong role="status" aria-live="polite">{title}</strong>
                <button type="button" className="fm-upq__icon" aria-label={collapsed ? tr('uploads.expand') : tr('uploads.collapse')} aria-expanded={!collapsed} onClick={() => setCollapsed((value) => !value)}>
                    <Icon name="chevron" />
                </button>
                {active.length === 0 ? (
                    <button type="button" className="fm-upq__icon" aria-label={tr('uploads.close')} onClick={clearFinished}>
                        <Icon name="close" />
                    </button>
                ) : null}
            </header>
            {active.length ? <div className="fm-upq__total" aria-hidden><span style={{ width: `${percent}%` }} /></div> : null}
            {collapsed ? null : (
                <ul className="fm-upq__list">
                    {items.map((item) => {
                        const share = item.file.size > 0 ? Math.round((item.sent / item.file.size) * 100) : 0;
                        const result = item.result;
                        let line = '';
                        if (item.status === 'uploading') {
                            line = item.retrying
                                ? tr('uploads.retrying', { attempt: item.retrying })
                                : [
                                    `${formatBytes(item.sent, locale)} / ${formatBytes(item.file.size, locale)}`,
                                    item.speed > 0 ? `${formatBytes(item.speed, locale)}/s` : '',
                                    formatEta(eta(item), tr),
                                ].filter(Boolean).join(' · ');
                        }
                        else if (item.status === 'queued')
                            line = tr('uploads.queued');
                        else if (item.status === 'paused')
                            line = tr('uploads.paused', { sent: formatBytes(item.sent, locale), size: formatBytes(item.file.size, locale) });
                        else if (item.status === 'error')
                            line = item.error || tr('uploads.failed');
                        else if (item.status === 'canceled')
                            line = tr('uploads.canceled');
                        else if (result)
                            line = tr(`uploads.result.${result.status}`, { name: result.document.name });
                        return (
                            <li key={item.id} className={`fm-upq__row is-${item.status}`}>
                                <div className="fm-upq__main">
                                    <span className="fm-upq__name" title={item.file.name}>{item.file.name}</span>
                                    <span className="fm-upq__line">{line}</span>
                                    {item.status === 'uploading' || item.status === 'paused' || item.status === 'queued' ? (
                                        <span className="fm-upq__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={share} aria-label={item.file.name}>
                                            <span style={{ width: `${share}%` }} />
                                        </span>
                                    ) : null}
                                </div>
                                <div className="fm-upq__actions">
                                    {item.status === 'uploading' ? (
                                        <button type="button" onClick={() => pauseUpload(item.id)}>{tr('uploads.pause')}</button>
                                    ) : null}
                                    {item.status === 'paused' || item.status === 'error' ? (
                                        <button type="button" onClick={() => resumeUpload(item.id)}>{item.status === 'error' ? tr('uploads.retry') : tr('uploads.resume')}</button>
                                    ) : null}
                                    {item.status === 'done' && result && onOpen && item.api === 'files' ? (
                                        <button type="button" onClick={() => onOpen(item)}>{tr('uploads.open')}</button>
                                    ) : null}
                                    {item.status !== 'done' && item.status !== 'canceled' ? (
                                        <button type="button" className="fm-upq__cancel" aria-label={`${tr('uploads.cancel')}: ${item.file.name}`} onClick={() => cancelUpload(item.id)}>
                                            <Icon name="close" />
                                        </button>
                                    ) : null}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}
