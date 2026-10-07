import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useMemo, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import './TimesheetPage.css';
function startOfWeek(d) {
    const day = new Date(d);
    const dow = day.getDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    day.setDate(day.getDate() + diff);
    day.setHours(0, 0, 0, 0);
    return day;
}
function addDays(d, n) {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
}
function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();
}
function fmtWeekDay(d) {
    return {
        short: d.toLocaleDateString('ru-RU', { weekday: 'short' }).replace('.', ''),
        num: d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }).replace('.', ''),
    };
}
function fmtHours(h) {
    if (h === 0)
        return '0:00';
    const wh = Math.floor(h);
    const wm = Math.round((h - wh) * 60);
    return `${wh}:${String(wm).padStart(2, '0')}`;
}
function todayFull(d) {
    return d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })
        .replace(/^\w/, c => c.toUpperCase());
}
const QUOTES = [
    { text: '«Когда стрела времени пускается в полёт, нет силы, способной её остановить.»', author: '— Томас Манн' },
    { text: '«Либо ты управляешь временем, либо время управляет тобой.»', author: '— Джим Рон' },
    { text: '«Час работы обучает больше, чем день объяснений.»', author: '— Жан-Жак Руссо' },
    { text: '«Не откладывай на завтра то, что можно сделать послезавтра — если завтра занято.»', author: '— Марк Твен' },
];
const MOCK_ENTRIES = [
    { id: 'te1', date: formatDate(addDays(startOfWeek(new Date()), 0)), project: 'Дело №2024-118', client: 'ООО Альфа', task: 'Анализ документов', notes: 'Изучение материалов дела', hours: 2.5, billable: true, color: '#4f46e5' },
    { id: 'te2', date: formatDate(addDays(startOfWeek(new Date()), 0)), project: 'Контракт KL-42', client: 'ООО Бета', task: 'Совещания', notes: 'Встреча с клиентом', hours: 1.0, billable: true, color: '#7c3aed' },
    { id: 'te3', date: formatDate(addDays(startOfWeek(new Date()), 1)), project: 'Дело №2024-118', client: 'ООО Альфа', task: 'Составление', notes: 'Проект договора', hours: 3.25, billable: true, color: '#4f46e5' },
    { id: 'te4', date: formatDate(addDays(startOfWeek(new Date()), 2)), project: 'Контракт KL-42', client: 'ООО Бета', task: 'Исследование', notes: 'Правовой анализ', hours: 2.0, billable: true, color: '#7c3aed' },
    { id: 'te5', date: formatDate(addDays(startOfWeek(new Date()), 2)), project: 'Общие расходы', client: 'Внутренний', task: 'Административное', notes: '', hours: 0.5, billable: false, color: '#64748b' },
    { id: 'te6', date: formatDate(addDays(startOfWeek(new Date()), 3)), project: 'Дело №2024-98', client: 'ООО Альфа', task: 'Судебное заседание', notes: 'Предварительное слушание', hours: 4.0, billable: true, color: '#0891b2' },
];
function formatDate(d) {
    return d.toISOString().slice(0, 10);
}
const FORM_PROJECTS = [
    { id: 'p1', name: 'Дело №2024-118', client: 'ООО Альфа', color: '#4f46e5' },
    { id: 'p2', name: 'Дело №2024-98', client: 'ООО Альфа', color: '#0891b2' },
    { id: 'p3', name: 'Контракт KL-42', client: 'ООО Бета', color: '#7c3aed' },
    { id: 'p4', name: 'Общие расходы', client: 'Внутренний', color: '#64748b' },
];
const FORM_TASKS = ['Анализ документов', 'Составление', 'Совещания', 'Исследование', 'Судебное заседание', 'Телефонные звонки', 'Электронная переписка', 'Административное'];
function AddEntryModal({ defaultDate, onClose, onSave }) {
    const uid = useId();
    const [form, setForm] = useState({
        projectId: FORM_PROJECTS[0].id,
        task: FORM_TASKS[0],
        date: defaultDate,
        hours: '',
        notes: '',
        billable: true,
    });
    const [error, setError] = useState(null);
    useEffect(() => {
        const h = (e) => {
            if (e.key === 'Escape')
                onClose();
        };
        document.addEventListener('keydown', h);
        document.body.style.overflow = 'hidden';
        return () => { document.removeEventListener('keydown', h); document.body.style.overflow = ''; };
    }, [onClose]);
    const proj = FORM_PROJECTS.find(p => p.id === form.projectId) ?? FORM_PROJECTS[0];
    function handleSave() {
        const h = parseFloat(form.hours.replace(',', '.'));
        if (!form.hours || isNaN(h) || h <= 0) {
            setError('Введите корректное количество часов');
            return;
        }
        onSave({
            id: `te_${Date.now()}`,
            date: form.date,
            project: proj.name,
            client: proj.client,
            task: form.task,
            notes: form.notes,
            hours: h,
            billable: form.billable,
            color: proj.color,
        });
        onClose();
    }
    return createPortal(_jsx("div", { className: "ts__modal-overlay", children: _jsxs("div", { className: "ts__modal", onClick: e => e.stopPropagation(), children: [_jsxs("div", { className: "ts__modal-head", children: [_jsx("h3", { className: "ts__modal-title", children: "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0432\u0440\u0435\u043C\u044F" }), _jsx("button", { className: "ts__modal-close", onClick: onClose, "aria-label": "\u0417\u0430\u043A\u0440\u044B\u0442\u044C", children: _jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsx("path", { d: "M18 6L6 18M6 6l12 12" }) }) })] }), _jsxs("div", { className: "ts__modal-body", children: [_jsxs("div", { className: "ts__mfield", children: [_jsx("label", { className: "ts__mlabel", htmlFor: `${uid}-proj`, children: "\u041F\u0440\u043E\u0435\u043A\u0442" }), _jsx("select", { id: `${uid}-proj`, className: "ts__mselect", value: form.projectId, onChange: e => setForm(f => ({ ...f, projectId: e.target.value })), children: FORM_PROJECTS.map(p => (_jsxs("option", { value: p.id, children: [p.name, " \u2014 ", p.client] }, p.id))) })] }), _jsxs("div", { className: "ts__mfield", children: [_jsx("label", { className: "ts__mlabel", htmlFor: `${uid}-task`, children: "\u0417\u0430\u0434\u0430\u0447\u0430" }), _jsx("select", { id: `${uid}-task`, className: "ts__mselect", value: form.task, onChange: e => setForm(f => ({ ...f, task: e.target.value })), children: FORM_TASKS.map(t => _jsx("option", { children: t }, t)) })] }), _jsxs("div", { className: "ts__mrow", children: [_jsxs("div", { className: "ts__mfield", children: [_jsx("label", { className: "ts__mlabel", htmlFor: `${uid}-date`, children: "\u0414\u0430\u0442\u0430" }), _jsx("input", { id: `${uid}-date`, type: "date", className: "ts__minput", value: form.date, onChange: e => setForm(f => ({ ...f, date: e.target.value })) })] }), _jsxs("div", { className: "ts__mfield", children: [_jsx("label", { className: "ts__mlabel", htmlFor: `${uid}-hours`, children: "\u0427\u0430\u0441\u043E\u0432" }), _jsx("input", { id: `${uid}-hours`, type: "text", className: "ts__minput", placeholder: "0.00", value: form.hours, onChange: e => setForm(f => ({ ...f, hours: e.target.value })) })] })] }), _jsxs("div", { className: "ts__mfield", children: [_jsx("label", { className: "ts__mlabel", htmlFor: `${uid}-notes`, children: "\u041F\u0440\u0438\u043C\u0435\u0447\u0430\u043D\u0438\u0435" }), _jsx("input", { id: `${uid}-notes`, type: "text", className: "ts__minput", placeholder: "\u0427\u0442\u043E \u0434\u0435\u043B\u0430\u043B\u0438?", value: form.notes, onChange: e => setForm(f => ({ ...f, notes: e.target.value })) })] }), _jsxs("label", { className: "ts__mbillable", children: [_jsx("span", { className: "ts__toggle-track", "data-on": form.billable, onClick: () => setForm(f => ({ ...f, billable: !f.billable })), children: _jsx("span", { className: "ts__toggle-thumb" }) }), _jsx("span", { className: "ts__mbillable-label", children: "\u041E\u043F\u043B\u0430\u0447\u0438\u0432\u0430\u0435\u043C\u043E\u0435" })] }), error && _jsx("p", { className: "ts__merror", children: error })] }), _jsxs("div", { className: "ts__modal-foot", children: [_jsx("button", { className: "ts__mbtn ts__mbtn--primary", onClick: handleSave, children: "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C" }), _jsx("button", { className: "ts__mbtn ts__mbtn--ghost", onClick: onClose, children: "\u041E\u0442\u043C\u0435\u043D\u0430" })] })] }) }), document.body);
}
export function TimesheetPage() {
    const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
    const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
    const [viewMode, setViewMode] = useState('week');
    const [mainTab, setMainTab] = useState('timesheet');
    const [entries, setEntries] = useState(MOCK_ENTRIES);
    const [showModal, setShowModal] = useState(false);
    const [activeDay, setActiveDay] = useState(today);
    const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
    const hoursPerDay = useMemo(() => weekDays.map(d => {
        const key = formatDate(d);
        return entries.filter(e => e.date === key).reduce((s, e) => s + e.hours, 0);
    }), [weekDays, entries]);
    const weekTotal = hoursPerDay.reduce((s, h) => s + h, 0);
    const isCurrentWeek = isSameDay(weekStart, startOfWeek(today));
    const todayStr = isCurrentWeek
        ? `Сегодня: ${todayFull(today)}`
        : `Неделя: ${weekStart.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} — ${addDays(weekStart, 6).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`;
    function prevWeek() { setWeekStart(d => addDays(d, -7)); }
    function nextWeek() { setWeekStart(d => addDays(d, 7)); }
    function goToday() { setWeekStart(startOfWeek(today)); setActiveDay(today); }
    const displayDays = useMemo(() => (viewMode === 'week' ? weekDays : [activeDay]), [activeDay, viewMode, weekDays]);
    const randomQuote = useMemo(() => {
        void weekStart;
        return QUOTES[Math.floor(Math.random() * QUOTES.length)];
    }, [weekStart]);
    const addEntry = (e) => setEntries(prev => [...prev, e]);
    function deleteEntry(id) {
        setEntries(prev => prev.filter(e => e.id !== id));
    }
    const dayGroups = useMemo(() => {
        return displayDays.map(d => {
            const key = formatDate(d);
            const dayEntries = entries.filter(e => e.date === key);
            const projectMap = new Map();
            for (const e of dayEntries) {
                if (!projectMap.has(e.project))
                    projectMap.set(e.project, []);
                projectMap.get(e.project).push(e);
            }
            return { date: d, key, projects: Array.from(projectMap.entries()) };
        });
    }, [displayDays, entries]);
    const hasAnyEntries = dayGroups.some(g => g.projects.length > 0);
    return (_jsxs("div", { className: "ts", children: [_jsxs("div", { className: "ts__top-tabs", children: [_jsx("button", { className: `ts__top-tab${mainTab === 'timesheet' ? ' ts__top-tab--active' : ''}`, onClick: () => setMainTab('timesheet'), children: "\u0420\u0430\u0441\u043F\u0438\u0441\u0430\u043D\u0438\u0435" }), _jsxs("button", { className: `ts__top-tab${mainTab === 'approval' ? ' ts__top-tab--active' : ''}`, onClick: () => setMainTab('approval'), children: ["\u041D\u0430 \u0443\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u0435", _jsx("span", { className: "ts__top-tab-dot" })] })] }), _jsxs("div", { className: "ts__body", children: [_jsxs("div", { className: "ts__left", children: [_jsx("button", { className: "ts__track-btn", onClick: () => { setShowModal(true); }, children: _jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", children: [_jsx("line", { x1: "12", y1: "5", x2: "12", y2: "19" }), _jsx("line", { x1: "5", y1: "12", x2: "19", y2: "12" })] }) }), _jsx("span", { className: "ts__track-label", children: "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0432\u0440\u0435\u043C\u044F" })] }), _jsxs("div", { className: "ts__main", children: [_jsxs("div", { className: "ts__toolbar", children: [_jsxs("div", { className: "ts__toolbar-left", children: [_jsx("button", { className: "ts__nav-btn", onClick: prevWeek, "aria-label": "\u041F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0430\u044F \u043D\u0435\u0434\u0435\u043B\u044F", children: _jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", children: _jsx("path", { d: "M15 18l-6-6 6-6" }) }) }), _jsx("button", { className: "ts__nav-btn", onClick: nextWeek, "aria-label": "\u0421\u043B\u0435\u0434\u0443\u044E\u0449\u0430\u044F \u043D\u0435\u0434\u0435\u043B\u044F", children: _jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", children: _jsx("path", { d: "M9 18l6-6-6-6" }) }) }), _jsx("h1", { className: "ts__today-label", children: todayStr })] }), _jsxs("div", { className: "ts__toolbar-right", children: [_jsx("button", { className: "ts__cal-btn", onClick: goToday, title: "\u0421\u0435\u0433\u043E\u0434\u043D\u044F", children: _jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", children: [_jsx("rect", { x: "3", y: "4", width: "18", height: "18", rx: "2" }), _jsx("line", { x1: "16", y1: "2", x2: "16", y2: "6" }), _jsx("line", { x1: "8", y1: "2", x2: "8", y2: "6" }), _jsx("line", { x1: "3", y1: "10", x2: "21", y2: "10" })] }) }), _jsxs("div", { className: "ts__view-toggle", children: [_jsx("button", { className: `ts__view-btn${viewMode === 'day' ? ' ts__view-btn--active' : ''}`, onClick: () => setViewMode('day'), children: "\u0414\u0435\u043D\u044C" }), _jsx("button", { className: `ts__view-btn${viewMode === 'week' ? ' ts__view-btn--active' : ''}`, onClick: () => setViewMode('week'), children: "\u041D\u0435\u0434\u0435\u043B\u044F" })] })] })] }), _jsxs("div", { className: "ts__week-head", children: [weekDays.map((d, i) => {
                                        const fmt = fmtWeekDay(d);
                                        const isToday = isSameDay(d, today);
                                        const isActive = isSameDay(d, activeDay);
                                        const h = hoursPerDay[i];
                                        return (_jsxs("button", { className: `ts__day-col${isToday ? ' ts__day-col--today' : ''}${isActive && viewMode === 'day' ? ' ts__day-col--active' : ''}`, onClick: () => { setActiveDay(d); setViewMode('day'); }, children: [_jsx("span", { className: "ts__day-name", children: fmt.short }), _jsx("span", { className: "ts__day-num", children: d.getDate() }), _jsx("span", { className: `ts__day-hours${h > 0 ? ' ts__day-hours--filled' : ''}`, children: fmtHours(h) }), isToday && _jsx("span", { className: "ts__day-indicator" })] }, i));
                                    }), _jsxs("div", { className: "ts__week-total-col", children: [_jsx("span", { className: "ts__wt-label", children: "\u0418\u0442\u043E\u0433\u043E \u0437\u0430 \u043D\u0435\u0434\u0435\u043B\u044E" }), _jsx("span", { className: `ts__wt-val${weekTotal > 0 ? ' ts__wt-val--filled' : ''}`, children: fmtHours(weekTotal) })] })] }), _jsx("div", { className: "ts__content", children: !hasAnyEntries ? (_jsxs("div", { className: "ts__empty", children: [_jsx("p", { className: "ts__empty-quote", children: randomQuote.text }), _jsx("p", { className: "ts__empty-author", children: randomQuote.author })] })) : (_jsx("div", { className: "ts__days", children: dayGroups.filter(g => g.projects.length > 0).map(g => (_jsxs("div", { className: "ts__day-group", children: [viewMode === 'week' && (_jsxs("div", { className: "ts__day-group-head", children: [_jsx("span", { className: `ts__day-group-name${isSameDay(g.date, today) ? ' ts__day-group-name--today' : ''}`, children: g.date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^\w/, c => c.toUpperCase()) }), _jsx("span", { className: "ts__day-group-total", children: fmtHours(entries.filter(e => e.date === g.key).reduce((s, e) => s + e.hours, 0)) })] })), g.projects.map(([projName, projEntries]) => (_jsxs("div", { className: "ts__proj-group", children: [_jsxs("div", { className: "ts__proj-head", children: [_jsx("span", { className: "ts__proj-dot", style: { background: projEntries[0].color } }), _jsx("span", { className: "ts__proj-name", children: projName }), _jsx("span", { className: "ts__proj-client", children: projEntries[0].client }), _jsx("span", { className: "ts__proj-total", children: fmtHours(projEntries.reduce((s, e) => s + e.hours, 0)) })] }), projEntries.map(e => (_jsxs("div", { className: "ts__entry", children: [_jsxs("div", { className: "ts__entry-left", children: [_jsx("span", { className: "ts__entry-task", children: e.task }), e.notes && _jsx("span", { className: "ts__entry-notes", children: e.notes })] }), _jsxs("div", { className: "ts__entry-right", children: [_jsx("span", { className: `ts__entry-bill${e.billable ? ' ts__entry-bill--yes' : ' ts__entry-bill--no'}`, children: e.billable ? 'Опл.' : 'Неопл.' }), _jsx("span", { className: "ts__entry-hours", children: fmtHours(e.hours) }), _jsx("button", { className: "ts__entry-del", onClick: () => deleteEntry(e.id), "aria-label": "\u0423\u0434\u0430\u043B\u0438\u0442\u044C", title: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C", children: _jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", children: _jsx("path", { d: "M18 6L6 18M6 6l12 12" }) }) })] })] }, e.id)))] }, projName)))] }, g.key))) })) }), _jsx("div", { className: "ts__footer", children: _jsxs("div", { className: "ts__submit-wrap", children: [_jsx("button", { className: "ts__submit-btn", children: "\u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u043D\u0430 \u0443\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u0435" }), _jsx("button", { className: "ts__submit-arrow", children: _jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", children: _jsx("path", { d: "M6 9l6 6 6-6" }) }) })] }) })] })] }), showModal && (_jsx(AddEntryModal, { defaultDate: formatDate(viewMode === 'day' ? activeDay : today), onClose: () => setShowModal(false), onSave: addEntry }))] }));
}
