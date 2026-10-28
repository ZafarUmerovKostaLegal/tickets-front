import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { downloadFileGuardEvent, fetchFileGuardEventFile, fetchFileGuardEvents, fetchFileGuardPolicies, fetchFileGuardStorage, fileGuardPreviewBlob, matchingPolicy, policyScope, saveFileGuardPolicy } from '../model/fileGuardApi';
import { downloadJournalReport } from '../model/journalReportPdf';
import { JOURNAL_UI_INITIAL, buildJournalView, selectedJournalEvent, toggleFileAccess, } from '../model/journalView';
import { JournalIcon, StatusGlyph } from './JournalIcons';
import { FileGuardFilePreview } from './FileGuardFilePreview';
import { FileGuardLimitSettings } from './FileGuardLimitSettings';
import { FileGuardStorage } from './FileGuardStorage';
const TABS = [
    { id: 'events', label: 'События' },
    { id: 'files', label: 'Файлы' },
    { id: 'users', label: 'Пользователи' },
    { id: 'storage', label: 'Хранилище' },
];
const JOURNAL_USER_KEY = 'it-security-journal-user';
function storedJournalUser() {
    try {
        const raw = window.localStorage.getItem(JOURNAL_USER_KEY)?.trim() ?? '';
        if (!raw || raw.length > 300 || /[\u0000-\u001f]/.test(raw))
            return 'all';
        return raw;
    }
    catch {
        return 'all';
    }
}
function rememberJournalUser(userId) {
    try {
        window.localStorage.setItem(JOURNAL_USER_KEY, userId || 'all');
    }
    catch {
        /* браузер может запретить хранилище */
    }
}
function actionIcon(kind, title = '') {
    if (kind === 'access' && title.includes('открыта'))
        return 'unlock';
    return kind;
}
export function ItSecurityJournal() {
    const [state, setState] = useState(() => ({
        ...JOURNAL_UI_INITIAL,
        user: storedJournalUser(),
    }));
    const [loadError, setLoadError] = useState('');
    const [downloadError, setDownloadError] = useState('');
    const [reportError, setReportError] = useState('');
    const [reportBusy, setReportBusy] = useState(false);
    const [preview, setPreview] = useState(null);
    const [policies, setPolicies] = useState([]);
    const [sharedInput, setSharedInput] = useState('');
    const [userInput, setUserInput] = useState('');
    const [limitsOpen, setLimitsOpen] = useState(false);
    const [limitError, setLimitError] = useState('');
    const [limitBusy, setLimitBusy] = useState('');
    const [storedFiles, setStoredFiles] = useState([]);
    const [storedBytes, setStoredBytes] = useState(0);
    const [storageError, setStorageError] = useState('');
    const [storageReload, setStorageReload] = useState(0);
    useEffect(() => {
        let stopped = false;
        void fetchFileGuardPolicies()
            .then((items) => {
            if (!stopped)
                setPolicies(items);
        })
            .catch((error) => {
            if (!stopped)
                setLimitError(error instanceof Error ? error.message : 'Лимит не загрузился');
        });
        return () => {
            stopped = true;
        };
    }, []);
    const scope = policyScope(state.user);
    const sharedPolicy = matchingPolicy(policies, '*', '*');
    const personalPolicy = scope.host === '*' ? null : matchingPolicy(policies, scope.host, scope.windowsUser);
    const sharedLimit = sharedPolicy?.dailyLimitMb;
    const personalLimit = personalPolicy?.dailyLimitMb;
    const personalName = scope.windowsUser === '*' ? '' : scope.windowsUser;
    useEffect(() => {
        setSharedInput(sharedLimit == null ? '' : String(sharedLimit));
    }, [sharedLimit]);
    useEffect(() => {
        setUserInput(personalLimit == null ? '' : String(personalLimit));
    }, [personalLimit, scope.host, scope.windowsUser]);
    const appliedLimit = scope.host !== '*' && personalLimit != null ? personalLimit : sharedLimit;
    const limitChip = appliedLimit == null ? 'не задан' : `${appliedLimit} МБ`;
    const saveLimit = (host, windowsUser, text) => {
        const value = text.trim() === '' ? null : Number(text.trim());
        if (value != null && (!Number.isInteger(value) || value < 0 || value > 100000)) {
            setLimitError('Введите размер в МБ от 0 до 100000 или оставьте поле пустым');
            return;
        }
        setLimitError('');
        setLimitBusy(host === '*' ? 'shared' : 'user');
        void saveFileGuardPolicy(host, windowsUser, value)
            .then((saved) => {
            setPolicies((current) => {
                const rest = current.filter((item) => item.host !== saved.host || item.windowsUser !== saved.windowsUser);
                return saved.removed || saved.dailyLimitMb == null ? rest : [...rest, saved];
            });
        })
            .catch((error) => {
            setLimitError(error instanceof Error ? error.message : 'Лимит не удалось сохранить');
        })
            .finally(() => setLimitBusy(''));
    };
    const previewUrl = useRef(null);
    const previewToken = useRef(0);
    const model = useMemo(() => buildJournalView(state), [state]);
    useEffect(() => {
        let stopped = false;
        const load = async () => {
            try {
                const feed = await fetchFileGuardEvents();
                if (stopped)
                    return;
                setLoadError('');
                setState((current) => ({
                    ...current,
                    remote: feed.events,
                    remoteUsers: feed.users,
                    user: current.user === 'all' || feed.users.some((user) => user.id === current.user)
                        ? current.user
                        : 'all',
                }));
            }
            catch (error) {
                if (!stopped)
                    setLoadError(error instanceof Error ? error.message : 'Журнал защиты файлов недоступен');
            }
            try {
                const catalog = await fetchFileGuardStorage();
                if (stopped)
                    return;
                setStorageError('');
                setStoredFiles(catalog.items);
                setStoredBytes(catalog.totalBytes);
            }
            catch (error) {
                if (!stopped)
                    setStorageError(error instanceof Error ? error.message : 'Хранилище файлов недоступно');
            }
        };
        void load();
        const timer = window.setInterval(() => void load(), 15000);
        return () => {
            stopped = true;
            window.clearInterval(timer);
        };
    }, [storageReload]);
    const pickUser = (id, selectId, view) => {
        setState((current) => ({
            ...current,
            user: id,
            view: view ?? current.view,
            sel: selectId || current.sel,
        }));
    };
    useEffect(() => {
        rememberJournalUser(state.user);
    }, [state.user]);
    const downloadReport = () => {
        setReportError('');
        setReportBusy(true);
        void downloadJournalReport(model, state.view)
            .catch((error) => {
            setReportError(error instanceof Error ? error.message : 'Отчёт не удалось скачать');
        })
            .finally(() => setReportBusy(false));
    };
    const releasePreview = () => {
        if (previewUrl.current) {
            URL.revokeObjectURL(previewUrl.current);
            previewUrl.current = null;
        }
    };
    const closePreview = () => {
        previewToken.current += 1;
        releasePreview();
        setPreview(null);
    };
    const openPreview = (eventId, fileName) => {
        const token = previewToken.current + 1;
        previewToken.current = token;
        releasePreview();
        setDownloadError('');
        setPreview({ eventId, fileName, loading: true, error: '', model: null });
        void (async () => {
            try {
                const file = await fetchFileGuardEventFile(eventId);
                if (previewToken.current !== token)
                    return;
                const blob = fileGuardPreviewBlob(file.blob, fileName, file.contentType);
                const { buildAttachmentPreview } = await import('@entities/expenses/lib/buildAttachmentPreview');
                const built = await buildAttachmentPreview(blob, fileName, blob.type || file.contentType);
                if (previewToken.current !== token) {
                    if (built.objectUrl)
                        URL.revokeObjectURL(built.objectUrl);
                    return;
                }
                previewUrl.current = built.objectUrl;
                setPreview({ eventId, fileName, loading: false, error: '', model: built.model });
            }
            catch (error) {
                if (previewToken.current !== token)
                    return;
                setPreview({
                    eventId,
                    fileName,
                    loading: false,
                    error: error instanceof Error ? error.message : 'Файл не удалось открыть',
                    model: null,
                });
            }
        })();
    };
    useEffect(() => () => {
        if (previewUrl.current)
            URL.revokeObjectURL(previewUrl.current);
    }, []);
    return (_jsxs("div", { className: "its-j", children: [_jsx(FileGuardFilePreview, { preview: preview, downloadError: downloadError, onClose: closePreview, onDownload: () => {
                    if (!preview)
                        return;
                    setDownloadError('');
                    void downloadFileGuardEvent(preview.eventId, preview.fileName).catch((error) => {
                        setDownloadError(error instanceof Error ? error.message : 'Файл не удалось скачать');
                    });
                } }), _jsx(FileGuardLimitSettings, { open: limitsOpen, onClose: () => setLimitsOpen(false), sharedInput: sharedInput, userInput: userInput, onSharedInput: setSharedInput, onUserInput: setUserInput, sharedLimit: sharedLimit, personalLimit: personalLimit, personalName: personalName, userSelected: scope.host !== '*', busy: limitBusy, error: limitError, onSaveShared: () => saveLimit('*', '*', sharedInput), onSaveUser: () => saveLimit(scope.host, scope.windowsUser, userInput) }), _jsxs("div", { className: `its-j__body${model.showDetail ? ' its-j__body--detail' : ''}`, children: [_jsxs("aside", { className: "its-j__side", children: [_jsxs("div", { className: "its-j__side-block its-j__side-block--grow", children: [_jsx("div", { className: "its-j__kicker", children: "\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u0438" }), _jsxs("label", { className: "its-j__search its-j__search--compact", children: [_jsx(JournalIcon, { name: "search" }), _jsx("input", { type: "search", value: state.uq, placeholder: "\u041D\u0430\u0439\u0442\u0438 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F", "aria-label": "\u041D\u0430\u0439\u0442\u0438 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F", onChange: (event) => setState((current) => ({ ...current, uq: event.target.value })) })] }), _jsx("div", { className: "its-j__side-list", children: model.sideUsers.map((user) => (_jsxs("button", { type: "button", className: `its-j__side-item${user.active ? ' is-active' : ''}`, onClick: () => pickUser(user.id, user.selectId), children: [_jsx("span", { className: `its-j__avatar${user.id === 'all' ? ' its-j__avatar--icon' : ''}`, children: user.id === 'all' ? _jsx(JournalIcon, { name: "users" }) : user.initial }), _jsxs("span", { className: "its-j__side-copy", children: [_jsx("span", { className: "its-j__side-label", children: user.label }), _jsx("span", { className: "its-j__mono its-j__side-sub", children: user.sub })] }), _jsx("span", { className: "its-j__count", children: user.count })] }, user.id))) })] }), _jsxs("div", { className: "its-j__side-block", children: [_jsx("div", { className: "its-j__kicker", children: "\u041A\u0430\u043D\u0430\u043B\u044B" }), _jsx("div", { className: "its-j__side-list its-j__side-list--static", children: model.channels.map((channel) => (_jsxs("button", { type: "button", className: `its-j__side-item${channel.active ? ' is-active' : ''}`, onClick: () => setState((current) => ({ ...current, channel: channel.id })), children: [_jsx("span", { className: "its-j__chan-icon", "aria-hidden": true, children: _jsx(JournalIcon, { name: channel.id }) }), _jsx("span", { className: "its-j__side-label", children: channel.label }), _jsx("span", { className: "its-j__count", children: channel.count })] }, channel.id))) })] })] }), _jsxs("div", { className: "its-j__center", children: [_jsxs("div", { className: "its-j__toolbar", children: [_jsx("div", { className: "its-j__tabs", role: "tablist", "aria-label": "\u0420\u0430\u0437\u0434\u0435\u043B\u044B \u0436\u0443\u0440\u043D\u0430\u043B\u0430", children: TABS.map((tab) => (_jsx("button", { type: "button", role: "tab", "aria-selected": state.view === tab.id, className: `its-j__tab${state.view === tab.id ? ' is-active' : ''}`, onClick: () => setState((current) => ({ ...current, view: tab.id })), children: tab.label }, tab.id))) }), _jsxs("label", { className: "its-j__search", children: [_jsx(JournalIcon, { name: "search" }), _jsx("input", { type: "search", value: state.q, placeholder: model.searchHint, "aria-label": "\u041F\u043E\u0438\u0441\u043A", onChange: (event) => setState((current) => ({ ...current, q: event.target.value })) })] }), model.periodLabel ? _jsx("span", { className: "its-j__period", children: model.periodLabel }) : null, _jsxs("button", { type: "button", className: "its-j__btn its-j__limit-btn", onClick: () => setLimitsOpen(true), children: [_jsx(JournalIcon, { name: "settings" }), "\u041B\u0438\u043C\u0438\u0442\u044B", _jsx("span", { className: "its-j__limit-chip", children: limitChip })] }), _jsxs("button", { type: "button", className: "its-j__export", disabled: reportBusy, onClick: downloadReport, children: [_jsx(JournalIcon, { name: "download" }), reportBusy ? 'Готовим отчёт…' : model.exportLabel] }), reportError ? _jsx("span", { className: "its-j__bad", children: reportError }) : null] }), _jsxs("section", { className: "its-j__main", "aria-label": "\u0416\u0443\u0440\u043D\u0430\u043B", children: [state.view === 'storage' ? (_jsx(FileGuardStorage, { items: storedFiles, totalBytes: storedBytes, query: state.q, userId: state.user, loadError: storageError, onPreview: openPreview, onDownload: (eventId, fileName) => {
                                            setDownloadError('');
                                            void downloadFileGuardEvent(eventId, fileName).catch((error) => {
                                                setStorageError(error instanceof Error ? error.message : 'Файл не удалось скачать');
                                            });
                                        }, onChanged: () => setStorageReload((value) => value + 1) })) : null, state.view !== 'storage' ? (_jsxs(_Fragment, { children: [_jsx("div", { className: "its-j__tiles", children: model.tiles.map((tile) => (_jsxs("div", { className: `its-j__tile its-j__tile--${tile.tone}`, children: [_jsx("span", { className: "its-j__tile-label", children: tile.label }), _jsx("span", { className: "its-j__tile-value", children: tile.value })] }, tile.label))) }), model.showReport && model.report ? (_jsxs("section", { className: "its-j__report", children: [_jsxs("div", { className: "its-j__report-head", children: [_jsx("span", { className: "its-j__avatar its-j__avatar--lg", children: model.report.initial }), _jsxs("span", { className: "its-j__report-who", children: [_jsxs("span", { className: "its-j__report-title", children: ["\u041E\u0442\u0447\u0451\u0442: ", model.report.login] }), _jsx("span", { className: "its-j__mono its-j__side-sub", children: model.report.sub })] }), _jsx("button", { type: "button", className: "its-j__btn its-j__btn--accent", disabled: reportBusy, onClick: downloadReport, children: reportBusy ? 'Готовим отчёт…' : 'Скачать отчёт (PDF)' })] }), _jsxs("div", { className: "its-j__report-grid", children: [_jsxs("div", { className: "its-j__chart", children: [_jsx("div", { className: "its-j__kicker", children: "\u0411\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u043A\u0438 \u043F\u043E \u0434\u043D\u044F\u043C" }), _jsx("div", { className: "its-j__bars", role: "img", "aria-label": "\u0411\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u043A\u0438 \u043F\u043E \u0434\u043D\u044F\u043C", children: model.report.days.map((day) => (_jsxs("div", { className: "its-j__bar-col", children: [_jsx("span", { className: `its-j__bar-n${day.value ? '' : ' is-zero'}`, children: day.value }), _jsx("span", { className: "its-j__bar-slot", children: _jsx("span", { className: `its-j__bar${day.value ? '' : ' is-empty'}`, style: { '--its-h': `${day.height}px` } }) }), _jsx("span", { className: "its-j__bar-label", children: day.label })] }, day.label))) })] }), _jsx(RankList, { title: "\u041A\u0443\u0434\u0430 \u0447\u0430\u0449\u0435 \u0432\u0441\u0435\u0433\u043E \u043F\u044B\u0442\u0430\u043B\u0441\u044F \u043E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C", rows: model.report.dests, tone: "danger" }), _jsx(RankList, { title: "\u0427\u0430\u0449\u0435 \u0432\u0441\u0435\u0433\u043E \u0432 \u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u043A\u0430\u0445", rows: model.report.files, tone: "info" })] })] })) : null, _jsxs("div", { className: "its-j__filters", children: [_jsx("div", { className: "its-j__chips", children: model.statuses.map((status) => (_jsxs("button", { type: "button", className: `its-j__chip${status.active ? ' is-active' : ''}`, onClick: () => setState((current) => ({ ...current, status: status.id })), children: [status.label, _jsx("span", { children: status.count })] }, status.id))) }), _jsx("span", { className: "its-j__shown", children: model.shownText })] }), state.view === 'events' && model.rows.length > 0 ? (_jsx("div", { className: "its-j__table-wrap", children: _jsxs("div", { className: `its-j__table its-j__ev${model.showUserColumn ? ' its-j__ev--user' : ''}`, children: [_jsxs("div", { className: "its-j__thead", children: [_jsx("span", { children: "\u0412\u0440\u0435\u043C\u044F" }), model.showUserColumn ? _jsx("span", { children: "\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C" }) : null, _jsx("span", { children: "\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442" }), _jsx("span", { children: "\u0424\u0430\u0439\u043B" }), _jsx("span", { children: "\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435" }), _jsx("span", { children: "\u041A\u0443\u0434\u0430 / \u043F\u0440\u043E\u0446\u0435\u0441\u0441" })] }), model.rows.map((row) => row.kind !== 'event' ? (_jsxs("button", { type: "button", className: `its-j__day${row.kind === 'month' ? ' its-j__month' : ''}${row.open ? ' is-open' : ''}`, "aria-expanded": row.open, onClick: () => setState((current) => row.kind === 'month' ? ({
                                                                ...current,
                                                                monthsOpen: { ...current.monthsOpen, [row.month]: !row.open },
                                                            }) : ({
                                                                ...current,
                                                                daysOpen: { ...current.daysOpen, [row.day]: !row.open },
                                                            })), children: [_jsxs("span", { className: "its-j__day-title", children: [_jsx("span", { className: "its-j__day-mark", "aria-hidden": true }), row.label] }), _jsx("span", { children: row.summary })] }, row.id)) : (_jsxs("button", { type: "button", className: `its-j__trow${row.selected ? ' is-selected' : ''}`, onClick: () => setState((current) => ({ ...current, sel: row.id })), children: [_jsx("span", { className: "its-j__mono", children: row.time }), model.showUserColumn ? (_jsxs("span", { className: "its-j__stack", children: [_jsx("span", { className: "its-j__strong", children: row.userLogin }), _jsx("span", { className: "its-j__mono its-j__meta", children: row.userHost })] })) : null, _jsxs("span", { className: `its-j__pill its-j__pill--${row.status}`, children: [_jsx(StatusGlyph, { status: row.status }), row.statusLabel] }), _jsxs("span", { className: "its-j__file", children: [_jsx(JournalIcon, { name: "file" }), _jsxs("span", { className: "its-j__stack", children: [_jsx("span", { className: "its-j__strong", children: row.name }), _jsx("span", { className: "its-j__mono its-j__meta", children: row.dir })] })] }), _jsxs("span", { className: "its-j__act", children: [_jsx(JournalIcon, { name: actionIcon(row.action) }), row.actionLabel] }), _jsxs("span", { className: "its-j__stack", children: [_jsx("span", { children: row.res }), _jsx("span", { className: "its-j__mono its-j__meta", children: row.proc })] })] }, row.id)))] }) })) : null, state.view === 'files' && model.fileRows.length > 0 ? (_jsx("div", { className: "its-j__table-wrap", children: _jsxs("div", { className: `its-j__table its-j__fi${model.showUserColumn ? ' its-j__fi--user' : ''}`, children: [_jsxs("div", { className: "its-j__thead", children: [_jsx("span", { children: "\u0424\u0430\u0439\u043B" }), model.showUserColumn ? _jsx("span", { children: "\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C" }) : null, _jsx("span", { children: "\u041F\u043E\u0441\u043B\u0435\u0434\u043D\u0435\u0435 \u0441\u043E\u0431\u044B\u0442\u0438\u0435" }), _jsx("span", { children: "\u041E\u0442\u043F\u0440\u0430\u0432\u043A\u0430" }), _jsx("span", { children: "\u0411\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u043E\u043A" }), _jsx("span", { children: "\u041A\u043E\u043F\u0438\u0439" }), _jsx("span", { children: "\u0418\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0439" }), _jsx("span", { children: "\u0412\u0441\u0435\u0433\u043E" })] }), model.fileRows.map((file) => (_jsxs("button", { type: "button", className: `its-j__trow${file.selected ? ' is-selected' : ''}`, onClick: () => setState((current) => ({ ...current, sel: file.selectId })), children: [_jsxs("span", { className: "its-j__file", children: [_jsx(JournalIcon, { name: "file" }), _jsxs("span", { className: "its-j__stack", children: [_jsx("span", { className: "its-j__strong", children: file.name }), _jsx("span", { className: "its-j__mono its-j__meta", children: file.dir })] })] }), model.showUserColumn ? (_jsxs("span", { className: "its-j__stack", children: [_jsx("span", { className: "its-j__strong", children: file.userLogin }), _jsx("span", { className: "its-j__mono its-j__meta", children: file.userHost })] })) : null, _jsxs("span", { className: "its-j__stack", children: [_jsx("span", { children: file.lastAction }), _jsx("span", { className: "its-j__mono its-j__meta", children: file.lastWhen })] }), _jsx("span", { className: `its-j__pill ${file.open ? 'its-j__pill--allowed' : 'its-j__pill--blocked'}`, children: file.open ? 'Открыта' : 'Закрыта' }), _jsx("span", { className: `its-j__mono${file.blocked ? ' its-j__num--danger' : ''}`, children: file.blocked }), _jsx("span", { className: "its-j__mono", children: file.copies }), _jsx("span", { className: "its-j__mono", children: file.edits }), _jsx("span", { className: "its-j__mono its-j__meta", children: file.total })] }, file.key)))] }) })) : null, state.view === 'users' && model.userRows.length > 0 ? (_jsx("div", { className: "its-j__table-wrap", children: _jsxs("div", { className: "its-j__table its-j__us", children: [_jsxs("div", { className: "its-j__thead", children: [_jsx("span", { children: "\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C" }), _jsx("span", { children: "\u041E\u0442\u0434\u0435\u043B" }), _jsx("span", { children: "\u0421\u043E\u0431\u044B\u0442\u0438\u0439" }), _jsx("span", { children: "\u0411\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u043E\u043A" }), _jsx("span", { children: "\u0424\u0430\u0439\u043B\u043E\u0432" }), _jsx("span", { children: "\u041F\u043E\u0441\u043B\u0435\u0434\u043D\u0435\u0435 \u0441\u043E\u0431\u044B\u0442\u0438\u0435" }), _jsx("span", { children: "\u0411\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u043A\u0438 \u0437\u0430 7 \u0434\u043D\u0435\u0439" })] }), model.userRows.map((user) => {
                                                            const peak = Math.max(...user.spark, 1);
                                                            return (_jsxs("button", { type: "button", className: "its-j__trow", onClick: () => pickUser(user.id, user.selectId, 'events'), children: [_jsxs("span", { className: "its-j__file", children: [_jsx("span", { className: "its-j__avatar", children: user.initial }), _jsxs("span", { className: "its-j__stack", children: [_jsx("span", { className: "its-j__strong", children: user.login }), _jsx("span", { className: "its-j__mono its-j__meta", children: user.host })] })] }), _jsx("span", { children: user.dept }), _jsx("span", { className: "its-j__mono", children: user.events }), _jsx("span", { className: `its-j__mono${user.blocked ? ' its-j__num--danger' : ''}`, children: user.blocked }), _jsx("span", { className: "its-j__mono", children: user.files }), _jsx("span", { className: "its-j__mono its-j__meta", children: user.last }), _jsx("span", { className: "its-j__spark", "aria-hidden": true, children: user.spark.map((value, index) => (_jsx("span", { className: value ? 'is-hot' : '', style: { height: value ? `${4 + Math.round((value / peak) * 18)}px` : '3px' } }, `${user.id}-${index}`))) })] }, user.id));
                                                        })] }) })) : null, model.isEmpty ? (_jsx("div", { className: "its-j__empty", children: loadError || 'По этим фильтрам ничего нет' })) : null] })) : null] })] }), model.showDetail ? (_jsxs("aside", { className: "its-j__detail", "aria-label": "\u041A\u0430\u0440\u0442\u043E\u0447\u043A\u0430 \u0444\u0430\u0439\u043B\u0430", children: [model.detail.canToggle ? (_jsxs("div", { className: "its-j__access", children: [_jsxs("span", { className: "its-j__stack", children: [_jsx("span", { className: "its-j__strong", children: "\u041E\u0442\u043F\u0440\u0430\u0432\u043A\u0430 \u0444\u0430\u0439\u043B\u0430" }), _jsx("span", { className: model.detail.open ? 'its-j__ok' : 'its-j__bad', children: model.detail.open ? 'Открыта: файл можно отправлять' : 'Закрыта: отправка блокируется' })] }), _jsx("button", { type: "button", role: "switch", "aria-checked": model.detail.open, "aria-label": "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0434\u043E\u0441\u0442\u0443\u043F \u043D\u0430 \u043E\u0442\u043F\u0440\u0430\u0432\u043A\u0443 \u0444\u0430\u0439\u043B\u0430", className: `its-j__switch${model.detail.open ? ' is-on' : ''}`, onClick: () => {
                                            const current = selectedJournalEvent(state);
                                            if (current)
                                                setState((prev) => toggleFileAccess(prev, current));
                                        }, children: _jsx("span", {}) })] })) : null, _jsxs("div", { className: "its-j__stats", children: [_jsxs("div", { children: [_jsx("span", { className: "its-j__stat-n its-j__num--danger", children: model.detail.blocked }), _jsx("span", { children: "\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u043E\u043A" })] }), _jsxs("div", { children: [_jsx("span", { className: "its-j__stat-n", children: model.detail.copies }), _jsx("span", { children: "\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0439" })] }), _jsxs("div", { children: [_jsx("span", { className: "its-j__stat-n", children: model.detail.edits }), _jsx("span", { children: "\u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0439" })] })] }), model.detail.dests.length > 0 ? (_jsxs("div", { className: "its-j__dests", children: [_jsx("div", { className: "its-j__kicker", children: "\u041A\u0443\u0434\u0430 \u043F\u044B\u0442\u0430\u043B\u0438\u0441\u044C \u043E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C" }), _jsx("div", { className: "its-j__dest-list", children: model.detail.dests.map((dest) => (_jsxs("span", { className: "its-j__dest", children: [_jsx("span", { children: dest.label }), _jsxs("span", { className: "its-j__mono its-j__num--danger", children: ["\u00D7", dest.count] })] }, dest.label))) })] })) : null, _jsxs("div", { className: "its-j__hist", children: [_jsxs("div", { className: "its-j__kicker", children: ["\u0418\u0441\u0442\u043E\u0440\u0438\u044F \u0444\u0430\u0439\u043B\u0430 \u00B7 ", model.detail.history.length] }), _jsx("ol", { children: model.detail.history.map((item, index) => (_jsxs("li", { className: item.selected ? 'is-selected' : '', children: [_jsxs("span", { className: "its-j__hist-rail", children: [_jsx("span", { className: `its-j__hist-dot its-j__pill--${item.status}`, children: _jsx(JournalIcon, { name: actionIcon(item.action, item.title) }) }), index < model.detail.history.length - 1 ? _jsx("span", { className: "its-j__hist-line" }) : null] }), _jsxs("span", { className: "its-j__hist-body", children: [_jsxs("span", { className: "its-j__hist-top", children: [_jsx("span", { className: "its-j__strong", children: item.title }), _jsx("span", { className: "its-j__mono its-j__meta", children: item.when })] }), _jsx("span", { className: "its-j__hist-detail", children: item.detail }), _jsxs("span", { className: "its-j__mono its-j__meta", children: [item.proc, item.selected ? ' · выбрано' : ''] })] })] }, item.id))) })] }), model.detail.hasFile ? (_jsxs("div", { className: "its-j__detail-actions", children: [_jsx("button", { type: "button", className: "its-j__btn its-j__btn--accent", onClick: () => openPreview(model.detail.eventId, model.detail.name), children: "\u041F\u0440\u043E\u0441\u043C\u043E\u0442\u0440" }), _jsx("button", { type: "button", className: "its-j__btn", onClick: () => {
                                            setDownloadError('');
                                            void downloadFileGuardEvent(model.detail.eventId, model.detail.name).catch((error) => {
                                                setDownloadError(error instanceof Error ? error.message : 'Файл не удалось скачать');
                                            });
                                        }, children: "\u0421\u043A\u0430\u0447\u0430\u0442\u044C \u0444\u0430\u0439\u043B" }), downloadError ? _jsx("span", { className: "its-j__bad", children: downloadError }) : null] })) : null] })) : null] })] }));
}
function RankList({ title, rows, tone, }) {
    return (_jsxs("div", { className: "its-j__ranks", children: [_jsx("div", { className: "its-j__kicker", children: title }), rows.length === 0 ? _jsx("span", { className: "its-j__meta", children: "\u041D\u0435\u0442 \u0434\u0430\u043D\u043D\u044B\u0445" }) : null, rows.map((row) => (_jsxs("div", { className: "its-j__rank", children: [_jsxs("span", { className: "its-j__rank-top", children: [_jsx("span", { children: row.label }), _jsx("span", { className: `its-j__rank-count its-j__rank-count--${tone}`, children: row.count })] }), _jsx("span", { className: "its-j__rank-track", children: _jsx("span", { className: `its-j__rank-fill its-j__rank-fill--${tone}`, style: { width: `${row.width}%` } }) })] }, row.label)))] }));
}
