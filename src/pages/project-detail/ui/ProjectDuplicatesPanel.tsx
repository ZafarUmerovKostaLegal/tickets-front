import { useCallback, useMemo, useState } from 'react';
import {
    archiveProjectDuplicateEntries,
    fetchProjectDuplicateTimeEntries,
    listProjectArchivedTimeEntries,
    restoreProjectArchivedTimeEntry,
    type ArchivedTimeEntryRow,
    type DuplicateTimeEntryGroup,
    type ProjectDuplicateScanResult,
} from '@entities/time-tracking/api/projectDuplicateEntries';
import { formatIsoDateLabel } from '@entities/time-tracking/lib/reportsPeriodRange';
import {
    buildDefaultArchiveSelection,
    duplicateEntryKey,
    pickKeeperEntryKey,
    splitDuplicateGroupsByWorkDate,
    summarizeDuplicateGroups,
} from '@pages/project-detail/lib/projectDuplicateGroups';
import { useAppDialog } from '@shared/ui';
import { formatDecimalHoursRu } from '@shared/lib/formatTrackingHours';

type Props = {
    clientId: string;
    projectId: string;
    dateFrom?: string;
    dateTo?: string;
    onChanged?: () => void;
};

function fmtCreatedAt(iso: string | null | undefined): string {
    if (!iso?.trim())
        return '—';
    try {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime()))
            return iso;
        return d.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'medium' });
    }
    catch {
        return iso;
    }
}

