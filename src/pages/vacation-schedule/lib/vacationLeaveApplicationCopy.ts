import type { VacationLeaveRequestApi, VacationLeaveRequestKind } from '@entities/vacation';
import { formatRuDateLong } from './leaveRequestDisplay';

export const LEAVE_APPLICATION_ADDRESSEE =
    'Управляющему партнеру АФ Kosta Legal Ахмаджонову А.А.';

export type VacationLeaveApplicationBodyPart =
    | { type: 'text'; text: string }
    | { type: 'field'; text: string };

export type VacationLeaveApplicationCopy = {
    addressee: string;
    fromLine: string;
    dateLine: string;
    title: string;
    subtitle: string;
    bodyParts: VacationLeaveApplicationBodyPart[];
    signerLine: string;
};

const KIND_HEADING: Record<VacationLeaveRequestKind, { title: string; subtitle: string }> = {
    annual_vacation: {
        title: 'Заявление',
        subtitle: 'о предоставлении ежегодного оплачиваемого отпуска',
    },
    day_off: {
        title: 'Заявление о предоставлении отпуска без сохранения заработной платы',
        subtitle: '',
    },
    remote_work: {
        title: 'Заявление',
        subtitle: 'о выходе на удаленный режим работы',
    },
    sick_leave: {
        title: 'Заявление',
        subtitle: 'об отсутствии по болезни',
    },
};

function joinNameAndPosition(name: string, position: string | null | undefined): string {
    const n = name.trim();
    const p = (position ?? '').trim();
    if (n && p)
        return `${n}, ${p}`;
    return n || p || '';
}

function isoDay(value: string | null | undefined): string {
    return (value ?? '').trim().slice(0, 10);
}

function durationBody(
    lead: string,
    daysCount: string,
    dateFrom: string,
    dateTo: string,
): VacationLeaveApplicationBodyPart[] {
    return [
        { type: 'text', text: `${lead} ` },
        { type: 'field', text: daysCount },
        { type: 'text', text: ' календарных дней с ' },
        { type: 'field', text: dateFrom },
        { type: 'text', text: ' по ' },
        { type: 'field', text: dateTo },
        { type: 'text', text: ' включительно.' },
    ];
}

function remoteBody(dateFrom: string, dateTo: string, fromIso: string, toIso: string): VacationLeaveApplicationBodyPart[] {
    const lead = 'Прошу предоставить мне возможность осуществлять трудовую деятельность в удалённом режиме ';
    if (fromIso && fromIso === toIso) {
        return [
            { type: 'text', text: lead },
            { type: 'field', text: dateFrom },
            { type: 'text', text: '.' },
        ];
    }
    return [
        { type: 'text', text: `${lead}с ` },
        { type: 'field', text: dateFrom },
        { type: 'text', text: ' по ' },
        { type: 'field', text: dateTo },
        { type: 'text', text: ' включительно.' },
    ];
}

export function buildVacationLeaveApplicationCopy(req: VacationLeaveRequestApi): VacationLeaveApplicationCopy {
    const fromLine = joinNameAndPosition(req.employee_full_name, req.employee_position);
    const days = Number.isFinite(req.days_count) ? String(Math.trunc(req.days_count)) : '[количество дней]';
    const dateFrom = formatRuDateLong(req.date_from) || '[дата]';
    const dateTo = formatRuDateLong(req.date_to) || '[дата]';
    const heading = KIND_HEADING[req.kind] ?? KIND_HEADING.annual_vacation;
    let bodyParts: VacationLeaveApplicationBodyPart[];
    if (req.kind === 'remote_work') {
        bodyParts = remoteBody(dateFrom, dateTo, isoDay(req.date_from), isoDay(req.date_to));
    }
    else if (req.kind === 'day_off') {
        bodyParts = durationBody(
            'Прошу предоставить мне отпуск без сохранения заработной платы продолжительностью',
            days,
            dateFrom,
            dateTo,
        );
    }
    else if (req.kind === 'sick_leave') {
        bodyParts = durationBody(
            'Прошу учесть период нетрудоспособности продолжительностью',
            days,
            dateFrom,
            dateTo,
        );
    }
    else {
        bodyParts = durationBody(
            'Прошу предоставить мне очередной ежегодный оплачиваемый отпуск продолжительностью',
            days,
            dateFrom,
            dateTo,
        );
    }
    return {
        addressee: LEAVE_APPLICATION_ADDRESSEE,
        fromLine: fromLine || '[ФИО, должность]',
        dateLine: formatRuDateLong(req.created_at) || '[ДАТА]',
        title: heading.title,
        subtitle: heading.subtitle,
        bodyParts,
        signerLine: fromLine || '[ФИО, должность]',
    };
}
