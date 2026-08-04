import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
    archiveCorrespondence,
    correspondenceErrorMessage,
    fetchCorrespondenceDocument,
    fetchCorrespondenceStats,
    listCorrespondence,
    mapDocumentToCorrRow,
    openCorrespondenceAttachmentInNewTab,
    registerIncomingCorrespondence,
    type CorrDocType,
    type CorrespondenceStats,
} from '@entities/correspondence';
import { routes } from '@shared/config';
import { showAlert } from '@shared/ui';
import {
    CORR_COUNTERPARTY_COLUMN,
    CORR_PAGE_SIZE,
    CORR_SHELL_NAV_TABS,
    CORR_STATUS_BADGE,
    CORR_TABLE_TABS,
    CORR_TYPE_BADGE,
    type CorrTableTabKey,
} from '../model/constants';
import type { CorrDirection, CorrRow, IncomingRegisterPayload } from '../model/types';
import { CorrespondenceDocumentCardModal } from './CorrespondenceDocumentCardModal';
import { CorrespondenceRegisterIncomingModal } from './CorrespondenceRegisterIncomingModal';
import { CorrespondenceRegistrySkeleton } from './CorrespondenceSkeleton';
import { CorrespondenceShell } from './CorrespondenceShell';
import './CorrespondencePage.css';
import './CorrespondenceShell.css';

function StatIcon({ name }: { name: 'inbox' | 'send' | 'users' | 'clock' }) {
    if (name === 'inbox') {
        return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
          <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
        </svg>);
    }
    if (name === 'send') {
        return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <line x1="22" y1="2" x2="11" y2="13"/>
          <polygon points="22 2 15 22 11 13 2 9 22 2"/>
        </svg>);
    }
    if (name === 'users') {
        return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>);
    }
    return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>);
}

function ScanIcon({ attached }: { attached: boolean }) {
    return (<span className={`corr__scan-icon${attached ? '' : ' corr__scan-icon--missing'}`} title={attached ? 'Скан приложен' : 'Скан отсутствует'} aria-hidden>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            {attached ? <polyline points="9 15 11 17 15 13"/> : <line x1="9" y1="9" x2="15" y2="15"/>}
        </svg>
    </span>);
}

function buildPageNumbers(page: number, totalPages: number): (number | 'ellipsis')[] {
    if (totalPages <= 7)
        return Array.from({ length: totalPages }, (_, i) => i + 1);
    const set = new Set<number>();
    set.add(1);
    set.add(totalPages);
    set.add(page);
    for (let d = -1; d <= 1; d++) {
        const p = page + d;
        if (p >= 1 && p <= totalPages)
            set.add(p);
    }
    const sorted = [...set].sort((a, b) => a - b);
    const out: (number | 'ellipsis')[] = [];
    let prev = 0;
    for (const n of sorted) {
        if (prev > 0 && n - prev > 1)
            out.push('ellipsis');
        out.push(n);
        prev = n;
    }
    return out;
}

function listParamsForTab(
    direction: CorrDirection,
    tableTab: CorrTableTabKey,
    page: number,
    docTypes: CorrDocType[],
) {
    const params: Parameters<typeof listCorrespondence>[0] = {
        direction,
        skip: (page - 1) * CORR_PAGE_SIZE,
        limit: CORR_PAGE_SIZE,
    };
    if (tableTab === 'new')
        params.status = 'new';
    else if (tableTab === 'work')
        params.statusGroup = 'work';
    else if (tableTab === 'done')
        params.status = 'done';
    if (docTypes.length > 0 && docTypes.length < 3)
        params.docType = docTypes;
    return params;
}

function usePopoverBelowAnchor(
    open: boolean,
    anchorRef: React.RefObject<HTMLElement | null>,
    opts: { align: 'start' | 'end'; gap: number; minWidth: number },
) {
    const { align, gap, minWidth } = opts;
    const [box, setBox] = useState<{ top: number; left: number; minWidth: number } | null>(null);
    useLayoutEffect(() => {
        if (!open) {
            setBox(null);
            return;
        }
        const anchor = anchorRef.current;
        if (!anchor) {
            setBox(null);
            return;
        }
        const update = () => {
            const r = anchor.getBoundingClientRect();
            let left = align === 'start' ? r.left : r.right - minWidth;
            left = Math.max(8, Math.min(left, window.innerWidth - minWidth - 8));
            setBox({ top: r.bottom + gap, left, minWidth });
        };
        update();
        window.addEventListener('scroll', update, true);
        window.addEventListener('resize', update);
        return () => {
            window.removeEventListener('scroll', update, true);
            window.removeEventListener('resize', update);
        };
    }, [open, anchorRef, align, gap, minWidth]);
    return box;
}

