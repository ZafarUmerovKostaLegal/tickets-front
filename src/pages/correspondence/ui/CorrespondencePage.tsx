import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AppBackButton, AppPageSettings } from '@shared/ui';
import './CorrespondencePage.css';

const STATS = [
    { key: 'in', label: 'Входящие', value: '128', delta: '+12 сегодня', deltaVariant: 'blue' as const, icon: 'inbox' as const },
    { key: 'out', label: 'Исходящие', value: '64', delta: '+8 сегодня', deltaVariant: 'green' as const, icon: 'send' as const },
    { key: 'approval', label: 'На согласовании', value: '18', delta: '+3 сегодня', deltaVariant: 'orange' as const, icon: 'users' as const },
    { key: 'overdue', label: 'Просрочено', value: '5', delta: '−2 сегодня', deltaVariant: 'red' as const, icon: 'clock' as const },
];

type DocType = 'letter' | 'contract' | 'note';
type DocStatus = 'new' | 'progress' | 'approval' | 'done';

type Row = {
    id: string;
    sender: string;
    subject: string;
    type: DocType;
    date: string;
    responsible: string;
    status: DocStatus;
};

const MOCK_ROWS: Row[] = [
    { id: 'BX-2024/0456', sender: 'ООО «Ромашка»', subject: 'Запрос коммерческого предложения', type: 'letter', date: '12.03.2024 10:15', responsible: 'Иванов И.И.', status: 'new' },
    { id: 'BX-2024/0455', sender: 'Отдел кадров', subject: 'Приказ о назначении', type: 'note', date: '11.03.2024 16:42', responsible: 'Петрова А.С.', status: 'progress' },
    { id: 'BX-2024/0454', sender: 'АО «Север»', subject: 'Договор поставки №124', type: 'contract', date: '11.03.2024 14:20', responsible: 'Сидоров П.В.', status: 'approval' },
    { id: 'BX-2024/0453', sender: 'Внутренний документооборот', subject: 'Служебная записка по проекту', type: 'note', date: '10.03.2024 09:05', responsible: 'Козлов Д.Д.', status: 'done' },
    { id: 'BX-2024/0452', sender: 'ИП Николаев', subject: 'Претензия по качеству', type: 'letter', date: '09.03.2024 11:30', responsible: 'Иванов И.И.', status: 'progress' },
    { id: 'BX-2024/0451', sender: 'ООО «Вектор»', subject: 'Дополнительное соглашение', type: 'contract', date: '08.03.2024 15:00', responsible: 'Петрова А.С.', status: 'approval' },
    { id: 'BX-2024/0450', sender: 'Налоговая инспекция', subject: 'Запрос документов', type: 'letter', date: '07.03.2024 10:00', responsible: 'Сидоров П.В.', status: 'new' },
    { id: 'BX-2024/0449', sender: 'Юридический отдел', subject: 'Заключение по договору аренды', type: 'note', date: '06.03.2024 14:18', responsible: 'Козлов Д.Д.', status: 'done' },
];

const TYPE_BADGE: Record<DocType, { label: string; className: string }> = {
    letter: { label: 'Письмо', className: 'corr__badge corr__badge--type-letter' },
    contract: { label: 'Договор', className: 'corr__badge corr__badge--type-contract' },
    note: { label: 'Записка', className: 'corr__badge corr__badge--type-note' },
};

const STATUS_BADGE: Record<DocStatus, { label: string; className: string }> = {
    new: { label: 'Новое', className: 'corr__badge corr__badge--status-new' },
    progress: { label: 'В работе', className: 'corr__badge corr__badge--status-progress' },
    approval: { label: 'На согласовании', className: 'corr__badge corr__badge--status-approval' },
    done: { label: 'Завершено', className: 'corr__badge corr__badge--status-done' },
};

const STEPS = [
    { key: 'reg', title: 'Регистрация', hint: 'Входящий документ зарегистрирован', icon: 'doc' as const },
    { key: 'dist', title: 'Распределение', hint: 'Назначен ответственный', icon: 'users' as const },
    { key: 'proc', title: 'Обработка', hint: 'Подготовка ответа', icon: 'gear' as const },
    { key: 'reply', title: 'Ответ', hint: 'Письмо отправлено', icon: 'send' as const },
    { key: 'arch', title: 'Архив', hint: 'Документ в архиве', icon: 'box' as const },
];

