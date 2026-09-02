import type { VacationLeaveRequestApi, VacationLeaveRequestKind } from '@entities/vacation';
import { formatRuDateLong } from './leaveRequestDisplay';

export const LEAVE_APPLICATION_ADDRESSEE =
    'Управляющему партнеру АФ Kosta Legal Ахмаджонову А.А.';

export type VacationLeaveApplicationCopy = {
    addressee: string;
    fromLine: string;
    dateLine: string;
    title: string;
    subtitle: string;
    bodyBeforeDays: string;
    daysCount: string;
    bodyBetweenDaysAndFrom: string;
    dateFrom: string;
    bodyBetweenDates: string;
    dateTo: string;
    bodyAfterTo: string;
    signerLine: string;
};

const TITLE = 'Заявление';

const KIND_SUBTITLE: Record<VacationLeaveRequestKind, string> = {
    annual_vacation: 'о предоставлении ежегодного оплачиваемого отпуска',
    day_off: 'о предоставлении отпуска без сохранения заработной платы',
    remote_work: 'о согласовании дистанционного режима работы',
    sick_leave: 'об отсутствии по болезни',
};

const KIND_LEAD: Record<VacationLeaveRequestKind, string> = {
    annual_vacation: 'Прошу предоставить мне очередной ежегодный оплачиваемый отпуск продолжительностью',
    day_off: 'Прошу предоставить мне отпуск без сохранения заработной платы продолжительностью',
    remote_work: 'Прошу согласовать дистанционный режим работы продолжительностью',
    sick_leave: 'Прошу учесть период нетрудоспособности продолжительностью',
};

function joinNameAndPosition(name: string, position: string | null | undefined): string {
    const n = name.trim();
    const p = (position ?? '').trim();
    if (n && p)
        return `${n}, ${p}`;
    return n || p || '';
}

export function buildVacationLeaveApplicationCopy(req: VacationLeaveRequestApi): VacationLeaveApplicationCopy {
    const fromLine = joinNameAndPosition(req.employee_full_name, req.employee_position);
    const signerLine = fromLine;
    const days = Number.isFinite(req.days_count) ? String(Math.trunc(req.days_count)) : '';
    return {
        addressee: LEAVE_APPLICATION_ADDRESSEE,
        fromLine: fromLine || '[ФИО, должность]',
        dateLine: formatRuDateLong(req.created_at) || '[ДАТА]',
        title: TITLE,
        subtitle: KIND_SUBTITLE[req.kind] ?? KIND_SUBTITLE.annual_vacation,
        bodyBeforeDays: KIND_LEAD[req.kind] ?? KIND_LEAD.annual_vacation,
        daysCount: days || '[количество дней]',
        bodyBetweenDaysAndFrom: 'календарных дней с',
        dateFrom: formatRuDateLong(req.date_from) || '[дата]',
        bodyBetweenDates: 'по',
        dateTo: formatRuDateLong(req.date_to) || '[дата]',
        bodyAfterTo: 'включительно.',
        signerLine: signerLine || '[ФИО, должность]',
    };
}
