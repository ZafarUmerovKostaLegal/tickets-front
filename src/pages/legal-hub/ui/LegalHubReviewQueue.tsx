import { useMemo, useState } from 'react';
import { useI18n } from '@shared/i18n';
import type { TranslationKey } from '@shared/i18n/translate';
import { SearchableSelect } from '@shared/ui';
import { LegalHubTaskDrawer } from './LegalHubTaskDrawer';
import {
    HUB_TASKS,
    PERSON_LABEL,
    PROJECT_LABEL,
    TASK_PROJECTS,
    type HubTask,
    type TaskPersonId,
    type TaskPriorityId,
    type TaskProjectId,
} from './legalHubTasks';

type Lane = 'associate' | 'partner' | 'changes' | 'approved';

type QueueItem = {
    task: HubTask;
    lane: Lane;
    submittedOn: string;
    targetOn: string;
    approvedOn?: string;
    note?: string;
};

const LANES: Lane[] = ['associate', 'partner', 'changes', 'approved'];
const APPROVED_WINDOW = 14;

const LANE_LABEL: Record<Lane, TranslationKey> = {
    associate: 'legalHub.taskStatusAssociate',
    partner: 'legalHub.taskStatusPartner',
    changes: 'legalHub.statusChanges',
    approved: 'legalHub.queueApproved',
};

const LANE_TONE: Record<Lane, string> = {
    associate: 'associate',
    partner: 'partner',
    changes: 'changes',
    approved: 'priority-low',
};

const PRIORITY_LABEL: Record<TaskPriorityId, TranslationKey> = {
    high: 'legalHub.taskPriorityHigh',
    normal: 'legalHub.taskPriorityNormal',
    low: 'legalHub.taskPriorityLow',
};

const BOARD_TITLE: Record<TaskProjectId, string> = {
    solar: 'Project A — Solar',
    wind: 'Project B — Wind',
    infrastructure: 'Project C — Infrastructure',
    bess: 'Project D — BESS',
    healthcare: 'Project E — Healthcare',
};

const APPROVED: QueueItem[] = [
    item({ id: 'approved-epc', project: 'wind', title: 'EPC Contract Markup', workstream: 'Contracts', owner: 'ja1', reviewer: 'a1', priority: 'high', submittedOn: '2026-10-23', approvedOn: '2026-10-24' }),
    item({ id: 'approved-resolution', project: 'infrastructure', title: 'Corporate Resolution', workstream: 'Compliance', owner: 'ja2', reviewer: 'a1', priority: 'normal', submittedOn: '2026-10-25', approvedOn: '2026-10-26' }),
    item({ id: 'approved-advice', project: 'wind', title: 'Contractual Advice', workstream: 'Contracts', owner: 'ja1', reviewer: 'a1', priority: 'normal', submittedOn: '2026-10-24', approvedOn: '2026-10-26' }),
    item({ id: 'approved-clinic', project: 'healthcare', title: 'Clinic Registration Letter', workstream: 'Regulatory', owner: 'ja3', reviewer: 'a2', priority: 'normal', submittedOn: '2026-10-25', approvedOn: '2026-10-27' }),
];

function item(seed: {
    id: string;
    project: TaskProjectId;
    title: string;
    workstream: string;
    owner: TaskPersonId;
    reviewer: TaskPersonId;
    priority: TaskPriorityId;
    submittedOn: string;
    approvedOn: string;
}): QueueItem {
    return {
        lane: 'approved',
        submittedOn: seed.submittedOn,
        targetOn: seed.approvedOn,
        approvedOn: seed.approvedOn,
        task: {
            id: seed.id,
            project: seed.project,
            title: seed.title,
            workstream: seed.workstream,
            owner: seed.owner,
            reviewer: seed.reviewer,
            status: 'associate',
            priority: seed.priority,
            reviewOn: seed.approvedOn,
            clientOn: seed.approvedOn,
            minutes: 60,
        },
    };
}

function dayDelta(iso: string): number {
    const [year, month, day] = iso.split('-').map(Number);
    const target = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((target.getTime() - start.getTime()) / 86400000);
}

function shiftIso(iso: string, days: number): string {
    const [year, month, day] = iso.split('-').map(Number);
    const date = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
    date.setDate(date.getDate() + days);
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatDay(iso: string, locale: string): string {
    const [year, month, day] = iso.split('-').map(Number);
    return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1).toLocaleDateString(locale === 'ru' ? 'ru-RU' : 'en-GB', {
        day: 'numeric',
        month: 'short',
    });
}

function liveItems(): QueueItem[] {
    return HUB_TASKS.flatMap((task) => {
        const lane: Lane | null = task.status === 'associate' || task.status === 'partner' || task.status === 'changes' ? task.status : null;
        if (lane == null)
            return [];
        const targetOn = task.reviewOn || task.clientOn;
        return [{
            task,
            lane,
            submittedOn: shiftIso(targetOn, -2),
            targetOn,
            note: task.id === 'revise-draft' ? 'note' : undefined,
        }];
    });
}