function fmtWorkDate(iso: string | null | undefined): string {
    const value = (iso ?? '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
        return value || '—';
    return formatIsoDateLabel(value);
}

export function ProjectDuplicatesPanel({ clientId, projectId, dateFrom, dateTo, onChanged }: Props) {
    const { showAlert, showConfirm } = useAppDialog();
    const [scanning, setScanning] = useState(false);
    const [archiving, setArchiving] = useState(false);
    const [result, setResult] = useState<ProjectDuplicateScanResult | null>(null);
    const [displayGroups, setDisplayGroups] = useState<DuplicateTimeEntryGroup[]>([]);
    const [archived, setArchived] = useState<ArchivedTimeEntryRow[]>([]);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [error, setError] = useState<string | null>(null);

    const loadArchive = useCallback(async () => {
        const items = await listProjectArchivedTimeEntries(clientId, projectId, false);
        setArchived(items);
    }, [clientId, projectId]);

    const applyScanResult = useCallback((data: ProjectDuplicateScanResult) => {
        const groups = splitDuplicateGroupsByWorkDate(data.groups);
        setResult(data);
        setDisplayGroups(groups);
        setSelected(buildDefaultArchiveSelection(groups));
    }, []);

    const runScan = useCallback(async () => {
        setScanning(true);
        setError(null);
        try {
            const data = await fetchProjectDuplicateTimeEntries(clientId, projectId, {
                dateFrom,
                dateTo,
            });
            applyScanResult(data);
            await loadArchive();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Ошибка проверки');
            setResult(null);
            setDisplayGroups([]);
            setSelected(new Set());
        }
        finally {
            setScanning(false);
        }
    }, [clientId, projectId, dateFrom, dateTo, loadArchive, applyScanResult]);

    const toggleEntry = useCallback((key: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(key))
                next.delete(key);
            else
                next.add(key);
            return next;
        });
    }, []);

    const toggleGroup = useCallback((group: DuplicateTimeEntryGroup, checked: boolean) => {
        setSelected((prev) => {
            const next = new Set(prev);
            for (const e of group.entries) {
                const k = duplicateEntryKey(e);
                if (checked)
                    next.add(k);
                else
                    next.delete(k);
            }
            return next;
        });
    }, []);

    const resetArchiveSelection = useCallback(() => {
        setSelected(buildDefaultArchiveSelection(displayGroups));
    }, [displayGroups]);

    const clearSelection = useCallback(() => {
        setSelected(new Set());
    }, []);

    const displaySummary = useMemo(() => summarizeDuplicateGroups(displayGroups), [displayGroups]);

    const selectedPayload = useMemo(() => {
        if (displayGroups.length === 0)
            return [];
        const out: Array<{
            authUserId: number;
            entryId: string;
            duplicateGroupId?: string;
            userName?: string;
            taskName?: string;
        }> = [];
        for (const g of displayGroups) {
            for (const e of g.entries) {
                if (!selected.has(duplicateEntryKey(e)))
                    continue;
                out.push({
                    authUserId: e.auth_user_id,
                    entryId: e.entry_id,
                    duplicateGroupId: g.group_id,
                    userName: e.user_name,
                    taskName: e.task_name,
                });
            }
        }
        return out;
    }, [displayGroups, selected]);

    const handleArchive = useCallback(async () => {
        if (selectedPayload.length === 0) {
            await showAlert({ message: 'Выберите записи для архивации' });
            return;
        }
        const ok = await showConfirm({
            title: 'Архивировать дубликаты?',
            message: `Архивировать ${selectedPayload.length} записей? В каждой группе останется минимум одна запись. Восстановить можно из архива.`,
            confirmLabel: 'Архивировать',
            variant: 'danger',
        });
        if (!ok)
            return;
        setArchiving(true);
        setError(null);
        try {
            const res = await archiveProjectDuplicateEntries(clientId, projectId, selectedPayload);
            await showAlert({
                message: `Архивировано: ${res.archived_count}. Пропущено: ${res.skipped_count}.`,
            });
            await runScan();
            onChanged?.();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Ошибка архивации');
        }
        finally {
            setArchiving(false);
        }
    }, [selectedPayload, showAlert, showConfirm, clientId, projectId, runScan, onChanged]);

    const handleRestore = useCallback(async (archiveId: string) => {
        const ok = await showConfirm({
            title: 'Восстановить запись?',
            message: 'Запись снова появится в учёте времени.',
            confirmLabel: 'Восстановить',
        });
        if (!ok)
            return;
        try {
            await restoreProjectArchivedTimeEntry(clientId, projectId, archiveId);
            await runScan();
            onChanged?.();
        }
        catch (e) {
            await showAlert({
                message: e instanceof Error ? e.message : 'Не удалось восстановить',
            });
        }
    }, [showConfirm, showAlert, clientId, projectId, runScan, onChanged]);

    return (
      <div className="pdp-dup">
        <div className="pdp-dup__intro">
          <div className="pdp-dup__callout">
            Дубликат — одинаковые <strong>день учёта</strong> (в шапке группы), <strong>дата в колонке «Создана»</strong>,
            задача, заметка, часы и сумма. Запись от 09.06 и от 19.06 при одном дне учёта — это разные импорты, не дубликаты.
            К архивации отмечены повторы внутри одной пары день учёта + день создания.
          </div>
          <div className="pdp-dup__actions">
            <button type="button" className="pdp__edit-btn" disabled={scanning || archiving} onClick={() => void runScan()}>
              {scanning ? 'Проверка…' : 'Проверить дубликаты'}
            </button>
            <button
              type="button"
              className="pdp__edit-btn pdp__edit-btn--danger"
              disabled={scanning || archiving || selectedPayload.length === 0}
              onClick={() => void handleArchive()}
            >
              {archiving ? 'Архивация…' : `Архивировать выбранные (${selectedPayload.length})`}
            </button>
            {displayGroups.length > 0 ? (
              <>
                <button type="button" className="pdp__edit-btn pdp__edit-btn--ghost" disabled={scanning || archiving} onClick={resetArchiveSelection}>
                  Отметить повторы
                </button>
                <button type="button" className="pdp__edit-btn pdp__edit-btn--ghost" disabled={scanning || archiving} onClick={clearSelection}>
                  Снять отметки
                </button>
              </>
            ) : null}
          </div>
        </div>

        {error ? <p className="pdp-dup__error" role="alert">{error}</p> : null}

        {result ? (
          <div className="pdp-dup__stats-panel">
            <div className="pdp-dup__stats" role="status">
              <div className="pdp-dup__stat">
                <span className="pdp-dup__stat-value">{displaySummary.group_count}</span>
                <span className="pdp-dup__stat-label">групп</span>
              </div>
              <div className="pdp-dup__stat">
                <span className="pdp-dup__stat-value">{displaySummary.entry_count}</span>
                <span className="pdp-dup__stat-label">записей</span>
              </div>
              <div className="pdp-dup__stat">
                <span className="pdp-dup__stat-value">{displaySummary.user_count}</span>
                <span className="pdp-dup__stat-label">сотрудников</span>
              </div>
            </div>
            {displaySummary.group_count !== result.summary.group_count ? (
              <p className="pdp-dup__stats-note">
                После разделения по дню учёта: было {result.summary.group_count} групп с сервера
              </p>
            ) : null}
          </div>
        ) : null}

        {result && displayGroups.length === 0 && !scanning ? (
          <div className="pdp-dup__empty-card">
            <p className="pdp-dup__empty">Дубликаты не найдены.</p>
          </div>
        ) : null}

        <div className="pdp-dup__groups">
          {displayGroups.map((group) => {
              const keeperKey = pickKeeperEntryKey(group);
              const groupFullySelected = group.entries.every((e) => selected.has(duplicateEntryKey(e)));
              const entryWord = group.entries.length === 1
                  ? 'запись'
                  : group.entries.length < 5
                      ? 'записи'
                      : 'записей';
              return (
                <section key={group.group_id} className="pdp-dup__group">
                  <header className="pdp-dup__group-head">
                    <div className="pdp-dup__group-top">
                      <span className="pdp-dup__group-badge">{group.group_label}</span>
                      <span className="pdp-dup__group-user">{group.user_name}</span>
                      <span className="pdp-dup__group-sep" aria-hidden>·</span>
                      <span className="pdp-dup__group-date">{fmtWorkDate(group.work_date)}</span>
                      <span className="pdp-dup__group-count">{group.entries.length} {entryWord}</span>
                    </div>
                    {group.task_name ? (
                      <p className="pdp-dup__group-task">{group.task_name}</p>
                    ) : null}
                  </header>
                  <div className="pdp-dup__table-wrap">
                    <table className="pdp-dup__table">
                      <colgroup>
                        <col className="pdp-dup__col-check" />
                        <col className="pdp-dup__col-status" />
                        <col className="pdp-dup__col-created" />
                        <col className="pdp-dup__col-note" />
                        <col className="pdp-dup__col-hours" />
                        <col className="pdp-dup__col-sum" />
                      </colgroup>
                      <thead>
                        <tr>
                          <th scope="col" className="pdp-dup__th-check">
                            <input
                              type="checkbox"
                              aria-label="Выбрать группу"
                              checked={groupFullySelected}
                              onChange={(ev) => toggleGroup(group, ev.target.checked)}
                            />
                          </th>
                          <th scope="col">Статус</th>
                          <th scope="col">Создана</th>
                          <th scope="col">Заметка</th>
                          <th scope="col" className="pdp-dup__th-num">Часы</th>
                          <th scope="col" className="pdp-dup__th-num">Сумма</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.entries.map((e) => {
                            const k = duplicateEntryKey(e);
                            const isSelected = selected.has(k);
                            const isKeeper = k === keeperKey && !isSelected;
                            const rowClass = [
                                isKeeper ? 'pdp-dup__row--keeper' : '',
                                isSelected ? 'pdp-dup__row--marked' : '',
                            ].filter(Boolean).join(' ') || undefined;
                            return (
                              <tr key={k} className={rowClass}>
                                <td className="pdp-dup__td-check">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleEntry(k)}
                                    aria-label={`Выбрать ${e.entry_id}`}
                                  />
                                </td>
                                <td className="pdp-dup__td-status">
                                  {isKeeper ? (
                                    <span className="pdp-dup__pill pdp-dup__pill--keeper">Оставить</span>
                                  ) : isSelected ? (
                                    <span className="pdp-dup__pill pdp-dup__pill--archive">К архиву</span>
                                  ) : (
                                    <span className="pdp-dup__pill pdp-dup__pill--neutral">—</span>
                                  )}
                                </td>
                                <td className="pdp-dup__created">
                                  <span className="pdp-dup__created-at">{fmtCreatedAt(e.created_at)}</span>
                                  <span className="pdp-dup__entry-id" title={e.entry_id}>…{e.entry_id.slice(-8)}</span>
                                </td>
                                <td className="pdp-dup__note">{e.description || '—'}</td>
                                <td className="pdp-dup__num">{formatDecimalHoursRu(e.rounded_hours)}</td>
                                <td className="pdp-dup__num">{e.billable_amount.toLocaleString('ru-RU')} {e.currency}</td>
                              </tr>
                            );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              );
          })}
        </div>

        {archived.length > 0 ? (
          <section className="pdp-dup__archive">
            <div className="pdp-dup__archive-card">
              <h3 className="pdp-dup__archive-title">Архив (можно восстановить)</h3>
              <div className="pdp-dup__table-wrap pdp-dup__table-wrap--archive">
                <table className="pdp-dup__table pdp-dup__table--archive">
                  <colgroup>
                    <col className="pdp-dup__col-work-date" />
                    <col className="pdp-dup__col-user" />
                    <col className="pdp-dup__col-task" />
                    <col className="pdp-dup__col-note" />
                    <col className="pdp-dup__col-archived" />
                    <col className="pdp-dup__col-act" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th scope="col">День учёта</th>
                      <th scope="col">Сотрудник</th>
                      <th scope="col">Задача</th>
                      <th scope="col">Заметка</th>
                      <th scope="col">Архивировано</th>
                      <th scope="col" className="pdp-dup__th-act">Действие</th>
                    </tr>
                  </thead>
                  <tbody>
                    {archived.map((row) => (
                      <tr key={row.archive_id}>
                        <td className="pdp-dup__work-date">{fmtWorkDate(row.work_date)}</td>
                        <td className="pdp-dup__user">{row.user_name || row.auth_user_id}</td>
                        <td className="pdp-dup__task">{row.task_name || '—'}</td>
                        <td className="pdp-dup__note">{row.description || '—'}</td>
                        <td className="pdp-dup__created-at-only">{fmtCreatedAt(row.archived_at)}</td>
                        <td className="pdp-dup__archive-act">
                          <button type="button" className="pdp__edit-btn pdp__edit-btn--ghost pdp-dup__restore-btn" onClick={() => void handleRestore(row.archive_id)}>
                            Восстановить
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    );
}