const RECENT = [
    { key: '1', tone: 'blue' as const, text: 'Зарегистрировано входящее письмо от ООО «Ромашка»', time: '10:15' },
    { key: '2', tone: 'orange' as const, text: 'Документ BX-2024/0455 передан на согласование', time: '09:42' },
    { key: '3', tone: 'green' as const, text: 'Исходящее письмо отправлено контрагенту', time: 'Вчера 16:30' },
    { key: '4', tone: 'blue' as const, text: 'Обновлён ответственный по BX-2024/0452', time: 'Вчера 11:05' },
];

const TABLE_TABS = [
    { key: 'all', label: 'Все' },
    { key: 'new', label: 'Новые' },
    { key: 'work', label: 'В работе' },
    { key: 'done', label: 'Завершено' },
] as const;

const PAGE_SIZE = 8;
const TOTAL_MOCK = 152;

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

function StepIcon({ name }: { name: 'doc' | 'users' | 'gear' | 'send' | 'box' }) {
    if (name === 'doc') {
        return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>);
    }
    if (name === 'users') {
        return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
        </svg>);
    }
    if (name === 'gear') {
        return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>);
    }
    if (name === 'send') {
        return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <line x1="22" y1="2" x2="11" y2="13"/>
          <polygon points="22 2 15 22 11 13 2 9 22 2"/>
        </svg>);
    }
    return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
      <line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>);
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

function filterRows(tab: (typeof TABLE_TABS)[number]['key'], rows: Row[]): Row[] {
    if (tab === 'all')
        return rows;
    if (tab === 'new')
        return rows.filter((r) => r.status === 'new');
    if (tab === 'work')
        return rows.filter((r) => r.status === 'progress' || r.status === 'approval');
    return rows.filter((r) => r.status === 'done');
}

