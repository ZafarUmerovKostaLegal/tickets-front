import { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { createAuthenticatedMediaBlobUrl } from '@shared/api';
import type { LateMetrics } from '../model/types';
type LateSectionProps = {
    lateLoading: boolean;
    lateError: string | null;
    lateMetrics: LateMetrics;
    loadAttendance: () => Promise<void>;
};
export function LateSection({ lateLoading, lateError, lateMetrics, loadAttendance, }: LateSectionProps) {
    const [photoPreviewBlobUrl, setPhotoPreviewBlobUrl] = useState<string | null>(null);
    const [photoLoading, setPhotoLoading] = useState(false);
    const [photoError, setPhotoError] = useState<string | null>(null);
    const closePhotoPreview = useCallback(() => {
        setPhotoPreviewBlobUrl((prev) => {
            if (prev)
                URL.revokeObjectURL(prev);
            return null;
        });
    }, []);
    const openExplanationPhoto = useCallback(async (url: string) => {
        setPhotoLoading(true);
        setPhotoError(null);
        try {
            const blobUrl = await createAuthenticatedMediaBlobUrl(url);
            setPhotoPreviewBlobUrl((prev) => {
                if (prev)
                    URL.revokeObjectURL(prev);
                return blobUrl;
            });
        }
        catch (e) {
            setPhotoError(e instanceof Error ? e.message : 'Не удалось открыть фото');
        }
        finally {
            setPhotoLoading(false);
        }
    }, []);
    useEffect(() => {
        if (!photoPreviewBlobUrl)
            return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape')
                closePhotoPreview();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [photoPreviewBlobUrl, closePhotoPreview]);
    return (<section className="ap__card ap__card--late" style={{ borderRadius: 'var(--ap-card-border-radius)', padding: 'var(--ap-card-padding)', background: 'var(--ap-card-bg)', border: 'var(--ap-card-border)' }}>
      <div className="ap__card-head" style={{ paddingBottom: 'var(--ap-card-head-pb)', marginBottom: 'var(--ap-card-head-mb)', borderBottom: 'var(--ap-card-head-border-bottom)' }}>
        <h2 className="ap__card-title" style={{ fontSize: 'var(--ap-card-title-font-size)', fontWeight: 'var(--ap-card-title-font-weight)', gap: 'var(--ap-card-title-gap)' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          Опоздания сегодня
        </h2>
        <button type="button" className="ap__icon-btn" onClick={loadAttendance} disabled={lateLoading} title="Обновить" style={{ width: 'var(--ap-icon-btn-size)', height: 'var(--ap-icon-btn-size)', borderRadius: 'var(--ap-icon-btn-border-radius)', color: 'var(--ap-icon-btn-color)', background: 'var(--ap-icon-btn-bg)' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
        </button>
      </div>
      {lateError && <p className="ap__inline-error" style={{ color: 'var(--ap-inline-error-color)', fontSize: 'var(--ap-inline-error-font-size)', marginBottom: 'var(--ap-inline-error-mb)' }}>{lateError}</p>}
      {photoError && (<p className="ap__inline-error" style={{ color: 'var(--ap-inline-error-color)', fontSize: 'var(--ap-inline-error-font-size)', marginBottom: 'var(--ap-inline-error-mb)' }}>
          {photoError}
        </p>)}
      <div className="ap__late-stats" style={{ gap: 'var(--late-stats-gap)', marginBottom: 'var(--late-stats-mb)' }}>
        {lateLoading && lateMetrics.total === 0 ? (<div className="ap__late-stats-skel" style={{ gap: 'var(--late-stats-skel-gap)' }}><span className="ap__skel ap__skel--sm" style={{ height: 'var(--ap-skel-sm-height)', width: 'var(--ap-skel-sm-width)', borderRadius: 'var(--ap-skel-border-radius)' }}/><span className="ap__skel ap__skel--md" style={{ height: 'var(--ap-skel-md-height)', width: 'var(--ap-skel-md-width)', borderRadius: 'var(--ap-skel-border-radius)' }}/></div>) : (<>
            <div className="ap__late-stat" style={{ padding: 'var(--late-stat-padding)', borderRadius: 'var(--late-stat-border-radius)', background: 'var(--late-stat-bg)' }}>
              <span className="ap__late-num" style={{ fontSize: 'var(--late-num-font-size)', fontWeight: 'var(--late-num-font-weight)', color: 'var(--late-num-color)' }}>{lateMetrics.total}</span>
              <span className="ap__late-lbl" style={{ fontSize: 'var(--late-lbl-font-size)', color: 'var(--late-lbl-color)', fontWeight: 'var(--late-lbl-font-weight)' }}>Всего</span>
            </div>
            <div className="ap__late-stat ap__late-stat--danger" style={{ padding: 'var(--late-stat-padding)', borderRadius: 'var(--late-stat-border-radius)', background: 'var(--late-stat-danger-bg)' }}>
              <span className="ap__late-num" style={{ fontSize: 'var(--late-num-font-size)', fontWeight: 'var(--late-num-font-weight)', color: 'var(--late-num-danger-color)' }}>{lateMetrics.lateCount}</span>
              <span className="ap__late-lbl" style={{ fontSize: 'var(--late-lbl-font-size)', color: 'var(--late-lbl-color)', fontWeight: 'var(--late-lbl-font-weight)' }}>Опоздали</span>
            </div>
            <div className="ap__late-stat ap__late-stat--ok" style={{ padding: 'var(--late-stat-padding)', borderRadius: 'var(--late-stat-border-radius)', background: 'var(--late-stat-ok-bg)' }}>
              <span className="ap__late-num" style={{ fontSize: 'var(--late-num-font-size)', fontWeight: 'var(--late-num-font-weight)', color: 'var(--late-num-ok-color)' }}>{lateMetrics.onTime}</span>
              <span className="ap__late-lbl" style={{ fontSize: 'var(--late-lbl-font-size)', color: 'var(--late-lbl-color)', fontWeight: 'var(--late-lbl-font-weight)' }}>Вовремя</span>
            </div>
          </>)}
      </div>
      <div className="ap__late-bar" style={{ marginBottom: 'var(--late-bar-mb)' }}>
        {lateLoading && lateMetrics.total === 0 ? (<div className="ap__skel ap__skel--lg" style={{ height: 8 }}/>) : (<>
            <div className="ap__late-bar-ok" style={{ width: lateMetrics.total ? `${(lateMetrics.onTime / lateMetrics.total) * 100}%` : '0%' }}/>
            <div className="ap__late-bar-bad" style={{ width: lateMetrics.total ? `${(lateMetrics.lateCount / lateMetrics.total) * 100}%` : '0%' }}/>
          </>)}
      </div>
      <div className="ap__late-list-wrap">
        {lateLoading && lateMetrics.total === 0 && (<ul className="ap__late-list">
            {Array.from({ length: 3 }).map((_, idx) => (<li key={`late-skel-${idx}`} className="ap__late-item"><span className="ap__skel ap__skel--md"/><span className="ap__skel ap__skel--sm"/></li>))}
          </ul>)}
        {!lateLoading && !lateError && lateMetrics.lateEmployees.length === 0 && (<p className="ap__empty-hint">Опоздавших за сегодня не обнаружено</p>)}
        {!lateLoading && lateMetrics.lateEmployees.length > 0 && (<ul className="ap__late-list">
            {lateMetrics.lateEmployees.slice(0, 5).map((r) => (<li key={`${r.name}-${r.firstTime}`} className="ap__late-item" style={{ padding: 'var(--late-item-padding)', gap: 'var(--late-item-gap)', borderTop: 'var(--late-item-border-top)' }}>
                <div>
                  <span className="ap__late-name" style={{ fontSize: 'var(--late-name-font-size)', fontWeight: 'var(--late-name-font-weight)', color: 'var(--late-name-color)' }}>{r.name}</span>
                  <span className="ap__late-dept" style={{ fontSize: 'var(--late-dept-font-size)', color: 'var(--late-dept-color)' }}>{r.department}</span>
                  {(r.explanationText || r.explanationFileUrl) && (<div className="ap__late-explain">
                      {r.explanationText ? (<span className="ap__late-explain-text">{r.explanationText}</span>) : null}
                      {r.explanationFileUrl ? (<button type="button" className="ap__late-explain-photo" disabled={photoLoading} onClick={() => openExplanationPhoto(r.explanationFileUrl!)}>
                          {photoLoading ? 'Загрузка…' : 'Открыть фото'}
                        </button>) : null}
                    </div>)}
                </div>
                <div className="ap__late-meta" style={{ gap: 'var(--late-meta-gap)' }}>
                  <span className="ap__late-time" style={{ fontSize: 'var(--late-time-font-size)', color: 'var(--late-time-color)' }}>{new Date(r.firstTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="ap__late-badge" style={{ fontSize: 'var(--late-badge-font-size)', fontWeight: 'var(--late-badge-font-weight)', color: 'var(--late-badge-color)', background: 'var(--late-badge-bg)', padding: 'var(--late-badge-padding)', borderRadius: 'var(--late-badge-border-radius)' }}>+{Math.round(r.minutesLate)} мин</span>
                </div>
              </li>))}
          </ul>)}
      </div>

      {photoPreviewBlobUrl &&
            typeof document !== 'undefined' &&
            createPortal(<div className="ap__late-photo-modal" role="dialog" aria-modal="true" aria-label="Фото объяснительной">
            <div className="ap__late-photo-backdrop" onClick={closePhotoPreview}/>
            <div className="ap__late-photo-dialog">
              <button type="button" className="ap__late-photo-close" onClick={closePhotoPreview} aria-label="Закрыть">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
              <img src={photoPreviewBlobUrl} alt="Объяснительная" className="ap__late-photo-img"/>
            </div>
          </div>, document.body)}
    </section>);
}
