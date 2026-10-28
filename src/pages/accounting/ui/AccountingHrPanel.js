import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getUsers } from '@entities/user';
import { fetchInternalExtensions } from '@entities/internal-communication';
import { getItems } from '@entities/inventory';
import { fetchVacationLeaveRequestPdfBlob, fetchVacationManualEntryDocumentBlob, listVacationAbsenceDays, listVacationLeaveRequests, listVacationManualEntries, listVacationScheduleEmployees, VACATION_LEAVE_REQUEST_KINDS, VACATION_LEAVE_REQUEST_STATUSES, } from '@entities/vacation';
import { formatRuDateLong, formatRuRange, leaveKindLabel, leaveStatusLabel, ruDaysWord } from '@pages/vacation-schedule/lib/leaveRequestDisplay';
import { deletePersonnelFile, fetchPersonnelFileBlob, fetchPersonnelPhotoBlob, listPersonnelFiles, listPersonnelPhotoIndex, uploadPersonnelFile, uploadPersonnelPhoto, } from '@entities/hr';
import { HrPhotoCropDialog } from './HrPhotoCropDialog';
import { routes } from '@shared/config';
import { NavLink } from 'react-router-dom';
import './AccountingHrPanel.css';
function personName(user) {
    return (user.display_name || user.email || '').trim();
}
const EQUIPMENT_STATUS_LABEL = {
    in_use: 'В использовании',
    in_stock: 'На складе',
    repair: 'В ремонте',
    written_off: 'Списано',
};
function equipmentStatusLabel(status) {
    return EQUIPMENT_STATUS_LABEL[status] ?? status;
}
function isLeaveKind(kind) {
    return VACATION_LEAVE_REQUEST_KINDS.includes(kind);
}
function isLeaveStatus(status) {
    return VACATION_LEAVE_REQUEST_STATUSES.includes(status);
}
function absenceKindLabel(kind) {
    return isLeaveKind(kind) ? leaveKindLabel(kind) : kind;
}
function nextIsoDay(iso) {
    const date = new Date(`${iso.slice(0, 10)}T12:00:00`);
    date.setDate(date.getDate() + 1);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
}
function groupAbsenceDays(days) {
    const sorted = [...days].sort((a, b) => a.absence_on.localeCompare(b.absence_on) || a.kind.localeCompare(b.kind));
    const spans = [];
    for (const day of sorted) {
        const iso = day.absence_on.slice(0, 10);
        const last = spans[spans.length - 1];
        if (last && last.kind === day.kind && nextIsoDay(last.to) === iso) {
            last.to = iso;
            last.days += 1;
            continue;
        }
        spans.push({
            key: `${day.employee_id}-${iso}-${day.kind}`,
            from: iso,
            to: iso,
            kind: day.kind,
            days: 1,
        });
    }
    return spans;
}
function initials(user) {
    const source = (user.initials || personName(user) || '?').trim();
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length >= 2)
        return (parts[0][0] + parts[1][0]).toUpperCase();
    return source.slice(0, 2).toUpperCase();
}
function formatDate(iso) {
    if (!iso)
        return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime()))
        return '—';
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}
function normalizeName(value) {
    return value.trim().toLowerCase().replace(/\s+/g, ' ');
}
function matchExtension(user, extensions) {
    const name = normalizeName(personName(user));
    if (!name)
        return null;
    const exact = extensions.find((row) => normalizeName(row.fullName) === name);
    if (exact)
        return exact;
    return extensions.find((row) => {
        const n = normalizeName(row.fullName);
        return n.includes(name) || name.includes(n);
    }) ?? null;
}
function roleTone(role) {
    const r = role.trim().toLowerCase();
    if (r.includes('партн') || r.includes('partner'))
        return 'partner';
    if (r.includes('админ') || r.includes('admin'))
        return 'admin';
    return 'staff';
}
const photoBlobUrls = new Map();
function useAuthImage(userId, version) {
    const cacheKey = version ? `${userId}:${version}` : '';
    const [src, setSrc] = useState(() => (cacheKey ? photoBlobUrls.get(cacheKey) ?? null : null));
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        if (!cacheKey || !version) {
            setSrc(null);
            setFailed(false);
            return undefined;
        }
        const cached = photoBlobUrls.get(cacheKey);
        if (cached) {
            setSrc(cached);
            setFailed(false);
            return undefined;
        }
        let cancel = false;
        setFailed(false);
        void fetchPersonnelPhotoBlob(userId, version).then((blob) => {
            const kind = (blob.type || '').toLowerCase();
            if (blob.size < 32 || kind.startsWith('text/') || kind.includes('json') || kind.includes('html'))
                throw new Error('empty photo');
            const url = URL.createObjectURL(blob);
            photoBlobUrls.set(cacheKey, url);
            if (!cancel) {
                setSrc(url);
                setFailed(false);
            }
        }).catch(() => {
            if (!cancel) {
                setSrc(null);
                setFailed(true);
            }
        });
        return () => {
            cancel = true;
        };
    }, [cacheKey, userId, version]);
    return { src, failed };
}
function PersonPhoto({ user, size, photoVersion, onMissing, }) {
    const uploaded = useAuthImage(user.id, photoVersion ?? null);
    const [pictureBroken, setPictureBroken] = useState(false);
    useEffect(() => {
        setPictureBroken(false);
    }, [user.id]);
    const external = pictureBroken ? '' : (user.picture?.trim() || '');
    const picture = uploaded.src || ((uploaded.failed || !photoVersion) ? external : '');
    useEffect(() => {
        onMissing?.(Boolean(photoVersion) && uploaded.failed && !picture);
    }, [onMissing, photoVersion, picture, uploaded.failed]);
    return (_jsx("span", { className: `acct-hr__photo acct-hr__photo--${size}${picture ? '' : ' acct-hr__photo--fallback'}`, children: picture
            ? _jsx("img", { src: picture, alt: "", onError: () => setPictureBroken(true) })
            : _jsx("span", { "aria-hidden": true, children: initials(user) }) }));
}
function isPersonnelImage(file) {
    return /\.(jpe?g|png|webp|gif)$/i.test(file.filename) || (file.contentType ?? '').startsWith('image/');
}
const DOSSIER_SLOTS = [
    { id: 'contract', title: 'Трудовой договор', hint: 'Основной договор и допсоглашения' },
    { id: 'id', title: 'Документ, удостоверяющий личность', hint: 'Паспорт / ID — сканы для кадрового дела' },
    { id: 'education', title: 'Образование', hint: 'Дипломы и сертификаты' },
    { id: 'medical', title: 'Медицинские справки', hint: 'При необходимости по должности' },
    { id: 'orders', title: 'Приказы', hint: 'Приказы о приёме, переводе, отпуске и другие' },
    { id: 'other', title: 'Прочие документы', hint: 'Любые дополнительные файлы личного дела' },
];
const EMPTY_EXTRAS = {
    loading: false,
    extension: null,
    equipment: [],
    leaveRequests: [],
    absences: [],
    manualEntries: [],
    personnelFiles: [],
    scheduleEmployee: null,
    error: '',
};
export function AccountingHrPanel() {
    const year = new Date().getFullYear();
    const [people, setPeople] = useState([]);
    const [extensions, setExtensions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');
    const [position, setPosition] = useState('');
    const [access, setAccess] = useState('');
    const [sort, setSort] = useState('name');
    const [selected, setSelected] = useState(null);
    const [tab, setTab] = useState('profile');
    const [extras, setExtras] = useState(EMPTY_EXTRAS);
    const [docBusyId, setDocBusyId] = useState(null);
    const [dossierError, setDossierError] = useState('');
    const [photoVersions, setPhotoVersions] = useState({});
    const docInputRef = useRef(null);
    const photoInputRef = useRef(null);
    const uploadSlotRef = useRef('other');
    const [photoAdjust, setPhotoAdjust] = useState(null);
    const [photoMissing, setPhotoMissing] = useState(false);
    const [pendingDelete, setPendingDelete] = useState(null);
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        void Promise.allSettled([
            getUsers(false),
            fetchInternalExtensions().catch(() => []),
        ]).then(([usersResult, extResult]) => {
            if (cancelled)
                return;
            if (usersResult.status === 'fulfilled') {
                setPeople(usersResult.value.filter((user) => !user.is_archived && !user.is_blocked));
                setError('');
            }
            else {
                setError(usersResult.reason instanceof Error
                    ? usersResult.reason.message
                    : 'Не удалось загрузить сотрудников');
            }
            if (extResult.status === 'fulfilled')
                setExtensions(extResult.value);
            void listPersonnelPhotoIndex().then((items) => {
                if (cancelled)
                    return;
                const next = {};
                for (const item of items)
                    next[item.userId] = item.updatedAt;
                setPhotoVersions(next);
            }).catch(() => undefined);
        }).finally(() => {
            if (!cancelled)
                setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, []);
    useEffect(() => {
        if (!selected)
            return undefined;
        const onKey = (event) => {
            if (event.key !== 'Escape' || photoAdjust)
                return;
            if (pendingDelete) {
                setPendingDelete(null);
                return;
            }
            setSelected(null);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [pendingDelete, photoAdjust, selected]);
    useEffect(() => {
        if (!selected) {
            setExtras(EMPTY_EXTRAS);
            setTab('profile');
            return undefined;
        }
        let cancelled = false;
        const userId = selected.id;
        setDossierError('');
        setPhotoMissing(false);
        setPendingDelete(null);
        setExtras({ ...EMPTY_EXTRAS, loading: true, extension: matchExtension(selected, extensions)?.extension ?? null });
        void (async () => {
            try {
                const [equipPage, leaveAll, schedule, personnelFiles] = await Promise.all([
                    getItems({ assigned_to_user_id: userId, limit: 100 }).catch(() => ({ items: [] })),
                    listVacationLeaveRequests({ scope: 'all', status: 'any' }).catch(() => []),
                    listVacationScheduleEmployees(year).catch(() => []),
                    listPersonnelFiles(userId).catch(() => []),
                ]);
                if (cancelled)
                    return;
                const scheduleEmployee = schedule.find((row) => row.auth_user_id === userId) ?? null;
                const leaveRequests = leaveAll.filter((row) => row.employee_user_id === userId);
                let absences = [];
                let manualEntries = [];
                if (scheduleEmployee) {
                    const [abs, manuals] = await Promise.all([
                        listVacationAbsenceDays(year, { employeeId: scheduleEmployee.id }).catch(() => []),
                        listVacationManualEntries({ year, employeeId: scheduleEmployee.id }).catch(() => []),
                    ]);
                    if (cancelled)
                        return;
                    absences = abs;
                    manualEntries = manuals;
                }
                setExtras({
                    loading: false,
                    extension: matchExtension(selected, extensions)?.extension ?? null,
                    equipment: equipPage.items ?? [],
                    leaveRequests,
                    absences,
                    manualEntries,
                    personnelFiles,
                    scheduleEmployee,
                    error: '',
                });
            }
            catch (e) {
                if (cancelled)
                    return;
                setExtras({
                    ...EMPTY_EXTRAS,
                    loading: false,
                    extension: matchExtension(selected, extensions)?.extension ?? null,
                    error: e instanceof Error ? e.message : 'Не удалось загрузить карточку сотрудника',
                });
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [selected, extensions, year]);
    const positions = useMemo(() => {
        const names = new Set(people.map((user) => user.position?.trim()).filter((name) => Boolean(name)));
        return [...names].sort((a, b) => a.localeCompare(b, 'ru'));
    }, [people]);
    const accessRoles = useMemo(() => {
        const names = new Set(people.map((user) => user.role?.trim()).filter((name) => Boolean(name)));
        return [...names].sort((a, b) => a.localeCompare(b, 'ru'));
    }, [people]);
    const shown = useMemo(() => {
        const q = query.trim().toLowerCase();
        const filtered = people.filter((user) => {
            if (position && (user.position || '').trim() !== position)
                return false;
            if (access && user.role !== access)
                return false;
            if (!q)
                return true;
            return [personName(user), user.email, user.position, user.role]
                .some((part) => String(part ?? '').toLowerCase().includes(q));
        });
        const sorted = [...filtered];
        sorted.sort((a, b) => {
            if (sort === 'newest')
                return String(b.created_at).localeCompare(String(a.created_at));
            if (sort === 'position')
                return (a.position || '').localeCompare(b.position || '', 'ru') || personName(a).localeCompare(personName(b), 'ru');
            return personName(a).localeCompare(personName(b), 'ru');
        });
        return sorted;
    }, [people, query, position, access, sort]);
    const stats = useMemo(() => {
        const withPhoto = people.filter((u) => Boolean(photoVersions[u.id] || u.picture?.trim())).length;
        const partners = people.filter((u) => roleTone(u.role) === 'partner').length;
        return {
            total: people.length,
            withPhoto,
            partners,
            positions: positions.length,
        };
    }, [people, photoVersions, positions.length]);
    const openPdf = async (requestId) => {
        setDocBusyId(`leave-${requestId}`);
        try {
            const blob = await fetchVacationLeaveRequestPdfBlob(requestId);
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank', 'noopener,noreferrer');
            window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
        }
        catch {
            /* ignore open failures */
        }
        finally {
            setDocBusyId(null);
        }
    };
    const openManualDoc = async (entryId, docId) => {
        setDocBusyId(`manual-${entryId}-${docId}`);
        try {
            const blob = await fetchVacationManualEntryDocumentBlob(entryId, docId);
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank', 'noopener,noreferrer');
            window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
        }
        catch {
            /* ignore */
        }
        finally {
            setDocBusyId(null);
        }
    };
    const rememberPhoto = (file) => {
        if (!file.isPrimary || !file.createdAt)
            return;
        setPhotoVersions((prev) => ({ ...prev, [file.userId]: file.createdAt }));
        setExtras((prev) => ({
            ...prev,
            personnelFiles: prev.personnelFiles.map((item) => (item.userId === file.userId ? { ...item, isPrimary: item.id === file.id } : item)),
        }));
    };
    const uploadDossierFiles = async (slot, files) => {
        if (!selected || files.length === 0)
            return;
        setDocBusyId(`upload-${slot}`);
        setDossierError('');
        try {
            const created = [];
            for (const file of files)
                created.push(await uploadPersonnelFile(selected.id, slot, file));
            setExtras((prev) => ({ ...prev, personnelFiles: [...created, ...prev.personnelFiles] }));
        }
        catch (e) {
            setDossierError(e instanceof Error ? e.message : 'Не удалось загрузить файл');
        }
        finally {
            setDocBusyId(null);
        }
    };
    const closePhotoAdjust = () => {
        setPhotoAdjust((prev) => {
            if (prev)
                URL.revokeObjectURL(prev.url);
            return null;
        });
    };
    const openPhotoAdjust = (file) => {
        const url = URL.createObjectURL(file);
        setPhotoAdjust((prev) => {
            if (prev)
                URL.revokeObjectURL(prev.url);
            return { url };
        });
    };
    const uploadMainPhoto = async (file) => {
        if (!selected)
            return false;
        setDocBusyId('upload-photo');
        setDossierError('');
        try {
            const created = await uploadPersonnelPhoto(selected.id, file);
            setExtras((prev) => ({
                ...prev,
                personnelFiles: [
                    created,
                    ...prev.personnelFiles.filter((item) => item.slot !== 'photo'),
                ],
            }));
            rememberPhoto(created);
            return true;
        }
        catch (e) {
            setDossierError(e instanceof Error ? e.message : 'Не удалось загрузить фото');
            return false;
        }
        finally {
            setDocBusyId(null);
        }
    };
    const openPersonnelDoc = async (file) => {
        setDocBusyId(`file-${file.id}`);
        try {
            const blob = await fetchPersonnelFileBlob(file.userId, file.id);
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank', 'noopener,noreferrer');
            window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
        }
        catch (e) {
            setDossierError(e instanceof Error ? e.message : 'Не удалось открыть файл');
        }
        finally {
            setDocBusyId(null);
        }
    };
    const removePersonnelDoc = async (file) => {
        setDocBusyId(`file-${file.id}`);
        setDossierError('');
        try {
            await deletePersonnelFile(file.userId, file.id);
            setExtras((prev) => ({
                ...prev,
                personnelFiles: prev.personnelFiles.filter((item) => item.id !== file.id),
            }));
            if (file.isPrimary)
                setPhotoVersions((prev) => {
                    const next = { ...prev };
                    delete next[file.userId];
                    return next;
                });
            return true;
        }
        catch (e) {
            setDossierError(e instanceof Error ? e.message : 'Не удалось удалить файл');
            return false;
        }
        finally {
            setDocBusyId(null);
        }
    };
    const makePrimaryPhoto = async (file) => {
        setDocBusyId(`primary-${file.id}`);
        setDossierError('');
        try {
            const blob = await fetchPersonnelFileBlob(file.userId, file.id);
            openPhotoAdjust(new File([blob], file.filename || 'photo.jpg', { type: blob.type || 'image/jpeg' }));
        }
        catch (e) {
            setDossierError(e instanceof Error ? e.message : 'Не удалось открыть фото');
        }
        finally {
            setDocBusyId(null);
        }
    };
    const docCount = extras.leaveRequests.length
        + extras.personnelFiles.filter((file) => file.slot !== 'photo').length
        + extras.manualEntries.reduce((sum, entry) => sum + (entry.documents?.length ?? 0), 0);
    return (_jsxs("section", { className: "acct-hr", "aria-label": "HR", children: [_jsxs("header", { className: "acct-hr__intro", children: [_jsxs("div", { children: [_jsx("p", { className: "acct-hr__eyebrow", children: "\u041A\u0430\u0434\u0440\u043E\u0432\u044B\u0439 \u0441\u0435\u0440\u0432\u0438\u0441" }), _jsx("h2", { className: "acct-hr__title", children: "\u041A\u043E\u043C\u0430\u043D\u0434\u0430 Kosta Legal" }), _jsx("p", { className: "acct-hr__lead", children: "\u041A\u0430\u0440\u0442\u043E\u0447\u043A\u0438 \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u043E\u0432 \u0441 \u0444\u043E\u0442\u043E, \u043A\u043E\u043D\u0442\u0430\u043A\u0442\u0430\u043C\u0438, \u043A\u0430\u0434\u0440\u043E\u0432\u044B\u043C\u0438 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430\u043C\u0438, \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u0435\u043C \u0438 \u043E\u0442\u043F\u0443\u0441\u043A\u0430\u043C\u0438." })] }), _jsx(NavLink, { to: routes.vacationSchedule, className: "acct-hr__ext-link", children: "\u0413\u0440\u0430\u0444\u0438\u043A \u043E\u0442\u043F\u0443\u0441\u043A\u043E\u0432 \u2192" })] }), _jsxs("div", { className: "acct-hr__kpis", "aria-label": "\u0421\u0432\u043E\u0434\u043A\u0430 \u043F\u043E \u043A\u043E\u043C\u0430\u043D\u0434\u0435", children: [_jsxs("article", { className: "acct-hr__kpi", children: [_jsx("span", { className: "acct-hr__kpi-value", children: stats.total }), _jsx("span", { className: "acct-hr__kpi-label", children: "\u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u043E\u0432" })] }), _jsxs("article", { className: "acct-hr__kpi", children: [_jsx("span", { className: "acct-hr__kpi-value", children: stats.withPhoto }), _jsx("span", { className: "acct-hr__kpi-label", children: "\u0441 \u0444\u043E\u0442\u043E" })] }), _jsxs("article", { className: "acct-hr__kpi", children: [_jsx("span", { className: "acct-hr__kpi-value", children: stats.partners }), _jsx("span", { className: "acct-hr__kpi-label", children: "\u043F\u0430\u0440\u0442\u043D\u0451\u0440\u043E\u0432" })] }), _jsxs("article", { className: "acct-hr__kpi", children: [_jsx("span", { className: "acct-hr__kpi-value", children: stats.positions }), _jsx("span", { className: "acct-hr__kpi-label", children: "\u0434\u043E\u043B\u0436\u043D\u043E\u0441\u0442\u0435\u0439" })] })] }), _jsxs("div", { className: "acct-hr__toolbar", children: [_jsx("input", { type: "search", className: "acct-hr__search", placeholder: "\u041F\u043E\u0438\u0441\u043A: \u0438\u043C\u044F, \u043F\u043E\u0447\u0442\u0430, \u0434\u043E\u043B\u0436\u043D\u043E\u0441\u0442\u044C\u2026", "aria-label": "\u041F\u043E\u0438\u0441\u043A \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u0430", value: query, onChange: (e) => setQuery(e.target.value) }), _jsxs("label", { className: "acct-hr__field", children: [_jsx("span", { className: "acct-hr__field-label", children: "\u0414\u043E\u043B\u0436\u043D\u043E\u0441\u0442\u044C" }), _jsxs("select", { className: "acct-hr__select", value: position, onChange: (e) => setPosition(e.target.value), "aria-label": "\u0424\u0438\u043B\u044C\u0442\u0440 \u043F\u043E \u0434\u043E\u043B\u0436\u043D\u043E\u0441\u0442\u0438", children: [_jsx("option", { value: "", children: "\u0412\u0441\u0435" }), positions.map((name) => _jsx("option", { value: name, children: name }, name))] })] }), _jsxs("label", { className: "acct-hr__field", children: [_jsx("span", { className: "acct-hr__field-label", children: "\u0414\u043E\u0441\u0442\u0443\u043F" }), _jsxs("select", { className: "acct-hr__select", value: access, onChange: (e) => setAccess(e.target.value), "aria-label": "\u0424\u0438\u043B\u044C\u0442\u0440 \u043F\u043E \u0434\u043E\u0441\u0442\u0443\u043F\u0443", children: [_jsx("option", { value: "", children: "\u0412\u0441\u0435" }), accessRoles.map((name) => _jsx("option", { value: name, children: name }, name))] })] }), _jsxs("label", { className: "acct-hr__field", children: [_jsx("span", { className: "acct-hr__field-label", children: "\u0421\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u043A\u0430" }), _jsxs("select", { className: "acct-hr__select", value: sort, onChange: (e) => setSort(e.target.value), "aria-label": "\u0421\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u043A\u0430", children: [_jsx("option", { value: "name", children: "\u041F\u043E \u0438\u043C\u0435\u043D\u0438" }), _jsx("option", { value: "position", children: "\u041F\u043E \u0434\u043E\u043B\u0436\u043D\u043E\u0441\u0442\u0438" }), _jsx("option", { value: "newest", children: "\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u043D\u043E\u0432\u044B\u0435" })] })] }), _jsxs("span", { className: "acct-hr__count", children: [shown.length, " \u0438\u0437 ", people.length] })] }), error ? _jsx("p", { className: "acct-hr__error", role: "alert", children: error }) : null, loading ? (_jsx("div", { className: "acct-hr__grid", "aria-busy": "true", "aria-label": "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u043E\u0432", children: Array.from({ length: 8 }, (_, i) => _jsx("div", { className: "acct-hr__skel-card" }, i)) })) : null, !loading && !error && shown.length === 0 ? (_jsx("p", { className: "acct-hr__empty", children: people.length === 0 ? 'В каталоге нет действующих сотрудников.' : 'Никого не нашлось по этому запросу.' })) : null, !loading && shown.length > 0 && (_jsx("ul", { className: "acct-hr__grid", role: "list", children: shown.map((user) => {
                    const tone = roleTone(user.role);
                    return (_jsx("li", { children: _jsxs("button", { type: "button", className: "acct-hr__card", onClick: () => setSelected(user), children: [_jsx(PersonPhoto, { user: user, size: "card", photoVersion: photoVersions[user.id] }), _jsxs("span", { className: "acct-hr__card-body", children: [_jsx("span", { className: "acct-hr__card-name", children: personName(user) }), _jsx("span", { className: "acct-hr__card-position", children: user.position || 'Должность не указана' }), _jsx("span", { className: "acct-hr__card-email", children: user.email }), _jsx("span", { className: `acct-hr__badge acct-hr__badge--${tone}`, children: user.role || 'Сотрудник' })] }), _jsx("span", { className: "acct-hr__card-cta", children: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043F\u0440\u043E\u0444\u0438\u043B\u044C \u2192" })] }) }, user.id));
                }) })), pendingDelete ? createPortal(_jsxs("div", { className: "acct-hr acct-hr-confirm", role: "presentation", children: [_jsx("button", { type: "button", className: "acct-hr-confirm__backdrop", "aria-label": "\u0417\u0430\u043A\u0440\u044B\u0442\u044C \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u0435", disabled: docBusyId === `file-${pendingDelete.id}`, onClick: () => setPendingDelete(null) }), _jsxs("div", { className: "acct-hr-confirm__dialog", role: "dialog", "aria-modal": "true", "aria-labelledby": "acct-hr-delete-title", children: [_jsx("h2", { id: "acct-hr-delete-title", className: "acct-hr-confirm__title", children: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442?" }), _jsxs("p", { className: "acct-hr-confirm__text", children: ["\u0424\u0430\u0439\u043B \u00AB", pendingDelete.filename, "\u00BB \u0431\u0443\u0434\u0435\u0442 \u0443\u0434\u0430\u043B\u0451\u043D \u0438\u0437 \u043B\u0438\u0447\u043D\u043E\u0433\u043E \u0434\u0435\u043B\u0430. \u0412\u0435\u0440\u043D\u0443\u0442\u044C \u0435\u0433\u043E \u043D\u0435\u043B\u044C\u0437\u044F."] }), dossierError ? _jsx("p", { className: "acct-hr__error", role: "alert", children: dossierError }) : null, _jsxs("div", { className: "acct-hr-confirm__actions", children: [_jsx("button", { type: "button", className: "acct-hr__doc-btn", disabled: docBusyId === `file-${pendingDelete.id}`, onClick: () => setPendingDelete(null), children: "\u041E\u0442\u043C\u0435\u043D\u0430" }), _jsx("button", { type: "button", className: "acct-hr__doc-btn acct-hr__doc-btn--danger-solid", disabled: docBusyId === `file-${pendingDelete.id}`, onClick: () => {
                                            const file = pendingDelete;
                                            void removePersonnelDoc(file).then((ok) => {
                                                if (ok)
                                                    setPendingDelete(null);
                                            });
                                        }, children: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C" })] })] })] }), document.body) : null, photoAdjust ? (_jsx(HrPhotoCropDialog, { src: photoAdjust.url, busy: docBusyId === 'upload-photo', onCancel: closePhotoAdjust, onSave: (file) => {
                    void uploadMainPhoto(file).then((ok) => {
                        if (ok)
                            closePhotoAdjust();
                    });
                } })) : null, selected && (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", className: "acct-hr__backdrop", "aria-label": "\u0417\u0430\u043A\u0440\u044B\u0442\u044C \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0443", onClick: () => setSelected(null) }), _jsxs("aside", { className: "acct-hr__drawer", role: "dialog", "aria-modal": "true", "aria-labelledby": "acct-hr-drawer-title", children: [_jsx("input", { ref: docInputRef, type: "file", hidden: true, multiple: true, accept: ".pdf,.jpg,.jpeg,.png,.webp,.gif,.heic,.doc,.docx,.xls,.xlsx,.txt", onChange: (event) => {
                                    const files = [...(event.target.files ?? [])];
                                    event.target.value = '';
                                    void uploadDossierFiles(uploadSlotRef.current, files);
                                } }), _jsx("input", { ref: photoInputRef, type: "file", hidden: true, accept: "image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif", onChange: (event) => {
                                    const file = event.target.files?.[0];
                                    event.target.value = '';
                                    if (file)
                                        openPhotoAdjust(file);
                                } }), _jsxs("div", { className: "acct-hr__drawer-hero", children: [_jsxs("div", { className: "acct-hr__photo-wrap", children: [_jsx(PersonPhoto, { user: selected, size: "hero", photoVersion: photoVersions[selected.id], onMissing: setPhotoMissing }), _jsx("button", { type: "button", className: "acct-hr__photo-btn", disabled: docBusyId === 'upload-photo', onClick: () => photoInputRef.current?.click(), children: photoVersions[selected.id] ? 'Сменить фото' : 'Главное фото' }), photoMissing ? (_jsx("span", { className: "acct-hr__photo-missing", children: "\u0424\u0430\u0439\u043B \u0444\u043E\u0442\u043E \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D. \u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u0435 \u0441\u043D\u0438\u043C\u043E\u043A \u0435\u0449\u0451 \u0440\u0430\u0437." })) : null] }), _jsxs("div", { className: "acct-hr__drawer-hero-text", children: [_jsx("h2", { id: "acct-hr-drawer-title", className: "acct-hr__drawer-name", children: personName(selected) }), _jsx("p", { className: "acct-hr__drawer-position", children: selected.position || 'Должность не указана' }), _jsx("span", { className: `acct-hr__badge acct-hr__badge--${roleTone(selected.role)}`, children: selected.role || 'Сотрудник' })] }), _jsx("button", { type: "button", className: "acct-hr__drawer-close", onClick: () => setSelected(null), "aria-label": "\u0417\u0430\u043A\u0440\u044B\u0442\u044C", children: "\u00D7" })] }), _jsx("nav", { className: "acct-hr__tabs", "aria-label": "\u0420\u0430\u0437\u0434\u0435\u043B\u044B \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0438", children: [
                                    ['profile', 'Профиль'],
                                    ['documents', `Документы${docCount ? ` (${docCount})` : ''}`],
                                    ['equipment', `Оборудование${extras.equipment.length ? ` (${extras.equipment.length})` : ''}`],
                                    ['leave', 'Отпуска'],
                                ].map(([id, label]) => (_jsx("button", { type: "button", className: `acct-hr__tab${tab === id ? ' acct-hr__tab--on' : ''}`, "aria-selected": tab === id, onClick: () => setTab(id), children: label }, id))) }), _jsxs("div", { className: "acct-hr__drawer-body", children: [dossierError ? _jsx("p", { className: "acct-hr__error", role: "alert", children: dossierError }) : null, extras.loading ? _jsx("p", { className: "acct-hr__muted", children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u0434\u0430\u043D\u043D\u044B\u0445 \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u0430\u2026" }) : null, extras.error ? _jsx("p", { className: "acct-hr__error", role: "alert", children: extras.error }) : null, !extras.loading && tab === 'profile' && (_jsxs("dl", { className: "acct-hr__facts", children: [_jsxs("div", { children: [_jsx("dt", { children: "\u041A\u043E\u0440\u043F\u043E\u0440\u0430\u0442\u0438\u0432\u043D\u0430\u044F \u043F\u043E\u0447\u0442\u0430" }), _jsx("dd", { children: _jsx("a", { href: `mailto:${selected.email}`, children: selected.email }) })] }), _jsxs("div", { children: [_jsx("dt", { children: "\u0412\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0438\u0439 \u043D\u043E\u043C\u0435\u0440" }), _jsx("dd", { children: extras.extension ? `доб. ${extras.extension}` : 'Не найден в справочнике АТС' })] }), _jsxs("div", { children: [_jsx("dt", { children: "\u0414\u043E\u043B\u0436\u043D\u043E\u0441\u0442\u044C" }), _jsx("dd", { children: selected.position || '—' })] }), _jsxs("div", { children: [_jsx("dt", { children: "\u0414\u043E\u0441\u0442\u0443\u043F \u043A \u0441\u0438\u0441\u0442\u0435\u043C\u0435" }), _jsx("dd", { children: selected.role || '—' })] }), _jsxs("div", { children: [_jsx("dt", { children: "\u0420\u043E\u043B\u044C \u0432 \u0443\u0447\u0451\u0442\u0435 \u0432\u0440\u0435\u043C\u0435\u043D\u0438" }), _jsx("dd", { children: selected.time_tracking_role === 'manager'
                                                            ? 'Менеджер'
                                                            : selected.time_tracking_role === 'user'
                                                                ? 'Сотрудник'
                                                                : '—' })] }), _jsxs("div", { children: [_jsx("dt", { children: "\u041D\u0435\u0434\u0435\u043B\u044C\u043D\u0430\u044F \u0451\u043C\u043A\u043E\u0441\u0442\u044C" }), _jsx("dd", { children: selected.weekly_capacity_hours != null && Number.isFinite(Number(selected.weekly_capacity_hours))
                                                            ? `${selected.weekly_capacity_hours} ч`
                                                            : '—' })] }), _jsxs("div", { children: [_jsx("dt", { children: "\u0412 \u0441\u0438\u0441\u0442\u0435\u043C\u0435 \u0441" }), _jsx("dd", { children: formatDate(selected.created_at) })] }), _jsxs("div", { children: [_jsx("dt", { children: "\u041E\u0431\u043D\u043E\u0432\u043B\u0451\u043D" }), _jsx("dd", { children: formatDate(selected.updated_at) })] })] })), !extras.loading && tab === 'documents' && (_jsxs("div", { className: "acct-hr__docs", children: [_jsx("p", { className: "acct-hr__muted", children: "\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u0435 \u0444\u0430\u0439\u043B\u044B \u043B\u0438\u0447\u043D\u043E\u0433\u043E \u0434\u0435\u043B\u0430 \u043F\u043E \u0440\u0430\u0437\u0434\u0435\u043B\u0430\u043C. \u0418\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435 \u043C\u043E\u0436\u043D\u043E \u0441\u0434\u0435\u043B\u0430\u0442\u044C \u0433\u043B\u0430\u0432\u043D\u044B\u043C \u0444\u043E\u0442\u043E \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0438." }), _jsx("h3", { className: "acct-hr__block-title", children: "\u041A\u0430\u0434\u0440\u043E\u0432\u043E\u0435 \u0434\u043E\u0441\u044C\u0435" }), _jsx("ul", { className: "acct-hr__doc-slots", children: DOSSIER_SLOTS.map((slot) => {
                                                    const files = extras.personnelFiles.filter((file) => file.slot === slot.id);
                                                    return (_jsxs("li", { className: "acct-hr__doc-slot", children: [_jsxs("div", { className: "acct-hr__doc-slot-head", children: [_jsxs("div", { children: [_jsx("strong", { children: slot.title }), _jsx("span", { children: slot.hint })] }), _jsx("button", { type: "button", className: "acct-hr__doc-btn", disabled: docBusyId === `upload-${slot.id}`, onClick: () => {
                                                                            uploadSlotRef.current = slot.id;
                                                                            docInputRef.current?.click();
                                                                        }, children: "\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C" })] }), files.length === 0 ? _jsx("em", { children: "\u041D\u0435\u0442 \u0444\u0430\u0439\u043B\u0430" }) : (_jsx("ul", { className: "acct-hr__file-list", children: files.map((file) => (_jsxs("li", { className: "acct-hr__file", children: [_jsxs("p", { className: "acct-hr__file-name", title: file.filename, children: [_jsx("span", { className: "acct-hr__file-text", children: file.filename }), file.isPrimary ? _jsx("span", { className: "acct-hr__file-badge", children: "\u0413\u043B\u0430\u0432\u043D\u043E\u0435 \u0444\u043E\u0442\u043E" }) : null] }), _jsxs("div", { className: "acct-hr__file-actions", children: [_jsx("button", { type: "button", className: "acct-hr__doc-btn", disabled: docBusyId === `file-${file.id}`, onClick: () => void openPersonnelDoc(file), children: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C" }), isPersonnelImage(file) && !file.isPrimary ? (_jsx("button", { type: "button", className: "acct-hr__doc-btn", disabled: docBusyId === `primary-${file.id}`, onClick: () => void makePrimaryPhoto(file), children: "\u041D\u0430 \u0444\u043E\u0442\u043E" })) : null, _jsx("button", { type: "button", className: "acct-hr__doc-btn acct-hr__doc-btn--danger", disabled: docBusyId === `file-${file.id}`, onClick: () => {
                                                                                        setDossierError('');
                                                                                        setPendingDelete(file);
                                                                                    }, children: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C" })] })] }, file.id))) }))] }, slot.id));
                                                }) }), _jsx("h3", { className: "acct-hr__block-title", children: "\u0417\u0430\u044F\u0432\u043B\u0435\u043D\u0438\u044F \u043D\u0430 \u043E\u0442\u043F\u0443\u0441\u043A" }), extras.leaveRequests.length === 0 ? (_jsx("p", { className: "acct-hr__muted", children: "\u0417\u0430\u044F\u0432\u043E\u043A \u043F\u043E\u043A\u0430 \u043D\u0435\u0442." })) : (_jsx("ul", { className: "acct-hr__doc-list", children: extras.leaveRequests.map((req) => (_jsxs("li", { className: "acct-hr__doc-row", children: [_jsxs("div", { children: [_jsxs("strong", { children: [absenceKindLabel(req.kind), " \u00B7 ", req.days_count, " ", ruDaysWord(req.days_count)] }), _jsxs("span", { children: [formatRuRange(req.date_from, req.date_to), " \u00B7 ", isLeaveStatus(req.status) ? leaveStatusLabel(req.status, req) : req.status] })] }), _jsx("button", { type: "button", className: "acct-hr__doc-btn", disabled: docBusyId === `leave-${req.id}`, onClick: () => void openPdf(req.id), children: "PDF" })] }, req.id))) })), _jsx("h3", { className: "acct-hr__block-title", children: "\u0414\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u044B \u043E\u0441\u043D\u043E\u0432\u0430\u043D\u0438\u0439 (\u0440\u0443\u0447\u043D\u044B\u0435 \u0437\u0430\u043F\u0438\u0441\u0438)" }), extras.manualEntries.every((e) => !(e.documents?.length)) ? (_jsx("p", { className: "acct-hr__muted", children: "\u041F\u0440\u0438\u043A\u0440\u0435\u043F\u043B\u0451\u043D\u043D\u044B\u0445 \u0444\u0430\u0439\u043B\u043E\u0432 \u043D\u0435\u0442." })) : (_jsx("ul", { className: "acct-hr__doc-list", children: extras.manualEntries.flatMap((entry) => (entry.documents ?? []).map((doc) => (_jsxs("li", { className: "acct-hr__doc-row", children: [_jsxs("div", { children: [_jsx("strong", { children: doc.original_filename || `Документ #${doc.id}` }), _jsxs("span", { children: ["\u0417\u0430\u043F\u0438\u0441\u044C #", entry.id] })] }), _jsx("button", { type: "button", className: "acct-hr__doc-btn", disabled: docBusyId === `manual-${entry.id}-${doc.id}`, onClick: () => void openManualDoc(entry.id, doc.id), children: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C" })] }, `${entry.id}-${doc.id}`)))) }))] })), !extras.loading && tab === 'equipment' && (extras.equipment.length === 0 ? (_jsx("p", { className: "acct-hr__muted", children: "\u0417\u0430 \u044D\u0442\u0438\u043C \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u043E\u043C \u043D\u0435\u0442 \u0437\u0430\u043A\u0440\u0435\u043F\u043B\u0451\u043D\u043D\u043E\u0433\u043E \u043E\u0431\u043E\u0440\u0443\u0434\u043E\u0432\u0430\u043D\u0438\u044F." })) : (_jsx("ul", { className: "acct-hr__equip-list", children: extras.equipment.map((item) => {
                                            const serial = item.serial_number?.trim() ?? '';
                                            const sameAsInventory = serial.toLowerCase() === item.inventory_number.trim().toLowerCase();
                                            return (_jsxs("li", { className: "acct-hr__equip", children: [_jsxs("div", { className: "acct-hr__equip-main", children: [_jsx("strong", { children: item.name }), _jsxs("span", { className: "acct-hr__equip-meta", children: [item.inventory_number, serial && !sameAsInventory ? ` · S/N ${serial}` : ''] })] }), _jsx("span", { className: `acct-hr__equip-status acct-hr__equip-status--${item.status}`, children: equipmentStatusLabel(item.status) })] }, item.id));
                                        }) }))), !extras.loading && tab === 'leave' && (_jsxs("div", { className: "acct-hr__leave", children: [!extras.scheduleEmployee ? (_jsxs("p", { className: "acct-hr__muted", children: ["\u0421\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D \u0432 \u0433\u0440\u0430\u0444\u0438\u043A\u0435 \u043E\u0442\u043F\u0443\u0441\u043A\u043E\u0432 ", year, ". \u0414\u043E\u0431\u0430\u0432\u044C\u0442\u0435 \u0435\u0433\u043E \u0432 \u0440\u0430\u0437\u0434\u0435\u043B\u0435 \u00AB\u0413\u0440\u0430\u0444\u0438\u043A \u043E\u0442\u043F\u0443\u0441\u043A\u043E\u0432\u00BB."] })) : (_jsxs(_Fragment, { children: [_jsxs("p", { className: "acct-hr__muted", children: ["\u0413\u0440\u0430\u0444\u0438\u043A ", year, extras.scheduleEmployee.planned_period_note
                                                                ? ` · ${extras.scheduleEmployee.planned_period_note}`
                                                                : ''] }), extras.absences.length === 0 ? (_jsx("p", { className: "acct-hr__muted", children: "\u041E\u0442\u043C\u0435\u0447\u0435\u043D\u043D\u044B\u0445 \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0438\u0439 \u0437\u0430 \u0433\u043E\u0434 \u043F\u043E\u043A\u0430 \u043D\u0435\u0442." })) : (_jsx("ul", { className: "acct-hr__leave-list", children: groupAbsenceDays(extras.absences).map((span) => (_jsxs("li", { className: "acct-hr__leave-card", children: [_jsxs("div", { className: "acct-hr__leave-card-main", children: [_jsx("strong", { children: span.from === span.to
                                                                                ? formatRuDateLong(span.from)
                                                                                : formatRuRange(span.from, span.to) }), _jsxs("span", { className: "acct-hr__leave-card-meta", children: [span.days, " ", ruDaysWord(span.days)] })] }), _jsx("span", { className: `acct-hr__leave-kind acct-hr__leave-kind--${span.kind}`, children: absenceKindLabel(span.kind) })] }, span.key))) }))] })), _jsx(NavLink, { to: routes.vacationSchedule, className: "acct-hr__ext-link acct-hr__ext-link--inline", children: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0433\u0440\u0430\u0444\u0438\u043A \u043E\u0442\u043F\u0443\u0441\u043A\u043E\u0432 \u2192" })] }))] })] })] }))] }));
}
