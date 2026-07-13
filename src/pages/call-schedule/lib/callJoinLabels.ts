import type { CallJoinRow } from '@entities/call-schedule';
import type { TranslationKey } from '@shared/i18n/translate';

const KEY_MAP: Record<string, TranslationKey> = {
    teams: 'callSchedulePage.join.teams',
    zoom: 'callSchedulePage.join.zoom',
    meet: 'callSchedulePage.join.meet',
    webex: 'callSchedulePage.join.webex',
    outlook: 'callSchedulePage.join.outlook',
    web: 'callSchedulePage.join.browser',
};

const CLASS_MAP: [string, TranslationKey][] = [
    ['csched-modal__join--teams', 'callSchedulePage.join.teams'],
    ['csched-modal__join--zoom', 'callSchedulePage.join.zoom'],
    ['csched-modal__join--meet', 'callSchedulePage.join.meet'],
    ['csched-modal__join--webex', 'callSchedulePage.join.webex'],
    ['csched-modal__join--outlook', 'callSchedulePage.join.outlook'],
];

export function translateJoinLabel(row: CallJoinRow, t: (key: TranslationKey) => string): string {
    const byKey = KEY_MAP[row.key];
    if (byKey)
        return t(byKey);
    for (const [cls, key] of CLASS_MAP) {
        if (row.className.includes(cls))
            return t(key);
    }
    if (row.className.includes('csched-modal__join--generic'))
        return t('callSchedulePage.join.meetingLink');
    return row.label;
}

export function joinLabelWithoutOpenPrefix(row: CallJoinRow, t: (key: TranslationKey) => string): string {
    const label = translateJoinLabel(row, t);
    const ruPrefix = 'Открыть ';
    const enPrefix = 'Open ';
    if (label.startsWith(ruPrefix))
        return label.slice(ruPrefix.length);
    if (label.startsWith(enPrefix))
        return label.slice(enPrefix.length);
    return label;
}
