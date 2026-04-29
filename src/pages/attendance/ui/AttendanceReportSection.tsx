import { useRef, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { formatDateOnly, formatTime } from '@shared/lib/formatDate';
import { uploadAttendanceExplanation } from '@entities/attendance';
import { createAuthenticatedMediaBlobUrl } from '@shared/api';
import type { GroupedRow } from '../model/types';
import type { WorkdaySettings } from '@shared/lib/attendanceSettings';
import { AttendanceDatePicker } from './AttendanceDatePicker';
import { AttendanceSelect } from './AttendanceSelect';
const ALLOWED_EXPLANATION_EXT = /\.(jpe?g|png|webp|gif)$/i;
function isLate(row: GroupedRow, settings: WorkdaySettings): boolean {
    if (!row.firstTime)
        return false;
    const d = new Date(row.firstTime);
    const [sh, sm] = settings.startTime.split(':').map(Number);
    const threshold = (sh || 0) * 60 + (sm || 0) + settings.lateMinutes;
    const arrived = d.getHours() * 60 + d.getMinutes();
    return arrived > threshold;
}
function rowClassName(r: GroupedRow, settings: WorkdaySettings): string {
    if (r.status === 'absent')
        return 'att__row--absent';
    if (r.status === 'present_on_time')
        return 'att__row--present';
    if (r.status === 'late')
        return 'att__row--late';
    return isLate(r, settings) ? 'att__row--late' : '';
}
type AttendanceReportSectionProps = {
    dateFrom: string;
    setDateFrom: (v: string) => void;
    dateTo: string;
    setDateTo: (v: string) => void;
    search: string;
    setSearch: (v: string) => void;
    typeFilter: string;
    setTypeFilter: (v: string) => void;
    groupedRecords: GroupedRow[];
    filteredGroupedRecords: GroupedRow[];
    loading: boolean;
    error: boolean;
    recordsCount: number;
    showTable: boolean;
    load: () => void;
    onReset: () => void;
    onExportExcel: () => void;
    settings: WorkdaySettings;
    typeFilterOptions: readonly {
        value: string;
        label: string;
    }[];
    isDailyMode: boolean;
};
export function AttendanceReportSection({ dateFrom, setDateFrom, dateTo, setDateTo, search, setSearch, typeFilter, setTypeFilter, groupedRecords, filteredGroupedRecords, loading, error, recordsCount, showTable, load, onReset, onExportExcel, settings, typeFilterOptions, isDailyMode, }: AttendanceReportSectionProps) {
    const explainFileRef = useRef<HTMLInputElement>(null);
    const pendingExplainRow = useRef<GroupedRow | null>(null);
    const [uploadingExplainKey, setUploadingExplainKey] = useState<string | null>(null);
    const [openingPhotoKey, setOpeningPhotoKey] = useState<string | null>(null);
    const [explainUploadError, setExplainUploadError] = useState<string | null>(null);
    const [photoPreviewBlobUrl, setPhotoPreviewBlobUrl] = useState<string | null>(null);
    const startExplainUpload = useCallback((row: GroupedRow) => {
        setExplainUploadError(null);
        pendingExplainRow.current = row;
        explainFileRef.current?.click();
    }, []);
    const onExplainFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        const row = pendingExplainRow.current;
        pendingExplainRow.current = null;
        if (!file || !row || !isDailyMode)
            return;
        const cam = row.cameraEmployeeNo;
        const st = row.status;
        if (!cam || (st !== 'late' && st !== 'absent'))
            return;
        if (!ALLOWED_EXPLANATION_EXT.test(file.name)) {
            setExplainUploadError('Допустимы только файлы: JPG, PNG, WebP, GIF.');
            return;
        }
        setUploadingExplainKey(row.key);
        setExplainUploadError(null);
        try {
            await uploadAttendanceExplanation({
                day: row.date,
                cameraEmployeeNo: cam,
                status: st,
                appUserId: row.appUserId,
                file,
            });
            await load();
        }
        catch (err) {
            setExplainUploadError(err instanceof Error ? err.message : 'Не удалось загрузить файл');
        }
        finally {
            setUploadingExplainKey(null);
        }
    }, [isDailyMode, load]);
    const handleOpenExplanationPhoto = useCallback(async (row: GroupedRow) => {
        const url = row.explanationFileUrl;
        if (!url)
            return;
        setOpeningPhotoKey(row.key);
        setExplainUploadError(null);
        try {
            const blobUrl = await createAuthenticatedMediaBlobUrl(url);
            setPhotoPreviewBlobUrl((prev) => {
                if (prev)
                    URL.revokeObjectURL(prev);
                return blobUrl;
            });
        }
        catch (e) {
            setExplainUploadError(e instanceof Error ? e.message : 'Не удалось открыть фото');
        }
        finally {
            setOpeningPhotoKey(null);
        }
    }, []);
    const closePhotoPreview = useCallback(() => {
        setPhotoPreviewBlobUrl((prev) => {
            if (prev)
                URL.revokeObjectURL(prev);
            return null;
        });
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
    return (<section className="att__card">
      <div className="att__card-head">
        <h2 className="att__card-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          Отчёт по посещаемости
        </h2>
        {loading ? (<span className="att__card-count att__card-count--skel">
            <span className="att__skel att__skel--count"/>
          </span>) : (<span className="att__card-count">{groupedRecords.length}</span>)}
      </div>

      <div className="att__toolbar">
        <div className="att__search-wrap">
          <svg className="att__search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input type="search" className="att__search" placeholder={isDailyMode ? 'ФИО или email…' : 'Введите ФИО или имя…'} value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()}/>
        </div>
        <div className="att__toolbar-group">
          <label className="att__field">
            <span className="att__field-label">Период с</span>
            <AttendanceDatePicker value={dateFrom} onChange={setDateFrom}/>
          </label>
          <label className="att__field">
            <span className="att__field-label">по</span>
            <AttendanceDatePicker value={dateTo} onChange={setDateTo}/>
          </label>
          <label className="att__field">
            <span className="att__field-label">Тип</span>
            <AttendanceSelect value={typeFilter} options={typeFilterOptions} onChange={setTypeFilter} placeholder="Все"/>
          </label>
        </div>
        <div className="att__toolbar-actions">
          <button type="button" className="att__btn att__btn--ghost" onClick={onReset}>Сброс</button>
          <button type="button" className="att__btn att__btn--accent" onClick={onExportExcel} disabled={!filteredGroupedRecords.length || loading}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <path d="M8 13h2"/>
              <path d="M8 17h2"/>
              <path d="M14 13h2"/>
              <path d="M14 17h2"/>
            </svg>
            Excel
          </button>
        </div>
      </div>

      {isDailyMode && explainUploadError && (<div className="att__explain-banner" role="alert">
          <span>{explainUploadError}</span>
          <button type="button" className="att__explain-banner-dismiss" onClick={() => setExplainUploadError(null)}>
            Закрыть
          </button>
        </div>)}

      <input ref={explainFileRef} type="file" className="att__explain-file-input" accept=".jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif" aria-hidden tabIndex={-1} onChange={onExplainFileChange}/>

      {loading && (<div className="att__table-wrap att__table-wrap--skeleton">
          <table className="att__table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Сотрудник</th>
                <th>Приход</th>
                <th>Уход</th>
                <th>Точка прохода</th>
                {isDailyMode && <th>Объяснение</th>}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 8 }).map((_, i) => (<tr key={i}>
                  <td data-label="Дата"><span className="att__skel att__skel--date"/></td>
                  <td data-label="Сотрудник"><span className="att__skel att__skel--name"/></td>
                  <td data-label="Приход"><span className="att__skel att__skel--time"/></td>
                  <td data-label="Уход"><span className="att__skel att__skel--time"/></td>
                  <td data-label="Точка прохода"><span className="att__skel att__skel--checkpoint"/></td>
                  {isDailyMode && (<td data-label="Объяснение"><span className="att__skel att__skel--checkpoint"/></td>)}
                </tr>))}
            </tbody>
          </table>
        </div>)}

      {showTable && (<div className="att__table-wrap">
          <table className="att__table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Сотрудник</th>
                <th>Приход</th>
                <th>Уход</th>
                <th>Точка прохода</th>
                {isDailyMode && <th>Объяснение</th>}
              </tr>
            </thead>
            <tbody>
              {filteredGroupedRecords.map((r) => {
                const late = r.status ? r.status === 'late' : isLate(r, settings);
                const absent = r.status === 'absent';
                const arrivalStatus: 'ontime' | 'late' | 'absent' | null = absent
                    ? 'absent'
                    : r.firstTime
                        ? late
                            ? 'late'
                            : 'ontime'
                        : null;
                return (<tr key={r.key} className={rowClassName(r, settings)}>
                    <td className="att__td-date" data-label="Дата">{r.date ? formatDateOnly(r.date) : '—'}</td>
                    <td className="att__td-name" data-label="Сотрудник">{r.name || '—'}</td>
                    <td className="att__td-time" data-label="Приход">
                      {absent ? (<span className="att__arrival att__arrival--absent">
                          —
                          <span className="att__arrival-badge att__arrival-badge--absent" title="Не пришёл">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10"/>
                              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                            </svg>
                          </span>
                        </span>) : r.firstTime ? (<span className={`att__arrival att__arrival--${arrivalStatus}`}>
                          {formatTime(r.firstTime)}
                          {arrivalStatus === 'late' ? (<span className="att__arrival-badge att__arrival-badge--late" title="Опоздал">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"/>
                                <line x1="12" y1="8" x2="12" y2="12"/>
                                <line x1="12" y1="16" x2="12.01" y2="16"/>
                              </svg>
                            </span>) : (<span className="att__arrival-badge att__arrival-badge--ontime" title="Вовремя">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 6 9 17l-5-5"/>
                              </svg>
                            </span>)}
                        </span>) : ('—')}
                    </td>
                    <td className="att__td-time" data-label="Уход">{r.lastTime ? formatTime(r.lastTime) : '—'}</td>
                    <td data-label="Точка прохода">
                      {r.firstCheckpoint === r.lastCheckpoint
                        ? r.firstCheckpoint
                        : `${r.firstCheckpoint} → ${r.lastCheckpoint}`}
                    </td>
                    {isDailyMode && (<td className="att__td-explain" data-label="Объяснение">
                        {r.status === 'late' || r.status === 'absent' ? (r.explanationFileUrl ? (<div className="att__explain-cell">
                              <button type="button" className="att__explain-link" disabled={openingPhotoKey === r.key} onClick={() => handleOpenExplanationPhoto(r)}>
                                {openingPhotoKey === r.key ? 'Открытие…' : 'Открыть фото'}
                              </button>
                              {r.explanationText ? (<span className="att__explain-text" title={r.explanationText}>
                                  {r.explanationText}
                                </span>) : null}
                            </div>) : (<button type="button" className="att__btn att__btn--ghost att__explain-upload" disabled={uploadingExplainKey === r.key || !r.cameraEmployeeNo} onClick={() => startExplainUpload(r)}>
                              {uploadingExplainKey === r.key ? 'Загрузка…' : 'Загрузить объяснение'}
                            </button>)) : ('—')}
                      </td>)}
                  </tr>);
            })}
            </tbody>
          </table>
        </div>)}

      {!loading && !error && recordsCount === 0 && (<div className="att__empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          <p className="att__empty-title">Нет данных о посещаемости</p>
          <p className="att__empty-desc">Убедитесь, что сервис attendance запущен и доступен.</p>
        </div>)}

      {photoPreviewBlobUrl &&
            typeof document !== 'undefined' &&
            createPortal(<div className="att-modal att-modal--explain-photo" role="dialog" aria-modal="true" aria-label="Фото объяснительной">
            <div className="att-modal__backdrop" onClick={closePhotoPreview}/>
            <div className="att-modal__dialog att-modal__dialog--explain-photo">
              <button type="button" className="att-modal__close" onClick={closePhotoPreview} aria-label="Закрыть">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
              <div className="att__explain-photo-wrap">
                <img src={photoPreviewBlobUrl} alt="Объяснительная" className="att__explain-photo-img"/>
              </div>
            </div>
          </div>, document.body)}
    </section>);
}
