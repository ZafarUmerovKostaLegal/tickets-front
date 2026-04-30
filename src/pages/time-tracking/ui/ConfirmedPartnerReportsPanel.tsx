import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    exportReportSnapshot,
    fetchReportsMeta,
    listPartnerReportConfirmationsConfirmed,
    listTimeTrackingUsers,
    type PartnerReportConfirmationRequest,
    type TimeTrackingUserRow,
    PARTNER_CONFIRMED_REPORTS_INVALIDATE_EVENT,
} from '@entities/time-tracking';
import { formatIsoRangeTitle } from '@entities/time-tracking/lib/reportsPeriodRange';
import { writeReportPreviewTransfer } from '@entities/time-tracking/model/reportPreviewTransfer';
import { routes } from '@shared/config';
import { useAppDialog } from '@shared/ui';

const IcoRefresh = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
  <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
  <path d="M3 3v5h5" />
  <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
  <path d="M16 21h5v-5" />
</svg>);

function fmtIsoWhen(iso: string | null | undefined): string {
    if (!iso?.trim())
        return '—';
    try {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime()))
            return iso;
        return d.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
    }
    catch {
        return iso;
    }
}

function userLabel(map: Map<number, string>, id: number): string {
    return map.get(id) ?? `ID ${id}`;
}

function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

