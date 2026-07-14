import type {
    VacationLeaveKindApi,
    VacationLeaveRequestApi,
    VacationLeaveRequestKind,
    VacationLeaveRequestStatus,
} from '@entities/vacation';

const KIND_LABEL_FALLBACK: Record<VacationLeaveRequestKind, string> = {
    annual_vacation: 'Ежегодный отпуск',
    sick_leave: 'Больничный',
    day_off: 'Day Off (нерабочий)',
    remote_work: 'Дистанционный режим',
};

export function leaveKindLabel(
    kind: VacationLeaveRequestKind,
    catalog?: ReadonlyArray<VacationLeaveKindApi> | null,
): string {
    if (catalog) {
        const found = catalog.find((x) => x.kind === kind);
        if (found?.label_ru?.trim())
            return found.label_ru.trim();
    }
    return KIND_LABEL_FALLBACK[kind] ?? kind;
}

const STATUS_LABEL: Record<VacationLeaveRequestStatus, string> = {
    pending: 'На рассмотрении',
    approved: 'Утверждено',
    declined: 'Отклонено',
    cancelled: 'Отменено',
};

export function leaveStatusLabel(status: VacationLeaveRequestStatus): string {
    return STATUS_LABEL[status] ?? status;
}

const STATUS_TONE: Record<VacationLeaveRequestStatus, 'pending' | 'positive' | 'negative' | 'muted'> = {
    pending: 'pending',
    approved: 'positive',
    declined: 'negative',
    cancelled: 'muted',
};

export function leaveStatusTone(status: VacationLeaveRequestStatus): 'pending' | 'positive' | 'negative' | 'muted' {
    return STATUS_TONE[status] ?? 'muted';
}

const RU_MONTHS_GENITIVE = [
    'января',
    'февраля',
    'марта',
    'апреля',
    'мая',
    'июня',
    'июля',
    'августа',
    'сентября',
    'октября',
    'ноября',
    'декабря',
] as const;

function pad2(n: number): string {
    return n < 10 ? `0${n}` : String(n);
}

export function formatRuDate(iso: string | null | undefined): string {
    if (!iso)
        return '';
    const d = iso.slice(0, 10);
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
    if (!m)
        return iso;
    return `${m[3]}.${m[2]}.${m[1]}`;
}

export function formatRuDateLong(iso: string | null | undefined): string {
    if (!iso)
        return '';
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    if (!m)
        return iso;
    const day = Number(m[3]);
    const monthIdx = Number(m[2]) - 1;
    const month = RU_MONTHS_GENITIVE[monthIdx] ?? '';
    return `${day} ${month} ${m[1]}`;
}

export function formatRuRange(dateFrom: string, dateTo: string): string {
    if (!dateFrom || !dateTo)
        return [formatRuDate(dateFrom), formatRuDate(dateTo)].filter(Boolean).join(' — ');
    const a = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateFrom);
    const b = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateTo);
    if (!a || !b)
        return `${formatRuDate(dateFrom)} — ${formatRuDate(dateTo)}`;
    if (a[1] === b[1]) {
        return `${a[3]}.${a[2]} — ${b[3]}.${b[2]}.${b[1]}`;
    }
    return `${formatRuDate(dateFrom)} — ${formatRuDate(dateTo)}`;
}

export function countCalendarDaysInclusive(dateFrom: string, dateTo: string): number {
    const from = dateFrom.trim().slice(0, 10);
    const to = dateTo.trim().slice(0, 10);
    if (!from || !to)
        return 0;
    const a = new Date(`${from}T12:00:00`);
    const b = new Date(`${to}T12:00:00`);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a)
        return 0;
    return Math.floor((b.getTime() - a.getTime()) / 86_400_000) + 1;
}

const RU_DAY_FORMS = ['день', 'дня', 'дней'] as const;
export function ruDaysWord(n: number): string {
    const abs = Math.abs(n) % 100;
    const last = abs % 10;
    if (abs > 10 && abs < 20)
        return RU_DAY_FORMS[2]!;
    if (last === 1)
        return RU_DAY_FORMS[0]!;
    if (last >= 2 && last <= 4)
        return RU_DAY_FORMS[1]!;
    return RU_DAY_FORMS[2]!;
}

export function formatTimestampShort(iso: string | null | undefined): string {
    if (!iso)
        return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime()))
        return iso;
    const date = `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
    const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    return `${date}, ${time}`;
}

export function leaveRequestTitle(req: VacationLeaveRequestApi, catalog?: ReadonlyArray<VacationLeaveKindApi> | null): string {
    const kind = leaveKindLabel(req.kind, catalog);
    return `${kind} · #${req.id}`;
}