export function CorrespondencePage() {
    const [tableTab, setTableTab] = useState<(typeof TABLE_TABS)[number]['key']>('all');
    const [page, setPage] = useState(1);
    const filtered = useMemo(() => filterRows(tableTab, MOCK_ROWS), [tableTab]);
    const isAllTab = tableTab === 'all';
    const displayedRows = useMemo(() => {
        if (isAllTab)
            return MOCK_ROWS;
        const start = (page - 1) * PAGE_SIZE;
        return filtered.slice(start, start + PAGE_SIZE);
    }, [filtered, isAllTab, page]);
    const totalForTab = isAllTab ? TOTAL_MOCK : filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalForTab / PAGE_SIZE));
    const effectivePage = isAllTab ? 1 : page;
    const pageNumbers = useMemo(() => buildPageNumbers(effectivePage, totalPages), [effectivePage, totalPages]);
    const rangeStart = totalForTab === 0 ? 0 : isAllTab ? 1 : (page - 1) * PAGE_SIZE + 1;
    const rangeEnd = totalForTab === 0 ? 0 : isAllTab ? Math.min(MOCK_ROWS.length, PAGE_SIZE, totalForTab) : Math.min(page * PAGE_SIZE, totalForTab);

    const headerRef = useRef<HTMLElement | null>(null);
    const [headerOffset, setHeaderOffset] = useState(88);
    useLayoutEffect(() => {
        const el = headerRef.current;
        if (!el)
            return;
        const sync = () => setHeaderOffset(el.getBoundingClientRect().height);
        sync();
        const ro = new ResizeObserver(sync);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const corrRootStyle = useMemo(() => ({
        paddingTop: headerOffset,
        ['--corr-header-offset' as string]: `${headerOffset}px`,
    }), [headerOffset]);

    return (<div className="corr" style={corrRootStyle}>
      <header ref={headerRef} className="corr__header">
        <div className="corr__header-inner">
          <div className="corr__header-start">
            <AppBackButton className="app-back-btn"/>
            <div>
              <h1 className="corr__title">Управление корреспонденцией</h1>
              <p className="corr__subtitle">Контроль и обработка входящих, исходящих и внутренних писем и документов</p>
            </div>
          </div>
          <AppPageSettings/>
        </div>
      </header>

      <div className="corr__body">
        <main className="corr__main">
          <div className="corr__content">
            <section className="corr__stats" aria-label="Показатели">
              {STATS.map((s) => (<article key={s.key} className={`corr__stat corr__stat--${s.deltaVariant}`}>
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

            <section className="corr__table-card" aria-label="Реестр документов">
              <div className="corr__table-toolbar">
                <div className="corr__table-tabs" role="tablist" aria-label="Фильтр по статусу">
                  {TABLE_TABS.map((t) => (<button key={t.key} type="button" role="tab" aria-selected={tableTab === t.key} className={`corr__table-tab${tableTab === t.key ? ' corr__table-tab--active' : ''}`} onClick={() => {
                        setTableTab(t.key);
                        setPage(1);
                    }}>
                      {t.label}
                    </button>))}
                </div>
                <div className="corr__table-actions">
                  <button type="button" className="corr__btn corr__btn--outline">
                    Фильтры
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>
                  <button type="button" className="corr__icon-btn" title="Дополнительно" aria-label="Дополнительно">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <circle cx="12" cy="12" r="3"/>
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                    </svg>
                  </button>
                </div>
              </div>

              <div className="corr__table-scroll">
                <table className="corr__table">
                  <thead>
                    <tr>
                      <th scope="col">№</th>
                      <th scope="col">Отправитель</th>
                      <th scope="col">Тема</th>
                      <th scope="col">Тип</th>
                      <th scope="col">Дата</th>
                      <th scope="col">Ответственный</th>
                      <th scope="col">Статус</th>
                      <th scope="col" className="corr__th-actions"><span className="corr__sr-only">Действия</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedRows.map((row) => (<tr key={row.id}>
                        <td className="corr__mono">{row.id}</td>
                        <td>{row.sender}</td>
                        <td>{row.subject}</td>
                        <td><span className={TYPE_BADGE[row.type].className}>{TYPE_BADGE[row.type].label}</span></td>
                        <td className="corr__nowrap">{row.date}</td>
                        <td>{row.responsible}</td>
                        <td><span className={STATUS_BADGE[row.status].className}>{STATUS_BADGE[row.status].label}</span></td>
                        <td className="corr__td-actions">
                          <button type="button" className="corr__row-menu" aria-label={`Действия для ${row.id}`}>
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
                <span className="corr__pagination-range">Показано {rangeStart}–{rangeEnd} из {totalForTab}</span>
                {!isAllTab && (<nav className="corr__pagination-nav" aria-label="Страницы">
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
                </nav>)}
                {isAllTab && (<nav className="corr__pagination-nav" aria-label="Страницы (демо)">
                  <button type="button" className="corr__page-btn" disabled aria-label="Предыдущая страница">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <polyline points="15 18 9 12 15 6"/>
                    </svg>
                  </button>
                  {buildPageNumbers(1, Math.max(1, Math.ceil(TOTAL_MOCK / PAGE_SIZE))).map((item, idx) => item === 'ellipsis'
                    ? (<span key={`d-${idx}`} className="corr__page-ellipsis">…</span>)
                    : (<span key={item} className={`corr__page-num${item === 1 ? ' corr__page-num--active' : ''}`}>{item}</span>))}
                  <button type="button" className="corr__page-btn" disabled aria-label="Следующая страница">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </button>
                </nav>)}
              </footer>
            </section>

            <section className="corr__steps" aria-labelledby="corr-steps-heading">
              <h2 id="corr-steps-heading" className="corr__steps-title">Этапы обработки документа</h2>
              <ol className="corr__steps-list">
                {STEPS.map((step, i) => (<li key={step.key} className="corr__step-item">
                    {i > 0 && (<span className="corr__step-arrow" aria-hidden>
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="9 18 15 12 9 6"/>
                        </svg>
                      </span>)}
                    <div className="corr__step-card">
                      <div className="corr__step-icon">
                        <StepIcon name={step.icon}/>
                      </div>
                      <span className="corr__step-title">{step.title}</span>
                      <span className="corr__step-hint">{step.hint}</span>
                    </div>
                  </li>))}
              </ol>
            </section>
          </div>
        </main>

        <aside className="corr__aside" aria-label="Боковая панель">
          <div className="corr__aside-block">
            <h2 className="corr__aside-title">Быстрые действия</h2>
            <button type="button" className="corr__btn corr__btn--primary corr__btn--block">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="18" x2="12" y2="12"/>
                <line x1="9" y1="15" x2="15" y2="15"/>
              </svg>
              Зарегистрировать письмо
            </button>
            <button type="button" className="corr__btn corr__btn--outline corr__btn--block">Создать ответ</button>
            <button type="button" className="corr__btn corr__btn--outline corr__btn--block">Отправить документ</button>
          </div>
          <div className="corr__aside-block corr__aside-block--feed">
            <h2 className="corr__aside-title">Последние действия</h2>
            <ul className="corr__feed" role="list">
              {RECENT.map((e) => (<li key={e.key} className="corr__feed-item">
                  <span className={`corr__feed-dot corr__feed-dot--${e.tone}`}/>
                  <div className="corr__feed-body">
                    <p className="corr__feed-text">{e.text}</p>
                    <time className="corr__feed-time">{e.time}</time>
                  </div>
                </li>))}
            </ul>
            <button type="button" className="corr__feed-all">
              Все действия
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          </div>
        </aside>
      </div>
    </div>);
}
