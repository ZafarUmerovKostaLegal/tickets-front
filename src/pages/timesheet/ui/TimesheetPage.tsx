import { useState, useMemo, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import './TimesheetPage.css';
function startOfWeek(d: Date): Date {
    const day = new Date(d);
    const dow = day.getDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    day.setDate(day.getDate() + diff);
    day.setHours(0, 0, 0, 0);
    return day;
}
function addDays(d: Date, n: number): Date {
    const r = new Date(d);
    r.setDate(r.getDate() + n);
    return r;
}
function isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();
}
function fmtWeekDay(d: Date): {
    short: string;
    num: string;
} {
    return {
        short: d.toLocaleDateString('ru-RU', { weekday: 'short' }).replace('.', ''),
        num: d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }).replace('.', ''),
    };
}
function fmtHours(h: number): string {
    if (h === 0)
        return '0:00';
    const wh = Math.floor(h);
    const wm = Math.round((h - wh) * 60);
    return `${wh}:${String(wm).padStart(2, '0')}`;
}
function todayFull(d: Date): string {
    return d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })
        .replace(/^\w/, c => c.toUpperCase());
}
const QUOTES = [
    { text: '«Когда стрела времени пускается в полёт, нет силы, способной её остановить.»', author: '— Томас Манн' },
    { text: '«Либо ты управляешь временем, либо время управляет тобой.»', author: '— Джим Рон' },
    { text: '«Час работы обучает больше, чем день объяснений.»', author: '— Жан-Жак Руссо' },
    { text: '«Не откладывай на завтра то, что можно сделать послезавтра — если завтра занято.»', author: '— Марк Твен' },
];
type TimeEntry = {
    id: string;
    date: string;
    project: string;
    client: string;
    task: string;
    notes: string;
    hours: number;
    billable: boolean;
    color: string;
};
const MOCK_ENTRIES: TimeEntry[] = [
    { id: 'te1', date: formatDate(addDays(startOfWeek(new Date()), 0)), project: 'Дело №2024-118', client: 'ООО Альфа', task: 'Анализ документов', notes: 'Изучение материалов дела', hours: 2.5, billable: true, color: '#4f46e5' },
    { id: 'te2', date: formatDate(addDays(startOfWeek(new Date()), 0)), project: 'Контракт KL-42', client: 'ООО Бета', task: 'Совещания', notes: 'Встреча с клиентом', hours: 1.0, billable: true, color: '#7c3aed' },
    { id: 'te3', date: formatDate(addDays(startOfWeek(new Date()), 1)), project: 'Дело №2024-118', client: 'ООО Альфа', task: 'Составление', notes: 'Проект договора', hours: 3.25, billable: true, color: '#4f46e5' },
    { id: 'te4', date: formatDate(addDays(startOfWeek(new Date()), 2)), project: 'Контракт KL-42', client: 'ООО Бета', task: 'Исследование', notes: 'Правовой анализ', hours: 2.0, billable: true, color: '#7c3aed' },
    { id: 'te5', date: formatDate(addDays(startOfWeek(new Date()), 2)), project: 'Общие расходы', client: 'Внутренний', task: 'Административное', notes: '', hours: 0.5, billable: false, color: '#64748b' },
    { id: 'te6', date: formatDate(addDays(startOfWeek(new Date()), 3)), project: 'Дело №2024-98', client: 'ООО Альфа', task: 'Судебное заседание', notes: 'Предварительное слушание', hours: 4.0, billable: true, color: '#0891b2' },
];
function formatDate(d: Date): string {
    return d.toISOString().slice(0, 10);
}
const FORM_PROJECTS = [
    { id: 'p1', name: 'Дело №2024-118', client: 'ООО Альфа', color: '#4f46e5' },
    { id: 'p2', name: 'Дело №2024-98', client: 'ООО Альфа', color: '#0891b2' },
    { id: 'p3', name: 'Контракт KL-42', client: 'ООО Бета', color: '#7c3aed' },
    { id: 'p4', name: 'Общие расходы', client: 'Внутренний', color: '#64748b' },
];
const FORM_TASKS = ['Анализ документов', 'Составление', 'Совещания', 'Исследование', 'Судебное заседание', 'Телефонные звонки', 'Электронная переписка', 'Административное'];
type EntryForm = {
    projectId: string;
    task: string;
    date: string;
    hours: string;
    notes: string;
    billable: boolean;
};
function AddEntryModal({ defaultDate, onClose, onSave }: {
    defaultDate: string;
    onClose: () => void;
    onSave: (e: TimeEntry) => void;
}) {
    const uid = useId();
    const [form, setForm] = useState<EntryForm>({
        projectId: FORM_PROJECTS[0].id,
        task: FORM_TASKS[0],
        date: defaultDate,
        hours: '',
        notes: '',
        billable: true,
    });
    const [error, setError] = useState<string | null>(null);
    useEffect(() => {
        const h = (e: KeyboardEvent) => { if (e.key === 'Escape')
            onClose(); };
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
    return createPortal(<div className="ts__modal-overlay" onClick={onClose}>
      <div className="ts__modal" onClick={e => e.stopPropagation()}>
        <div className="ts__modal-head">
          <h3 className="ts__modal-title">Добавить время</h3>
          <button className="ts__modal-close" onClick={onClose} aria-label="Закрыть">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="ts__modal-body">
          <div className="ts__mfield">
            <label className="ts__mlabel" htmlFor={`${uid}-proj`}>Проект</label>
            <select id={`${uid}-proj`} className="ts__mselect" value={form.projectId} onChange={e => setForm(f => ({ ...f, projectId: e.target.value }))}>
              {FORM_PROJECTS.map(p => (<option key={p.id} value={p.id}>{p.name} — {p.client}</option>))}
            </select>
          </div>
          <div className="ts__mfield">
            <label className="ts__mlabel" htmlFor={`${uid}-task`}>Задача</label>
            <select id={`${uid}-task`} className="ts__mselect" value={form.task} onChange={e => setForm(f => ({ ...f, task: e.target.value }))}>
              {FORM_TASKS.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="ts__mrow">
            <div className="ts__mfield">
              <label className="ts__mlabel" htmlFor={`${uid}-date`}>Дата</label>
              <input id={`${uid}-date`} type="date" className="ts__minput" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}/>
            </div>
            <div className="ts__mfield">
              <label className="ts__mlabel" htmlFor={`${uid}-hours`}>Часов</label>
              <input id={`${uid}-hours`} type="text" className="ts__minput" placeholder="0.00" value={form.hours} onChange={e => setForm(f => ({ ...f, hours: e.target.value }))}/>
            </div>
          </div>
          <div className="ts__mfield">
            <label className="ts__mlabel" htmlFor={`${uid}-notes`}>Примечание</label>
            <input id={`${uid}-notes`} type="text" className="ts__minput" placeholder="Что делали?" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}/>
          </div>
          <label className="ts__mbillable">
            <span className="ts__toggle-track" data-on={form.billable} onClick={() => setForm(f => ({ ...f, billable: !f.billable }))}>
              <span className="ts__toggle-thumb"/>
            </span>
            <span className="ts__mbillable-label">Оплачиваемое</span>
          </label>
          {error && <p className="ts__merror">{error}</p>}
        </div>
        <div className="ts__modal-foot">
          <button className="ts__mbtn ts__mbtn--primary" onClick={handleSave}>Сохранить</button>
          <button className="ts__mbtn ts__mbtn--ghost" onClick={onClose}>Отмена</button>
        </div>
      </div>
    </div>, document.body);
}
export function TimesheetPage() {
    const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
    const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
    const [viewMode, setViewMode] = useState<'day' | 'week'>('week');
    const [mainTab, setMainTab] = useState<'timesheet' | 'approval'>('timesheet');
    const [entries, setEntries] = useState<TimeEntry[]>(MOCK_ENTRIES);
    const [showModal, setShowModal] = useState(false);
    const [activeDay, setActiveDay] = useState<Date>(today);
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
    const displayDays = viewMode === 'week' ? weekDays : [activeDay];
    const randomQuote = useMemo(() => QUOTES[Math.floor(Math.random() * QUOTES.length)], [weekStart]);
    const addEntry = (e: TimeEntry) => setEntries(prev => [...prev, e]);
    function deleteEntry(id: string) {
        setEntries(prev => prev.filter(e => e.id !== id));
    }
    const dayGroups = useMemo(() => {
        return displayDays.map(d => {
            const key = formatDate(d);
            const dayEntries = entries.filter(e => e.date === key);
            const projectMap = new Map<string, TimeEntry[]>();
            for (const e of dayEntries) {
                if (!projectMap.has(e.project))
                    projectMap.set(e.project, []);
                projectMap.get(e.project)!.push(e);
            }
            return { date: d, key, projects: Array.from(projectMap.entries()) };
        });
    }, [displayDays, entries]);
    const hasAnyEntries = dayGroups.some(g => g.projects.length > 0);
    return (<div className="ts">
    <div className="ts__top-tabs">
        <button className={`ts__top-tab${mainTab === 'timesheet' ? ' ts__top-tab--active' : ''}`} onClick={() => setMainTab('timesheet')}>
          Расписание
        </button>
        <button className={`ts__top-tab${mainTab === 'approval' ? ' ts__top-tab--active' : ''}`} onClick={() => setMainTab('approval')}>
          На утверждение
          <span className="ts__top-tab-dot"/>
        </button>
      </div>

      <div className="ts__body">
    <div className="ts__left">
          <button className="ts__track-btn" onClick={() => { setShowModal(true); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
          <span className="ts__track-label">Добавить время</span>
        </div>
    <div className="ts__main">
    <div className="ts__toolbar">
            <div className="ts__toolbar-left">
              <button className="ts__nav-btn" onClick={prevWeek} aria-label="Предыдущая неделя">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M15 18l-6-6 6-6"/>
                </svg>
              </button>
              <button className="ts__nav-btn" onClick={nextWeek} aria-label="Следующая неделя">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </button>
              <h1 className="ts__today-label">{todayStr}</h1>
            </div>
            <div className="ts__toolbar-right">
              <button className="ts__cal-btn" onClick={goToday} title="Сегодня">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <rect x="3" y="4" width="18" height="18" rx="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </button>
              <div className="ts__view-toggle">
                <button className={`ts__view-btn${viewMode === 'day' ? ' ts__view-btn--active' : ''}`} onClick={() => setViewMode('day')}>День</button>
                <button className={`ts__view-btn${viewMode === 'week' ? ' ts__view-btn--active' : ''}`} onClick={() => setViewMode('week')}>Неделя</button>
              </div>
            </div>
          </div>
    <div className="ts__week-head">
            {weekDays.map((d, i) => {
            const fmt = fmtWeekDay(d);
            const isToday = isSameDay(d, today);
            const isActive = isSameDay(d, activeDay);
            const h = hoursPerDay[i];
            return (<button key={i} className={`ts__day-col${isToday ? ' ts__day-col--today' : ''}${isActive && viewMode === 'day' ? ' ts__day-col--active' : ''}`} onClick={() => { setActiveDay(d); setViewMode('day'); }}>
                  <span className="ts__day-name">{fmt.short}</span>
                  <span className="ts__day-num">{d.getDate()}</span>
                  <span className={`ts__day-hours${h > 0 ? ' ts__day-hours--filled' : ''}`}>
                    {fmtHours(h)}
                  </span>
                  {isToday && <span className="ts__day-indicator"/>}
                </button>);
        })}
            <div className="ts__week-total-col">
              <span className="ts__wt-label">Итого за неделю</span>
              <span className={`ts__wt-val${weekTotal > 0 ? ' ts__wt-val--filled' : ''}`}>
                {fmtHours(weekTotal)}
              </span>
            </div>
          </div>
    <div className="ts__content">
            {!hasAnyEntries ? (<div className="ts__empty">
                <p className="ts__empty-quote">{randomQuote.text}</p>
                <p className="ts__empty-author">{randomQuote.author}</p>
              </div>) : (<div className="ts__days">
                {dayGroups.filter(g => g.projects.length > 0).map(g => (<div key={g.key} className="ts__day-group">
                    {viewMode === 'week' && (<div className="ts__day-group-head">
                        <span className={`ts__day-group-name${isSameDay(g.date, today) ? ' ts__day-group-name--today' : ''}`}>
                          {g.date.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^\w/, c => c.toUpperCase())}
                        </span>
                        <span className="ts__day-group-total">
                          {fmtHours(entries.filter(e => e.date === g.key).reduce((s, e) => s + e.hours, 0))}
                        </span>
                      </div>)}
                    {g.projects.map(([projName, projEntries]) => (<div key={projName} className="ts__proj-group">
                        <div className="ts__proj-head">
                          <span className="ts__proj-dot" style={{ background: projEntries[0].color }}/>
                          <span className="ts__proj-name">{projName}</span>
                          <span className="ts__proj-client">{projEntries[0].client}</span>
                          <span className="ts__proj-total">
                            {fmtHours(projEntries.reduce((s, e) => s + e.hours, 0))}
                          </span>
                        </div>
                        {projEntries.map(e => (<div key={e.id} className="ts__entry">
                            <div className="ts__entry-left">
                              <span className="ts__entry-task">{e.task}</span>
                              {e.notes && <span className="ts__entry-notes">{e.notes}</span>}
                            </div>
                            <div className="ts__entry-right">
                              <span className={`ts__entry-bill${e.billable ? ' ts__entry-bill--yes' : ' ts__entry-bill--no'}`}>
                                {e.billable ? 'Опл.' : 'Неопл.'}
                              </span>
                              <span className="ts__entry-hours">{fmtHours(e.hours)}</span>
                              <button className="ts__entry-del" onClick={() => deleteEntry(e.id)} aria-label="Удалить" title="Удалить">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                  <path d="M18 6L6 18M6 6l12 12"/>
                                </svg>
                              </button>
                            </div>
                          </div>))}
                      </div>))}
                  </div>))}
              </div>)}
          </div>
    <div className="ts__footer">
            <div className="ts__submit-wrap">
              <button className="ts__submit-btn">
                Отправить на утверждение
              </button>
              <button className="ts__submit-arrow">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
        {showModal && (<AddEntryModal defaultDate={formatDate(viewMode === 'day' ? activeDay : today)} onClose={() => setShowModal(false)} onSave={addEntry}/>)}
    </div>);
}
