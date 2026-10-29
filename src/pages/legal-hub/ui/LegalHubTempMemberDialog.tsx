import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TimeTrackingTeamRow } from '@entities/time-tracking/api/domains/teamsAndLabor';
import { useI18n } from '@shared/i18n';
import { DatePicker, SearchableSelect } from '@shared/ui';

export type TempTeamRef = {
    id: TimeTrackingTeamRow['id'];
    name: string;
};

export type TempEmployeeOption = {
    id: number;
    name: string;
    email: string;
    position: string;
};

export type TempMemberDraft = {
    teamId: TempTeamRef['id'];
    userId: number;
    name: string;
    email: string;
    position: string;
    accessUntil: string;
    canLogTime: boolean;
    canComment: boolean;
};

function todayIso(): string {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
}

export function LegalHubTempMemberDialog({ teams, employees, takenByTeam, onClose, onCreate }: {
    teams: TempTeamRef[];
    employees: TempEmployeeOption[];
    takenByTeam: Record<string, number[]>;
    onClose: () => void;
    onCreate: (draft: TempMemberDraft) => void;
}) {
    const { t } = useI18n();
    const formId = useId();
    const [teamId, setTeamId] = useState(teams[0]?.id ?? '');
    const [userId, setUserId] = useState<number | null>(null);
    const [accessUntil, setAccessUntil] = useState('');
    const [canLogTime, setCanLogTime] = useState(true);
    const [canComment, setCanComment] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const minDate = todayIso();
    const taken = new Set(takenByTeam[teamId] ?? []);
    const options = employees.filter((person) => !taken.has(person.id) || person.id === userId);
    const picked = employees.find((person) => person.id === userId && !taken.has(person.id)) ?? null;

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key !== 'Escape')
                return;
            if (document.querySelector('.ttp-pop, .tsp-srch--open'))
                return;
            event.preventDefault();
            onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const submit = () => {
        if (picked == null) {
            setError(t('legalHub.tempPickRequired'));
            return;
        }
        if (!accessUntil) {
            setError(t('legalHub.tempDateRequired'));
            return;
        }
        if (accessUntil < minDate) {
            setError(t('legalHub.tempDatePast'));
            return;
        }
        onCreate({
            teamId,
            userId: picked.id,
            name: picked.name,
            email: picked.email,
            position: picked.position,
            accessUntil,
            canLogTime,
            canComment,
        });
    };

    return createPortal(
        <div className="lh-temp" role="presentation" onMouseDown={onClose}>
            <form
                className="lh-temp__panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby={`${formId}-title`}
                onMouseDown={(event) => event.stopPropagation()}
                onSubmit={(event) => {
                    event.preventDefault();
                    submit();
                }}
            >
                <h2 id={`${formId}-title`} className="lh-temp__title">{t('legalHub.tempTitle')}</h2>
                <p className="lh-temp__hint">{t('legalHub.tempHint')}</p>
                {teams.length > 1 ? (
                    <div className="lh-temp__field">
                        <span id={`${formId}-team`}>{t('legalHub.tempTeam')}</span>
                        <SearchableSelect
                            portalDropdown
                            portalZIndex={6000}
                            className="lh-temp__srch"
                            buttonClassName="lh-temp__pick"
                            aria-labelledby={`${formId}-team`}
                            placeholder={t('legalHub.tempTeam')}
                            emptyListText={t('legalHub.tempEmployeeEmpty')}
                            noMatchText={t('legalHub.tempEmployeeEmpty')}
                            value={teamId}
                            items={teams}
                            getOptionValue={(team) => team.id}
                            getOptionLabel={(team) => team.name}
                            getSearchText={(team) => team.name}
                            onSelect={(team) => {
                                setTeamId(team.id);
                                setUserId(null);
                            }}
                        />
                    </div>
                ) : null}
                <div className="lh-temp__field">
                    <span id={`${formId}-employee`}>{t('legalHub.tempEmployee')}</span>
                    <SearchableSelect
                        portalDropdown
                        portalZIndex={6000}
                        className="lh-temp__srch"
                        buttonClassName="lh-temp__pick"
                        aria-labelledby={`${formId}-employee`}
                        placeholder={t('legalHub.tempEmployeeSearch')}
                        emptyListText={t('legalHub.tempEmployeeEmpty')}
                        noMatchText={t('legalHub.tempEmployeeEmpty')}
                        value={userId == null ? '' : String(userId)}
                        items={options}
                        getOptionValue={(person) => String(person.id)}
                        getOptionLabel={(person) => (person.position ? `${person.name} — ${person.position}` : person.name)}
                        getSearchText={(person) => `${person.name} ${person.email} ${person.position}`}
                        onSelect={(person) => setUserId(person.id)}
                    />
                </div>
                {picked ? <p className="lh-temp__picked">{picked.email}</p> : null}
                <div className="lh-temp__field">
                    <span id={`${formId}-until`}>{t('legalHub.tempUntil')}</span>
                    <DatePicker
                        portal
                        portalZIndex={6000}
                        className="lh-temp__calendar"
                        buttonClassName="lh-temp__date"
                        aria-labelledby={`${formId}-until`}
                        value={accessUntil}
                        min={minDate}
                        emptyLabel="дд.мм.гггг"
                        onChange={setAccessUntil}
                    />
                </div>
                <fieldset className="lh-temp__access">
                    <legend>{t('legalHub.tempAccess')}</legend>
                    <label className="lh-temp__check">
                        <input type="checkbox" checked disabled />
                        <span>{t('legalHub.tempCanTasks')}</span>
                    </label>
                    <label className="lh-temp__check">
                        <input type="checkbox" checked={canLogTime} onChange={(event) => setCanLogTime(event.target.checked)} />
                        <span>{t('legalHub.tempCanTime')}</span>
                    </label>
                    <label className="lh-temp__check">
                        <input type="checkbox" checked={canComment} onChange={(event) => setCanComment(event.target.checked)} />
                        <span>{t('legalHub.tempCanComments')}</span>
                    </label>
                </fieldset>
                <div className="lh-temp__denied">
                    <p>{t('legalHub.tempDenied')}</p>
                    <ul>
                        <li>{t('legalHub.tempNoFinance')}</li>
                        <li>{t('legalHub.tempNoAdmin')}</li>
                        <li>{t('legalHub.tempNoTeam')}</li>
                    </ul>
                </div>
                {error ? <p className="lh-temp__error" role="alert">{error}</p> : null}
                <div className="lh-temp__actions">
                    <button type="button" className="lh-temp__btn" onClick={onClose}>{t('legalHub.tempCancel')}</button>
                    <button type="submit" className="lh-temp__btn lh-temp__btn--primary">{t('legalHub.tempSave')}</button>
                </div>
            </form>
        </div>,
        document.body,
    );
}