export function ConfirmedPartnerReportsPanel() {
    const navigate = useNavigate();
    const { showAlert } = useAppDialog();
    const [rows, setRows] = useState<PartnerReportConfirmationRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshBusy, setRefreshBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const [usersById, setUsersById] = useState<Map<number, string>>(new Map());
    const [exportBusySnapshotId, setExportBusySnapshotId] = useState<string | null>(null);

    const loadUsers = useCallback(() => {
        void listTimeTrackingUsers().then((list: TimeTrackingUserRow[]) => {
            const m = new Map<number, string>();
            for (const r of list) {
                const label = r.display_name?.trim() || r.email?.trim() || `ID ${r.id}`;
                m.set(r.id, label);
            }
            setUsersById(m);
        }).catch(() => {
            setUsersById(new Map());
        });
    }, []);

    const fetchConfirmed = useCallback(async (opts?: {
        silent?: boolean;
    }) => {
        const silent = opts?.silent === true;
        if (!silent)
            setLoading(true);
        else
            setRefreshBusy(true);
        setError(null);
        try {
            const list = await listPartnerReportConfirmationsConfirmed();
            setRows(Array.isArray(list) ? list : []);
        }
        catch (e) {
            setRows([]);
            setError(e instanceof Error ? e.message : 'Не удалось загрузить список');
        }
        finally {
            if (!silent)
                setLoading(false);
            else
                setRefreshBusy(false);
        }
    }, []);

    useEffect(() => {
        loadUsers();
    }, [loadUsers]);

    useEffect(() => {
        void fetchConfirmed();
    }, [fetchConfirmed]);

    useEffect(() => {
        const onInv = () => {
            void fetchConfirmed({ silent: true });
        };
        window.addEventListener(PARTNER_CONFIRMED_REPORTS_INVALIDATE_EVENT, onInv);
        return () => window.removeEventListener(PARTNER_CONFIRMED_REPORTS_INVALIDATE_EVENT, onInv);
    }, [fetchConfirmed]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q)
            return rows;
        return rows.filter((r) => {
            const hay = [
                r.title,
                r.id,
                r.projectId,
                r.snapshotId,
                r.dateFrom,
                r.dateTo,
                String(r.submittedByAuthUserId),
                ...r.requiredPartnerAuthUserIds.map(String),
                ...r.signatures.map((s) => String(s.partnerAuthUserId)),
            ].join(' ').toLowerCase();
            return hay.includes(q);
        });
    }, [rows, query]);

    const openReportPreviewForRow = useCallback((r: PartnerReportConfirmationRequest) => {
        void (async () => {
            let perPage = 500;
            try {
                const meta = await fetchReportsMeta();
                const cap = meta.pageSizeMax != null && meta.pageSizeMax > 0 ? Math.min(meta.pageSizeMax, 5000) : 500;
                perPage = Math.min(500, cap);
            }
            catch {
                perPage = 500;
            }
            writeReportPreviewTransfer({
                v: 2,
                reportType: 'time',
                groupBy: 'projects',
                filters: {
                    dateFrom: r.dateFrom,
                    dateTo: r.dateTo,
                    project_id: r.projectId,
                    page: 1,
                    per_page: perPage,
                },
                partnerConfirmationSnapshotId: r.snapshotId,
            });
            navigate(routes.timeTrackingReportPreview);
        })();
    }, [navigate]);

    const exportSnapshotCsv = useCallback(async (r: PartnerReportConfirmationRequest) => {
        const sid = r.snapshotId.trim();
        if (!sid)
            return;
        setExportBusySnapshotId(sid);
        try {
            const { blob, filename } = await exportReportSnapshot(sid, 'csv');
            downloadBlob(blob, filename);
        }
        catch (e) {
            await showAlert({
                message: e instanceof Error ? e.message : 'Не удалось выгрузить снимок',
            });
        }
        finally {
            setExportBusySnapshotId(null);
        }
    }, [showAlert]);

    return (<div className="tt-partner-confirmed" aria-labelledby="tt-partner-confirmed-heading">
      <div className="tt-partner-confirmed__head">
        <div>
          <h2 id="tt-partner-confirmed-heading" className="tt-partner-confirmed__title">
            Подтверждённые партнёром отчёты
          </h2>
          <p className="tt-partner-confirmed__hint">
            Записи из этого списка не редактируются здесь. Доступны предпросмотр периода и проекта на странице отчёта (актуальные данные) и выгрузка зафиксированного снимка в CSV. Данные списка с сервера (<code className="tt-partner-confirmed__code">GET …/partner-confirmations/confirmed</code>).
          </p>
        </div>
        <button type="button" className="tt-reports__btn tt-reports__btn--outline tt-reports__btn--icon" disabled={loading || refreshBusy} onClick={() => void fetchConfirmed({ silent: true })} title="Обновить список" aria-label="Обновить список">
          <IcoRefresh />
        </button>
      </div>

      <div className="tt-partner-confirmed__toolbar">
        <label className="tt-partner-confirmed__search-label" htmlFor="tt-partner-confirmed-search">
          Поиск по списку
        </label>
        <input id="tt-partner-confirmed-search" type="search" className="tt-reports__table-search-input tt-partner-confirmed__search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Заголовок, проект, id, даты…" spellCheck={false} autoComplete="off" />
        <span className="tt-partner-confirmed__count" role="status">
          {loading ? 'Загрузка…' : `${filtered.length} из ${rows.length}`}
        </span>
      </div>

      {error ? (<p className="tt-reports__table-err tt-partner-confirmed__err" role="alert">{error}</p>) : null}

      {!loading && !error && rows.length === 0 ? (<p className="tt-partner-confirmed__empty">Подтверждённых отчётов пока нет — либо для вас нет доступа к строкам по правилам сервера.</p>) : null}

      {!loading && !error && rows.length > 0 ? (<div className="tt-reports__table-wrap tt-partner-confirmed__table-wrap">
          <table className="tt-reports__table tt-partner-confirmed__table tt-partner-confirmed__table--readonly" aria-label="Подтверждённые партнёром отчёты">
            <thead>
              <tr>
                <th scope="col">Заголовок</th>
                <th scope="col">Период</th>
                <th scope="col">Проект</th>
                <th scope="col">Снимок</th>
                <th scope="col">Отправитель</th>
                <th scope="col">Партнёры (подписи)</th>
                <th scope="col">Обновлено</th>
                <th scope="col">Действия</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (<tr key={r.id}>
                  <td className="tt-partner-confirmed__cell-title">{r.title.trim() || r.id}</td>
                  <td>{formatIsoRangeTitle(r.dateFrom, r.dateTo)}</td>
                  <td><code className="tt-partner-confirmed__code">{r.projectId}</code></td>
                  <td><code className="tt-partner-confirmed__code tt-partner-confirmed__code--narrow" title={r.snapshotId}>{r.snapshotId.length > 12 ? `${r.snapshotId.slice(0, 10)}…` : r.snapshotId}</code></td>
                  <td>{userLabel(usersById, r.submittedByAuthUserId)}</td>
                  <td>
                    {r.signatures.length > 0
                ? r.signatures.map((s) => `${userLabel(usersById, s.partnerAuthUserId)} (${fmtIsoWhen(s.confirmedAt)})`).join('; ')
                : '—'}
                  </td>
                  <td>{fmtIsoWhen(r.updatedAt)}</td>
                  <td className="tt-partner-confirmed__actions-cell">
                    <div className="tt-partner-confirmed__actions">
                      <button type="button" className="tt-reports__btn tt-reports__btn--outline tt-partner-confirmed__action-btn" onClick={() => openReportPreviewForRow(r)}>
                        Предпросмотр
                      </button>
                      <button type="button" className="tt-reports__btn tt-reports__btn--outline tt-partner-confirmed__action-btn" disabled={exportBusySnapshotId === r.snapshotId} onClick={() => void exportSnapshotCsv(r)}>
                        {exportBusySnapshotId === r.snapshotId ? 'Выгрузка…' : 'Снимок (CSV)'}
                      </button>
                    </div>
                  </td>
                </tr>))}
            </tbody>
          </table>
        </div>) : null}

      {!loading && query.trim() && filtered.length === 0 && rows.length > 0 ? (<p className="tt-partner-confirmed__empty">Ничего не найдено — сбросьте поиск.</p>) : null}
    </div>);
}
