import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { JournalKind } from '../model/journalDemo';
import { downloadFileGuardEvent, fetchFileGuardEvents } from '../model/fileGuardApi';
import { downloadJournalReport } from '../model/journalReportPdf';
import {
    JOURNAL_UI_INITIAL,
    buildJournalView,
    selectedJournalEvent,
    toggleFileAccess,
    type JournalChannelFilter,
    type JournalTab,
    type JournalUiState,
} from '../model/journalView';
import { JournalIcon, StatusGlyph } from './JournalIcons';

const TABS: Array<{ id: JournalTab; label: string }> = [
    { id: 'events', label: 'События' },
    { id: 'files', label: 'Файлы' },
    { id: 'users', label: 'Пользователи' },
];

function actionIcon(kind: JournalKind, title = ''): JournalKind | 'unlock' {
    if (kind === 'access' && title.includes('открыта'))
        return 'unlock';
    return kind;
}

export function ItSecurityJournal() {
    const [state, setState] = useState<JournalUiState>(JOURNAL_UI_INITIAL);
    const [loadError, setLoadError] = useState('');
    const [downloadError, setDownloadError] = useState('');
    const [reportError, setReportError] = useState('');
    const [reportBusy, setReportBusy] = useState(false);
    const model = useMemo(() => buildJournalView(state), [state]);

    useEffect(() => {
        let stopped = false;
        const load = async () => {
            try {
                const feed = await fetchFileGuardEvents();
                if (stopped)
                    return;
                setLoadError('');
                setState((current) => ({ ...current, remote: feed.events, remoteUsers: feed.users }));
            }
            catch (error) {
                if (!stopped)
                    setLoadError(error instanceof Error ? error.message : 'Журнал защиты файлов недоступен');
            }
        };
        void load();
        const timer = window.setInterval(() => void load(), 15000);
        return () => {
            stopped = true;
            window.clearInterval(timer);
        };
    }, []);

    const pickUser = (id: string, selectId: string, view?: JournalTab) => {
        setState((current) => ({
            ...current,
            user: id,
            view: view ?? current.view,
            sel: selectId || current.sel,
        }));
    };

    const downloadReport = () => {
        setReportError('');
        setReportBusy(true);
        void downloadJournalReport(model, state.view)
            .catch((error: unknown) => {
                setReportError(error instanceof Error ? error.message : 'Отчёт не удалось скачать');
            })
            .finally(() => setReportBusy(false));
    };

    return (
        <div className="its-j">
            <div className={`its-j__body${model.showDetail ? ' its-j__body--detail' : ''}`}>
                <aside className="its-j__side">
                    <div className="its-j__side-block its-j__side-block--grow">
                        <div className="its-j__kicker">Пользователи</div>
                        <label className="its-j__search its-j__search--compact">
                            <JournalIcon name="search" />
                            <input
                                type="search"
                                value={state.uq}
                                placeholder="Найти пользователя"
                                aria-label="Найти пользователя"
                                onChange={(event) => setState((current) => ({ ...current, uq: event.target.value }))}
                            />
                        </label>
                        <div className="its-j__side-list">
                            {model.sideUsers.map((user) => (
                                <button
                                    key={user.id}
                                    type="button"
                                    className={`its-j__side-item${user.active ? ' is-active' : ''}`}
                                    onClick={() => pickUser(user.id, user.selectId)}
                                >
                                    <span className={`its-j__avatar${user.id === 'all' ? ' its-j__avatar--icon' : ''}`}>
                                        {user.id === 'all' ? <JournalIcon name="users" /> : user.initial}
                                    </span>
                                    <span className="its-j__side-copy">
                                        <span className="its-j__side-label">{user.label}</span>
                                        <span className="its-j__mono its-j__side-sub">{user.sub}</span>
                                    </span>
                                    <span className="its-j__count">{user.count}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="its-j__side-block">
                        <div className="its-j__kicker">Каналы</div>
                        <div className="its-j__side-list its-j__side-list--static">
                            {model.channels.map((channel) => (
                                <button
                                    key={channel.id}
                                    type="button"
                                    className={`its-j__side-item${channel.active ? ' is-active' : ''}`}
                                    onClick={() => setState((current) => ({ ...current, channel: channel.id as JournalChannelFilter }))}
                                >
                                    <span className="its-j__chan-icon" aria-hidden>
                                        <JournalIcon name={channel.id} />
                                    </span>
                                    <span className="its-j__side-label">{channel.label}</span>
                                    <span className="its-j__count">{channel.count}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </aside>

                <div className="its-j__center">
                <div className="its-j__toolbar">
                    <div className="its-j__tabs" role="tablist" aria-label="Разделы журнала">
                        {TABS.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                role="tab"
                                aria-selected={state.view === tab.id}
                                className={`its-j__tab${state.view === tab.id ? ' is-active' : ''}`}
                                onClick={() => setState((current) => ({ ...current, view: tab.id }))}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                    <label className="its-j__search">
                        <JournalIcon name="search" />
                        <input
                            type="search"
                            value={state.q}
                            placeholder={model.searchHint}
                            aria-label="Поиск"
                            onChange={(event) => setState((current) => ({ ...current, q: event.target.value }))}
                        />
                    </label>
                    {model.periodLabel ? <span className="its-j__period">{model.periodLabel}</span> : null}
                    <button type="button" className="its-j__export" disabled={reportBusy} onClick={downloadReport}>
                        <JournalIcon name="download" />
                        {reportBusy ? 'Готовим отчёт…' : model.exportLabel}
                    </button>
                    {reportError ? <span className="its-j__bad">{reportError}</span> : null}
                </div>

                <section className="its-j__main" aria-label="Журнал">
                    <div className="its-j__tiles">
                        {model.tiles.map((tile) => (
                            <div key={tile.label} className={`its-j__tile its-j__tile--${tile.tone}`}>
                                <span className="its-j__tile-label">{tile.label}</span>
                                <span className="its-j__tile-value">{tile.value}</span>
                            </div>
                        ))}
                    </div>

                    {model.showReport && model.report ? (
                        <section className="its-j__report">
                            <div className="its-j__report-head">
                                <span className="its-j__avatar its-j__avatar--lg">{model.report.initial}</span>
                                <span className="its-j__report-who">
                                    <span className="its-j__report-title">Отчёт: {model.report.login}</span>
                                    <span className="its-j__mono its-j__side-sub">{model.report.sub}</span>
                                </span>
                                <button type="button" className="its-j__btn its-j__btn--accent" disabled={reportBusy} onClick={downloadReport}>
                                    {reportBusy ? 'Готовим отчёт…' : 'Скачать отчёт (PDF)'}
                                </button>
                                <button
                                    type="button"
                                    className="its-j__btn"
                                    onClick={() => setState((current) => ({ ...current, user: 'all' }))}
                                >
                                    Все пользователи
                                </button>
                            </div>
                            <div className="its-j__report-grid">
                                <div className="its-j__chart">
                                    <div className="its-j__kicker">Блокировки по дням</div>
                                    <div className="its-j__bars" role="img" aria-label="Блокировки по дням">
                                        {model.report.days.map((day) => (
                                            <div key={day.label} className="its-j__bar-col">
                                                <span className={`its-j__bar-n${day.value ? '' : ' is-zero'}`}>{day.value}</span>
                                                <span className="its-j__bar-slot">
                                                    <span
                                                        className={`its-j__bar${day.value ? '' : ' is-empty'}`}
                                                        style={{ '--its-h': `${day.height}px` } as CSSProperties}
                                                    />
                                                </span>
                                                <span className="its-j__bar-label">{day.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <RankList title="Куда чаще всего пытался отправить" rows={model.report.dests} tone="danger" />
                                <RankList title="Чаще всего в блокировках" rows={model.report.files} tone="info" />
                            </div>
                        </section>
                    ) : null}

                    <div className="its-j__filters">
                        <div className="its-j__chips">
                            {model.statuses.map((status) => (
                                <button
                                    key={status.id}
                                    type="button"
                                    className={`its-j__chip${status.active ? ' is-active' : ''}`}
                                    onClick={() => setState((current) => ({ ...current, status: status.id }))}
                                >
                                    {status.label}
                                    <span>{status.count}</span>
                                </button>
                            ))}
                        </div>
                        <span className="its-j__shown">{model.shownText}</span>
                    </div>

                    {state.view === 'events' && model.rows.length > 0 ? (
                        <div className="its-j__table-wrap">
                            <div className={`its-j__table its-j__ev${model.showUserColumn ? ' its-j__ev--user' : ''}`}>
                                <div className="its-j__thead">
                                    <span>Время</span>
                                    {model.showUserColumn ? <span>Пользователь</span> : null}
                                    <span>Результат</span>
                                    <span>Файл</span>
                                    <span>Действие</span>
                                    <span>Куда / процесс</span>
                                </div>
                                {model.rows.map((row) => row.kind === 'head' ? (
                                    <div key={row.id} className="its-j__day">
                                        <span>{row.label}</span>
                                        <span>{row.summary}</span>
                                    </div>
                                ) : (
                                    <button
                                        key={row.id}
                                        type="button"
                                        className={`its-j__trow${row.selected ? ' is-selected' : ''}`}
                                        onClick={() => setState((current) => ({ ...current, sel: row.id }))}
                                    >
                                        <span className="its-j__mono">{row.time}</span>
                                        {model.showUserColumn ? (
                                            <span className="its-j__stack">
                                                <span className="its-j__strong">{row.userLogin}</span>
                                                <span className="its-j__mono its-j__meta">{row.userHost}</span>
                                            </span>
                                        ) : null}
                                        <span className={`its-j__pill its-j__pill--${row.status}`}>
                                            <StatusGlyph status={row.status} />
                                            {row.statusLabel}
                                        </span>
                                        <span className="its-j__file">
                                            <JournalIcon name="file" />
                                            <span className="its-j__stack">
                                                <span className="its-j__strong">{row.name}</span>
                                                <span className="its-j__mono its-j__meta">{row.dir}</span>
                                            </span>
                                        </span>
                                        <span className="its-j__act">
                                            <JournalIcon name={actionIcon(row.action)} />
                                            {row.actionLabel}
                                        </span>
                                        <span className="its-j__stack">
                                            <span>{row.res}</span>
                                            <span className="its-j__mono its-j__meta">{row.proc}</span>
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : null}

                    {state.view === 'files' && model.fileRows.length > 0 ? (
                        <div className="its-j__table-wrap">
                            <div className={`its-j__table its-j__fi${model.showUserColumn ? ' its-j__fi--user' : ''}`}>
                                <div className="its-j__thead">
                                    <span>Файл</span>
                                    {model.showUserColumn ? <span>Пользователь</span> : null}
                                    <span>Последнее событие</span>
                                    <span>Отправка</span>
                                    <span>Блокировок</span>
                                    <span>Копий</span>
                                    <span>Изменений</span>
                                    <span>Всего</span>
                                </div>
                                {model.fileRows.map((file) => (
                                    <button
                                        key={file.key}
                                        type="button"
                                        className={`its-j__trow${file.selected ? ' is-selected' : ''}`}
                                        onClick={() => setState((current) => ({ ...current, sel: file.selectId }))}
                                    >
                                        <span className="its-j__file">
                                            <JournalIcon name="file" />
                                            <span className="its-j__stack">
                                                <span className="its-j__strong">{file.name}</span>
                                                <span className="its-j__mono its-j__meta">{file.dir}</span>
                                            </span>
                                        </span>
                                        {model.showUserColumn ? (
                                            <span className="its-j__stack">
                                                <span className="its-j__strong">{file.userLogin}</span>
                                                <span className="its-j__mono its-j__meta">{file.userHost}</span>
                                            </span>
                                        ) : null}
                                        <span className="its-j__stack">
                                            <span>{file.lastAction}</span>
                                            <span className="its-j__mono its-j__meta">{file.lastWhen}</span>
                                        </span>
                                        <span className={`its-j__pill ${file.open ? 'its-j__pill--allowed' : 'its-j__pill--blocked'}`}>
                                            {file.open ? 'Открыта' : 'Закрыта'}
                                        </span>
                                        <span className={`its-j__mono${file.blocked ? ' its-j__num--danger' : ''}`}>{file.blocked}</span>
                                        <span className="its-j__mono">{file.copies}</span>
                                        <span className="its-j__mono">{file.edits}</span>
                                        <span className="its-j__mono its-j__meta">{file.total}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : null}

                    {state.view === 'users' && model.userRows.length > 0 ? (
                        <div className="its-j__table-wrap">
                            <div className="its-j__table its-j__us">
                                <div className="its-j__thead">
                                    <span>Пользователь</span>
                                    <span>Отдел</span>
                                    <span>Событий</span>
                                    <span>Блокировок</span>
                                    <span>Файлов</span>
                                    <span>Последнее событие</span>
                                    <span>Блокировки за 7 дней</span>
                                </div>
                                {model.userRows.map((user) => {
                                    const peak = Math.max(...user.spark, 1);
                                    return (
                                        <button
                                            key={user.id}
                                            type="button"
                                            className="its-j__trow"
                                            onClick={() => pickUser(user.id, user.selectId, 'events')}
                                        >
                                            <span className="its-j__file">
                                                <span className="its-j__avatar">{user.initial}</span>
                                                <span className="its-j__stack">
                                                    <span className="its-j__strong">{user.login}</span>
                                                    <span className="its-j__mono its-j__meta">{user.host}</span>
                                                </span>
                                            </span>
                                            <span>{user.dept}</span>
                                            <span className="its-j__mono">{user.events}</span>
                                            <span className={`its-j__mono${user.blocked ? ' its-j__num--danger' : ''}`}>{user.blocked}</span>
                                            <span className="its-j__mono">{user.files}</span>
                                            <span className="its-j__mono its-j__meta">{user.last}</span>
                                            <span className="its-j__spark" aria-hidden>
                                                {user.spark.map((value, index) => (
                                                    <span
                                                        key={`${user.id}-${index}`}
                                                        className={value ? 'is-hot' : ''}
                                                        style={{ height: value ? `${4 + Math.round((value / peak) * 18)}px` : '3px' }}
                                                    />
                                                ))}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ) : null}

                    {model.isEmpty ? (
                        <div className="its-j__empty">{loadError || 'По этим фильтрам ничего нет'}</div>
                    ) : null}
                </section>
                </div>

                {model.showDetail ? (
                    <aside className="its-j__detail" aria-label="Карточка файла">
                        {model.detail.canToggle ? (
                            <div className="its-j__access">
                                <span className="its-j__stack">
                                    <span className="its-j__strong">Отправка файла</span>
                                    <span className={model.detail.open ? 'its-j__ok' : 'its-j__bad'}>
                                        {model.detail.open ? 'Открыта: файл можно отправлять' : 'Закрыта: отправка блокируется'}
                                    </span>
                                </span>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={model.detail.open}
                                    aria-label="Открыть доступ на отправку файла"
                                    className={`its-j__switch${model.detail.open ? ' is-on' : ''}`}
                                    onClick={() => {
                                        const current = selectedJournalEvent(state);
                                        if (current)
                                            setState((prev) => toggleFileAccess(prev, current));
                                    }}
                                >
                                    <span />
                                </button>
                            </div>
                        ) : null}

                        <div className="its-j__stats">
                            <div>
                                <span className="its-j__stat-n its-j__num--danger">{model.detail.blocked}</span>
                                <span>блокировок</span>
                            </div>
                            <div>
                                <span className="its-j__stat-n">{model.detail.copies}</span>
                                <span>копирований</span>
                            </div>
                            <div>
                                <span className="its-j__stat-n">{model.detail.edits}</span>
                                <span>изменений</span>
                            </div>
                        </div>

                        {model.detail.dests.length > 0 ? (
                            <div className="its-j__dests">
                                <div className="its-j__kicker">Куда пытались отправить</div>
                                <div className="its-j__dest-list">
                                    {model.detail.dests.map((dest) => (
                                        <span key={dest.label} className="its-j__dest">
                                            <span>{dest.label}</span>
                                            <span className="its-j__mono its-j__num--danger">×{dest.count}</span>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ) : null}

                        <div className="its-j__hist">
                            <div className="its-j__kicker">История файла · {model.detail.history.length}</div>
                            <ol>
                                {model.detail.history.map((item, index) => (
                                    <li key={item.id} className={item.selected ? 'is-selected' : ''}>
                                        <span className="its-j__hist-rail">
                                            <span className={`its-j__hist-dot its-j__pill--${item.status}`}>
                                                <JournalIcon name={actionIcon(item.action, item.title)} />
                                            </span>
                                            {index < model.detail.history.length - 1 ? <span className="its-j__hist-line" /> : null}
                                        </span>
                                        <span className="its-j__hist-body">
                                            <span className="its-j__hist-top">
                                                <span className="its-j__strong">{item.title}</span>
                                                <span className="its-j__mono its-j__meta">{item.when}</span>
                                            </span>
                                            <span className="its-j__hist-detail">{item.detail}</span>
                                            <span className="its-j__mono its-j__meta">
                                                {item.proc}
                                                {item.selected ? ' · выбрано' : ''}
                                            </span>
                                        </span>
                                    </li>
                                ))}
                            </ol>
                        </div>

                        {model.detail.hasFile ? (
                            <div className="its-j__detail-actions">
                                <button
                                    type="button"
                                    className="its-j__btn its-j__btn--accent"
                                    onClick={() => {
                                        setDownloadError('');
                                        void downloadFileGuardEvent(model.detail.eventId, model.detail.name).catch((error: unknown) => {
                                            setDownloadError(error instanceof Error ? error.message : 'Файл не удалось скачать');
                                        });
                                    }}
                                >
                                    Скачать файл
                                </button>
                                {downloadError ? <span className="its-j__bad">{downloadError}</span> : null}
                            </div>
                        ) : null}
                    </aside>
                ) : null}
            </div>
        </div>
    );
}

function RankList({
    title,
    rows,
    tone,
}: {
    title: string;
    rows: Array<{ label: string; count: number; width: number }>;
    tone: 'danger' | 'info';
}) {
    return (
        <div className="its-j__ranks">
            <div className="its-j__kicker">{title}</div>
            {rows.length === 0 ? <span className="its-j__meta">Нет данных</span> : null}
            {rows.map((row) => (
                <div key={row.label} className="its-j__rank">
                    <span className="its-j__rank-top">
                        <span>{row.label}</span>
                        <span className={`its-j__rank-count its-j__rank-count--${tone}`}>{row.count}</span>
                    </span>
                    <span className="its-j__rank-track">
                        <span className={`its-j__rank-fill its-j__rank-fill--${tone}`} style={{ width: `${row.width}%` }} />
                    </span>
                </div>
            ))}
        </div>
    );
}