const EMPTY_STATS: CorrespondenceStats = {
    incomingTotal: 0,
    outgoingTotal: 0,
    approvalTotal: 0,
    incomingNewTotal: 0,
};

export type CorrespondenceRegistryViewProps = {
    direction: CorrDirection;
    onDirectionChange: (direction: CorrDirection) => void;
};

export function CorrespondenceRegistryView({
    direction,
    onDirectionChange,
}: CorrespondenceRegistryViewProps) {
    const navigate = useNavigate();
    const [tableTab, setTableTab] = useState<CorrTableTabKey>('all');
    const [page, setPage] = useState(1);
    const [rows, setRows] = useState<CorrRow[]>([]);
    const [total, setTotal] = useState(0);
    const [listLoading, setListLoading] = useState(true);
    const [statsLoading, setStatsLoading] = useState(true);
    const [listError, setListError] = useState<string | null>(null);
    const [stats, setStats] = useState<CorrespondenceStats>(EMPTY_STATS);
    const [reloadToken, setReloadToken] = useState(0);

    const [filterDraft, setFilterDraft] = useState({ letter: true, contract: true, note: true });
    const [appliedDocTypes, setAppliedDocTypes] = useState<CorrDocType[]>(['letter', 'contract', 'note']);

    const totalPages = Math.max(1, Math.ceil(total / CORR_PAGE_SIZE));
    const effectivePage = Math.min(page, totalPages);
    const pageNumbers = useMemo(() => buildPageNumbers(effectivePage, totalPages), [effectivePage, totalPages]);
    const rangeStart = total === 0 ? 0 : (effectivePage - 1) * CORR_PAGE_SIZE + 1;
    const rangeEnd = total === 0 ? 0 : Math.min(effectivePage * CORR_PAGE_SIZE, total);
    const counterpartyColumn = CORR_COUNTERPARTY_COLUMN[direction];

    const statCards = useMemo(() => ([
        { key: 'in', label: 'Входящие', value: String(stats.incomingTotal), delta: 'в реестре', deltaVariant: 'blue' as const, icon: 'inbox' as const },
        { key: 'out', label: 'Исходящие', value: String(stats.outgoingTotal), delta: 'в реестре', deltaVariant: 'green' as const, icon: 'send' as const },
        { key: 'approval', label: 'На согласовании', value: String(stats.approvalTotal), delta: 'активные', deltaVariant: 'orange' as const, icon: 'users' as const },
        { key: 'overdue', label: 'Новые входящие', value: String(stats.incomingNewTotal), delta: 'без обработки', deltaVariant: 'red' as const, icon: 'clock' as const },
    ]), [stats]);

    const reloadAll = useCallback(() => {
        setReloadToken((t) => t + 1);
    }, []);

    useEffect(() => {
        let cancelled = false;
        const controller = new AbortController();
        setStatsLoading(true);
        void fetchCorrespondenceStats(controller.signal)
            .then((s) => {
                if (!cancelled)
                    setStats(s);
            })
            .catch(() => {
                if (!cancelled)
                    setStats(EMPTY_STATS);
            })
            .finally(() => {
                if (!cancelled)
                    setStatsLoading(false);
            });
        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [reloadToken]);

    useEffect(() => {
        let cancelled = false;
        const controller = new AbortController();
        setListLoading(true);
        setListError(null);
        const params = listParamsForTab(direction, tableTab, effectivePage, appliedDocTypes);
        void listCorrespondence(params, controller.signal)
            .then((res) => {
                if (cancelled)
                    return;
                setRows(res.items.map(mapDocumentToCorrRow));
                setTotal(res.total);
            })
            .catch((err) => {
                if (cancelled)
                    return;
                setRows([]);
                setTotal(0);
                setListError(correspondenceErrorMessage(err, 'Не удалось загрузить реестр'));
            })
            .finally(() => {
                if (!cancelled)
                    setListLoading(false);
            });
        return () => {
            cancelled = true;
            controller.abort();
        };
    }, [direction, tableTab, effectivePage, appliedDocTypes, reloadToken]);

    const filtersBtnRef = useRef<HTMLButtonElement>(null);
    const settingsBtnRef = useRef<HTMLButtonElement>(null);
    const rowMenuBtnRef = useRef<HTMLButtonElement>(null);

    const [filtersOpen, setFiltersOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [rowMenuOpenId, setRowMenuOpenId] = useState<string | null>(null);
    const [incomingModalOpen, setIncomingModalOpen] = useState(false);
    const [registerPending, setRegisterPending] = useState(false);
    const [cardDocId, setCardDocId] = useState<string | null>(null);

    const filterPopoverBox = usePopoverBelowAnchor(filtersOpen, filtersBtnRef, { align: 'start', gap: 6, minWidth: 220 });
    const settingsPopoverBox = usePopoverBelowAnchor(settingsOpen, settingsBtnRef, { align: 'end', gap: 6, minWidth: 200 });
    const rowMenuPopoverBox = usePopoverBelowAnchor(rowMenuOpenId !== null, rowMenuBtnRef, { align: 'end', gap: 6, minWidth: 200 });

    const closeOverlays = useCallback(() => {
        setFiltersOpen(false);
        setSettingsOpen(false);
        setRowMenuOpenId(null);
    }, []);

    useEffect(() => {
        if (!filtersOpen && !settingsOpen && !rowMenuOpenId)
            return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                closeOverlays();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [filtersOpen, settingsOpen, rowMenuOpenId, closeOverlays]);

    const rowMenuRow = useMemo(
        () => (rowMenuOpenId ? rows.find((r) => r.id === rowMenuOpenId) ?? null : null),
        [rows, rowMenuOpenId],
    );

    const applyTypeFilters = useCallback(() => {
        const selected = (['letter', 'contract', 'note'] as const).filter((k) => filterDraft[k]);
        if (selected.length === 0) {
            void showAlert({ title: 'Фильтры', message: 'Выберите хотя бы один тип документа.' });
            return;
        }
        setAppliedDocTypes([...selected]);
        setPage(1);
        setFiltersOpen(false);
    }, [filterDraft]);

    const openRegisterModal = () => {
        closeOverlays();
        if (direction === 'incoming')
            setIncomingModalOpen(true);
        else
            navigate(routes.correspondenceOutgoingCreate);
    };

    const handleIncomingSubmit = async (payload: IncomingRegisterPayload) => {
        setRegisterPending(true);
        try {
            await registerIncomingCorrespondence({
                partnerUserId: payload.partnerUserId,
                counterparty: payload.counterparty,
                subject: payload.subject,
                docType: payload.type,
                comment: payload.comment,
                scanFiles: payload.scanFiles,
            });
            setIncomingModalOpen(false);
            reloadAll();
            void showAlert({
                title: 'Входящее сохранено',
                message: `Письмо зарегистрировано для партнёра «${payload.partnerName}».`,
            });
        }
        catch (err) {
            void showAlert({
                title: 'Не удалось сохранить',
                message: correspondenceErrorMessage(err, 'Ошибка регистрации'),
            });
        }
        finally {
            setRegisterPending(false);
        }
    };

    const viewScan = async (row: CorrRow) => {
        setRowMenuOpenId(null);
        try {
            const doc = await fetchCorrespondenceDocument(row.id);
            const scan = doc.attachments?.find((a) => a.attachmentKind === 'scan') ?? doc.attachments?.[0];
            if (!scan) {
                void showAlert({ title: 'Скан', message: 'У документа нет вложений.' });
                return;
            }
            await openCorrespondenceAttachmentInNewTab(row.id, scan.id);
        }
        catch (err) {
            void showAlert({
                title: 'Не удалось открыть файл',
                message: err instanceof Error ? err.message : 'Ошибка загрузки',
            });
        }
    };

    const archiveRow = async (row: CorrRow) => {
        setRowMenuOpenId(null);
        try {
            await archiveCorrespondence(row.id);
            reloadAll();
        }
        catch (err) {
            void showAlert({
                title: 'Не удалось архивировать',
                message: err instanceof Error ? err.message : 'Ошибка',
            });
        }
    };

    const shellTabs = useMemo(() => CORR_SHELL_NAV_TABS.map((tab) => ({
        id: tab.key,
        label: tab.label,
        active: direction === tab.key,
        onClick: () => {
            closeOverlays();
            onDirectionChange(tab.key);
            setTableTab('all');
            setPage(1);
        },
    })), [closeOverlays, direction, onDirectionChange]);

    const activeShellTab = CORR_SHELL_NAV_TABS.find((tab) => tab.key === direction)?.label ?? 'Входящие';

    const showRegistrySkeleton = listLoading && rows.length === 0 && !listError;
    const tablePanelKey = `${direction}-${tableTab}-${effectivePage}`;

    return (<CorrespondenceShell
      activeTab={activeShellTab}
      tabs={shellTabs}
      fullHeight
      contentClassName="corr-shell__content--registry"
    >
      <div className="corr-registry corr-registry--enter">
        <div className="corr__body corr-registry__layout">
          <aside className="corr-registry__sidebar" aria-label="Боковая панель">
            <div className="corr-registry__sidebar-inner">
              <p className="corr-registry__sidebar-label">Быстрые действия</p>
              <button type="button" className="corr__btn corr__btn--primary corr__btn--block corr-registry__cta" onClick={openRegisterModal}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  {direction === 'incoming'
                      ? (<><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></>)
                      : (<><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></>)}
                </svg>
                {direction === 'incoming' ? 'Зарегистрировать входящее' : 'Зарегистрировать исходящее'}
              </button>
              <p className="corr-registry__sidebar-note">
                {direction === 'incoming'
                    ? 'Для входящих обязательны партнёр и файл скана или фото документа.'
                    : 'Пока используется пустой лист; укажите получателя и тему, затем зарегистрируйте.'}
              </p>
            </div>
          </aside>

          <div className="corr__content corr__content--registry corr-registry__main" role="tabpanel">
            {showRegistrySkeleton ? (
              <CorrespondenceRegistrySkeleton rows={CORR_PAGE_SIZE} />
            ) : (<>
            <section className="corr__stats corr-registry__stats" aria-label="Показатели">
              {statCards.map((s, i) => (<article
                  key={s.key}
                  className={`corr__stat corr__stat--${s.deltaVariant}${statsLoading ? ' corr__stat--dim' : ''}`}
                  style={{ '--corr-stagger': i } as CSSProperties}
                >
                  <div className={`corr__stat-icon-wrap corr__stat-icon-wrap--${s.deltaVariant}`}>
                    <StatIcon name={s.icon}/>
                  </div>
                  <div className="corr__stat-body">
                    <span className="corr__stat-label">{s.label}</span>
                    <span className="corr__stat-value">{s.value}</span>
                    <span className="corr__stat-delta">{s.delta}</span>
                  </div>
                </article>))}
            </section>

            <section className="corr__table-card corr-registry__table-card" aria-label="Реестр документов">
              <div className="corr__table-toolbar">
                <div className="corr__table-tabs" role="tablist" aria-label="Фильтр по статусу">
                  {CORR_TABLE_TABS.map((t) => (<button
                      key={t.key}
                      type="button"
                      role="tab"
                      aria-selected={tableTab === t.key}
                      className={`corr__table-tab${tableTab === t.key ? ' corr__table-tab--active' : ''}`}
                      disabled={listLoading}
                      onClick={() => {
                          closeOverlays();
                          setTableTab(t.key);
                          setPage(1);
                      }}
                    >
                      {t.label}
                    </button>))}
                </div>
                <div className="corr__table-actions">
                        <div className="corr__anchor-wrap">
                          <button
                            ref={filtersBtnRef}
                            type="button"
                            className={`corr__btn corr__btn--outline${filtersOpen ? ' corr__btn--pressed' : ''}`}
                            aria-expanded={filtersOpen}
                            aria-haspopup="menu"
                            onClick={() => {
                                setFilterDraft({
                                    letter: appliedDocTypes.includes('letter'),
                                    contract: appliedDocTypes.includes('contract'),
                                    note: appliedDocTypes.includes('note'),
                                });
                                setFiltersOpen((v) => !v);
                                setSettingsOpen(false);
                                setRowMenuOpenId(null);
                            }}
                          >
                            Фильтры
                            <svg className="corr__btn-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                              <polyline points="6 9 12 15 18 9"/>
                            </svg>
                          </button>
                        </div>
                        <div className="corr__anchor-wrap">
                          <button
                            ref={settingsBtnRef}
                            type="button"
                            className={`corr__icon-btn${settingsOpen ? ' corr__icon-btn--open' : ''}`}
                            title="Дополнительно"
                            aria-label="Дополнительно"
                            aria-expanded={settingsOpen}
                            aria-haspopup="menu"
                            onClick={() => {
                                setSettingsOpen((v) => !v);
                                setFiltersOpen(false);
                                setRowMenuOpenId(null);
                            }}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                              <circle cx="12" cy="12" r="3"/>
                              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                  </div>

                  {listError ? <p className="corr__load-err" role="alert">{listError}</p> : null}

                  <div
                    key={tablePanelKey}
                    className={`corr-registry__table-panel${listLoading ? ' corr-registry__table-panel--loading' : ''}`}
                  >
                  {listLoading && rows.length > 0 ? (
                    <p className="corr__load-hint corr-registry__load-overlay" aria-live="polite">Обновление…</p>
                  ) : null}

                  <div className="corr__table-scroll">
                    <table className="corr__table">
                      <thead>
                        <tr>
                          <th scope="col">№</th>
                          <th scope="col">{counterpartyColumn}</th>
                          {direction === 'incoming' ? <th scope="col">Партнёр</th> : null}
                          <th scope="col">Тема</th>
                          <th scope="col">Тип</th>
                          {direction === 'incoming' ? <th scope="col">Скан</th> : null}
                          <th scope="col">Дата</th>
                          <th scope="col">Ответственный</th>
                          <th scope="col">Статус</th>
                          <th scope="col" className="corr__th-actions"><span className="corr__sr-only">Действия</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        {!listLoading && rows.length === 0 ? (
                          <tr>
                            <td colSpan={direction === 'incoming' ? 10 : 8} className="corr__table-empty">
                              <div className="corr-registry__empty">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                  <polyline points="14 2 14 8 20 8"/>
                                </svg>
                                <p>Нет документов для отображения</p>
                              </div>
                            </td>
                          </tr>
                        ) : rows.map((row, rowIdx) => (<tr
                            key={row.id}
                            className="corr-registry__row"
                            style={{ '--corr-stagger': rowIdx } as CSSProperties}
                          >
                            <td className="corr__mono">{row.registryNumber}</td>
                            <td className="corr-registry__cell-clip">{row.counterparty}</td>
                            {direction === 'incoming' ? (
                              <td>
                                {row.partnerName
                                    ? <span className="corr__partner-pill" title={row.partnerUserId ? `Партнёр #${row.partnerUserId}` : undefined}>{row.partnerName}</span>
                                    : '—'}
                              </td>
                            ) : null}
                            <td className="corr-registry__cell-subject" title={row.subject}>{row.subject}</td>
                            <td><span className={CORR_TYPE_BADGE[row.type].className}>{CORR_TYPE_BADGE[row.type].label}</span></td>
                            {direction === 'incoming' ? (
                              <td>
                                <ScanIcon attached={Boolean(row.hasScan)} />
                              </td>
                            ) : null}
                            <td className="corr__nowrap">{row.date}</td>
                            <td>{row.responsible}</td>
                            <td><span className={CORR_STATUS_BADGE[row.status].className}>{CORR_STATUS_BADGE[row.status].label}</span></td>
                            <td className="corr__td-actions">
                              <button
                                ref={row.id === rowMenuOpenId ? rowMenuBtnRef : undefined}
                                type="button"
                                className={`corr__row-menu${rowMenuOpenId === row.id ? ' corr__row-menu--open' : ''}`}
                                aria-expanded={rowMenuOpenId === row.id}
                                aria-haspopup="menu"
                                aria-label={`Действия для ${row.registryNumber}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setRowMenuOpenId((id) => (id === row.id ? null : row.id));
                                    setFiltersOpen(false);
                                    setSettingsOpen(false);
                                }}
                              >
                                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden>
                                  <circle cx="12" cy="5" r="2"/>
                                  <circle cx="12" cy="12" r="2"/>
                                  <circle cx="12" cy="19" r="2"/>
                                </svg>
                              </button>
                            </td>
                          </tr>))}
                      </tbody>
                    </table>
                  </div>

                  <footer className="corr__pagination">
                    <span className="corr__pagination-range">Показано {rangeStart}–{rangeEnd} из {total}</span>
                    {total > 0 ? (<nav className="corr__pagination-nav" aria-label="Страницы">
                      <button type="button" className="corr__page-btn" disabled={effectivePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} aria-label="Предыдущая страница">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                          <polyline points="15 18 9 12 15 6"/>
                        </svg>
                      </button>
                      {pageNumbers.map((item, idx) => item === 'ellipsis'
                        ? (<span key={`e-${idx}`} className="corr__page-ellipsis">…</span>)
                        : (<button key={item} type="button" className={`corr__page-num${item === effectivePage ? ' corr__page-num--active' : ''}`} onClick={() => setPage(item)} aria-current={item === effectivePage ? 'page' : undefined}>{item}</button>))}
                      <button type="button" className="corr__page-btn" disabled={effectivePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} aria-label="Следующая страница">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                          <polyline points="9 18 15 12 9 6"/>
                        </svg>
                      </button>
                    </nav>) : null}
                  </footer>
                  </div>
                </section>
            </>)}
          </div>
        </div>
      </div>

      {filtersOpen && filterPopoverBox ? createPortal(<>
        <div className="corr__popover-backdrop corr__popover-backdrop--enter" onClick={closeOverlays} aria-hidden/>
        <div className="corr__popover corr__popover--enter" role="menu" style={{ top: filterPopoverBox.top, left: filterPopoverBox.left, minWidth: filterPopoverBox.minWidth }}>
          <p className="corr__popover-title">Тип документа</p>
          {(['letter', 'contract', 'note'] as const).map((key) => (<label key={key} className="corr__filter-check">
              <input type="checkbox" checked={filterDraft[key]} onChange={() => setFilterDraft((ft) => ({ ...ft, [key]: !ft[key] }))}/>
              {CORR_TYPE_BADGE[key].label}
            </label>))}
          <div className="corr__popover-divider"/>
          <div className="corr__popover-footer">
            <button type="button" className="corr__popover-btn" onClick={closeOverlays}>Отмена</button>
            <button type="button" className="corr__popover-btn corr__popover-btn--primary" onClick={applyTypeFilters}>Применить</button>
          </div>
        </div>
      </>, document.body) : null}

      {settingsOpen && settingsPopoverBox ? createPortal(<>
        <div className="corr__popover-backdrop corr__popover-backdrop--enter" onClick={closeOverlays} aria-hidden/>
        <div className="corr__popover corr__popover--enter" role="menu" style={{ top: settingsPopoverBox.top, left: settingsPopoverBox.left, minWidth: settingsPopoverBox.minWidth }}>
          <button type="button" className="corr__popover-item" role="menuitem" onClick={() => {
                closeOverlays();
                void showAlert({ title: 'Экспорт', message: 'Выгрузка в Excel появится в следующей версии.' });
            }}>
            Экспорт в Excel
          </button>
        </div>
      </>, document.body) : null}

      {rowMenuOpenId && rowMenuPopoverBox && rowMenuRow ? createPortal(<>
        <div className="corr__popover-backdrop corr__popover-backdrop--enter" onClick={closeOverlays} aria-hidden/>
        <div className="corr__popover corr__popover--enter" role="menu" style={{ top: rowMenuPopoverBox.top, left: rowMenuPopoverBox.left, minWidth: rowMenuPopoverBox.minWidth }}>
          <button type="button" className="corr__popover-item" role="menuitem" onClick={() => {
                setRowMenuOpenId(null);
                setCardDocId(rowMenuRow.id);
            }}>
            Открыть карточку
          </button>
          {direction === 'incoming' && rowMenuRow.hasScan ? (
            <button type="button" className="corr__popover-item" role="menuitem" onClick={() => void viewScan(rowMenuRow)}>
              Просмотреть скан
            </button>
          ) : null}
          <div className="corr__popover-divider"/>
          <button type="button" className="corr__popover-item" role="menuitem" onClick={() => void archiveRow(rowMenuRow)}>
            В архив
          </button>
        </div>
      </>, document.body) : null}

      <CorrespondenceDocumentCardModal
        open={cardDocId !== null}
        documentId={cardDocId}
        onClose={() => setCardDocId(null)}
      />
      <CorrespondenceRegisterIncomingModal
        open={incomingModalOpen}
        onClose={() => setIncomingModalOpen(false)}
        onSubmit={handleIncomingSubmit}
        submitPending={registerPending}
      />
    </CorrespondenceShell>);
}