export function LegalHubReviewQueue({ query }: { query: string }) {
    const { t, locale } = useI18n();
    const [project, setProject] = useState('');
    const [reviewer, setReviewer] = useState('');
    const [status, setStatus] = useState('');
    const [nudged, setNudged] = useState<string[]>([]);
    const [openId, setOpenId] = useState<string | null>(null);
    const items = useMemo(() => [...liveItems(), ...APPROVED], []);
    const needle = query.trim().toLowerCase();
    const visible = items.filter((item) => {
        if (project && item.task.project !== project)
            return false;
        if (reviewer && item.task.reviewer !== reviewer)
            return false;
        if (status && item.lane !== status)
            return false;
        if (!needle)
            return true;
        const person = item.task.reviewer ? PERSON_LABEL[item.task.reviewer].name : '';
        return `${item.task.title} ${BOARD_TITLE[item.task.project]} ${item.task.workstream} ${person}`.toLowerCase().includes(needle);
    });
    const overdue = visible.filter((item) => item.lane !== 'approved' && dayDelta(item.targetOn) < 0);
    const approvedCount = visible.filter((item) => item.lane === 'approved' && item.approvedOn != null && dayDelta(item.approvedOn) >= -APPROVED_WINDOW).length;
    const openTask = items.find((item) => item.task.id === openId)?.task ?? null;
    const projectOptions = TASK_PROJECTS.map((id) => ({ id, label: PROJECT_LABEL[id] }));
    const reviewerOptions = [...new Set(items.flatMap((item) => item.task.reviewer ? [item.task.reviewer] : []))]
        .map((id) => ({ id, label: PERSON_LABEL[id].name }));
    const statusOptions = LANES.map((id) => ({ id, label: t(LANE_LABEL[id]) }));

    return (
        <div className="lh-queue">
            <p className="lh-queue__hint">{t('legalHub.queueHint')}</p>
            <ul className="lh-queue__stats">
                <Stat icon="associate" value={visible.filter((item) => item.lane === 'associate').length} label={t('legalHub.taskStatusAssociate')} />
                <Stat icon="partner" value={visible.filter((item) => item.lane === 'partner').length} label={t('legalHub.taskStatusPartner')} />
                <Stat icon="changes" value={visible.filter((item) => item.lane === 'changes').length} label={t('legalHub.statusChanges')} />
                <Stat icon="approved" value={approvedCount} label={`${t('legalHub.queueApproved')} · ${t('legalHub.queueApprovedMeta').replace('{count}', String(APPROVED_WINDOW))}`} />
            </ul>
            {overdue.length > 0 ? (
                <div className="lh-queue__alert">
                    <strong>{t('legalHub.queueAlert').replace('{count}', String(overdue.length))}</strong>
                    <span>{overdue[0]?.task.title}</span>
                </div>
            ) : null}
            <div className="lh-queue__filters">
                <Filter label={t('legalHub.taskColProject')} value={project} all={t('legalHub.queueAllProjects')} options={projectOptions} onChange={setProject} />
                <Filter label={t('legalHub.taskColReviewer')} value={reviewer} all={t('legalHub.queueAllReviewers')} options={reviewerOptions} onChange={setReviewer} />
                <Filter label={t('legalHub.taskColStatus')} value={status} all={t('legalHub.queueAllStatuses')} options={statusOptions} onChange={setStatus} />
            </div>
            {visible.length === 0 ? <p className="lh-queue__empty">{t('legalHub.queueEmpty')}</p> : (
                <div className="lh-queue__board">
                    {LANES.filter((lane) => status === '' || status === lane).map((lane) => {
                        const cards = visible.filter((item) => item.lane === lane);
                        return (
                            <section key={lane} className="lh-queue__col">
                                <header>
                                    <span className={`lh-tasks__pill lh-tasks__pill--${LANE_TONE[lane]}`}>{t(LANE_LABEL[lane])}</span>
                                    <span>{cards.length}</span>
                                </header>
                                {cards.length === 0 ? <p className="lh-queue__empty">{t('legalHub.queueEmpty')}</p> : (
                                    <ul>
                                        {cards.map((card) => (
                                            <QueueCard
                                                key={card.task.id}
                                                item={card}
                                                locale={locale}
                                                nudged={nudged.includes(card.task.id)}
                                                onOpen={() => setOpenId(card.task.id)}
                                                onNudge={() => setNudged((current) => current.includes(card.task.id) ? current : [...current, card.task.id])}
                                            />
                                        ))}
                                    </ul>
                                )}
                            </section>
                        );
                    })}
                </div>
            )}
            {openTask ? <LegalHubTaskDrawer key={openTask.id} task={openTask} owner={null} onClose={() => setOpenId(null)} /> : null}
        </div>
    );
}

function Stat({ icon, value, label }: { icon: string; value: number; label: string }) {
    return (
        <li className={`lh-stat lh-stat--${icon === 'approved' ? 'success' : icon === 'partner' ? 'accent' : icon === 'associate' ? 'review' : icon}`}>
            <span className="lh-stat__icon" aria-hidden><StatIcon kind={icon} /></span>
            <span className="lh-stat__body">
                <strong className="lh-stat__value">{value}</strong>
                <span className="lh-stat__label">{label}</span>
            </span>
        </li>
    );
}

function StatIcon({ kind }: { kind: string }) {
    if (kind === 'approved') {
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
            </svg>
        );
    }
    if (kind === 'changes') {
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="8" />
                <path d="M12 8v5" />
                <path d="M12 16h.01" />
            </svg>
        );
    }
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
            <circle cx="9.5" cy="7" r="3" />
            <path d="M19 8v6" />
            <path d="M22 11h-6" />
        </svg>
    );
}

function Filter({ label, value, all, options, onChange }: {
    label: string;
    value: string;
    all: string;
    options: { id: string; label: string }[];
    onChange: (id: string) => void;
}) {
    const { t } = useI18n();
    const items = useMemo(() => [{ id: '', label: all }, ...options], [all, options]);
    return (
        <label className={`lh-my__filter${value ? ' is-set' : ''}`}>
            <span>{label}</span>
            <SearchableSelect
                portalDropdown
                portalZIndex={40}
                buttonClassName="lh-tasks__pick"
                placeholder={all}
                emptyListText={all}
                noMatchText={t('legalHub.teamNoMatch')}
                aria-label={label}
                value={value}
                items={items}
                getOptionValue={(item) => item.id}
                getOptionLabel={(item) => item.label}
                getSearchText={(item) => item.label}
                onSelect={(item) => onChange(item.id)}
            />
        </label>
    );
}

function QueueCard({ item, locale, nudged, onOpen, onNudge }: {
    item: QueueItem;
    locale: string;
    nudged: boolean;
    onOpen: () => void;
    onNudge: () => void;
}) {
    const { t } = useI18n();
    const person = item.task.reviewer ? PERSON_LABEL[item.task.reviewer] : null;
    const delta = dayDelta(item.targetOn);
    const late = item.lane !== 'approved' && delta < 0;
    const hint = item.lane === 'approved'
        ? null
        : delta < 0
            ? t('legalHub.queueOverdueDays').replace('{count}', String(-delta))
            : delta === 0
                ? t('legalHub.queueDueNow')
                : t('legalHub.queueDaysLeft').replace('{count}', String(delta));
    return (
        <li className={`lh-queue__card${late || item.note ? ' is-late' : ''}`}>
            <button type="button" className="lh-queue__open" onClick={onOpen}>
                <span className={`lh-queue__project lh-tasks__project--${item.task.project}`}>{BOARD_TITLE[item.task.project]}</span>
                <span className="lh-queue__stream">{item.task.workstream}</span>
                <strong>{item.task.title}</strong>
                <span className="lh-queue__when">
                    <span>
                        {t('legalHub.queueSubmitted').replace('{date}', formatDay(item.submittedOn, locale))}
                        {' · '}
                        {item.approvedOn
                            ? t('legalHub.queueApprovedOn').replace('{date}', formatDay(item.approvedOn, locale))
                            : t('legalHub.queueTarget').replace('{date}', formatDay(item.targetOn, locale))}
                    </span>
                    {hint ? <em className={late || delta === 0 ? 'is-hot' : ''}>{hint}</em> : null}
                </span>
                {item.note ? <span className="lh-queue__note">{t('legalHub.queueNote')}</span> : null}
            </button>
            <span className="lh-queue__foot">
                {person ? <span className={`lh-tasks__avatar lh-tasks__avatar--${item.task.reviewer}`} title={person.name}>{person.code}</span> : null}
                {person ? <span className="lh-queue__who">{person.name}</span> : null}
                <span className={`lh-tasks__pill lh-tasks__pill--priority-${item.task.priority}`}>{t(PRIORITY_LABEL[item.task.priority])}</span>
            </span>
            {item.lane === 'changes' || (late && item.lane !== 'changes') ? (
                <span className="lh-queue__actions">
                    {item.lane === 'changes' ? (
                        <button type="button" className="lh-queue__action" onClick={onOpen}>{t('legalHub.queueFix')}</button>
                    ) : (
                        <button type="button" className="lh-queue__action" disabled={nudged} onClick={onNudge}>
                            {nudged ? t('legalHub.queueNudged') : t('legalHub.queueNudge')}
                        </button>
                    )}
                </span>
            ) : null}
        </li>
    );
}
