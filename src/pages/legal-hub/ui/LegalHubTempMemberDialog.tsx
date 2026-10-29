import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TimeTrackingTeamRow } from '@entities/time-tracking/api/domains/teamsAndLabor';
import { useI18n } from '@shared/i18n';

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
    const [query, setQuery] = useState('');
    const [userId, setUserId] = useState<number | null>(null);
    const [accessUntil, setAccessUntil] = useState('');
    const [canLogTime, setCanLogTime] = useState(true);
    const [canComment, setCanComment] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const minDate = todayIso();
    const taken = new Set(takenByTeam[teamId] ?? []);
    const needle = query.trim().toLowerCase();
    const options = employees.filter((person) => {
        if (taken.has(person.id))
            return false;
        if (person.id === userId)
            return true;
        if (!needle)
            return true;
        return `${person.name} ${person.email} ${person.position}`.toLowerCase().includes(needle);
    });
    const picked = employees.find((person) => person.id === userId && !taken.has(person.id)) ?? null;

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key !== 'Escape')
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
                    <label className="lh-temp__field">
                        <span>{t('legalHub.tempTeam')}</span>
                        <select value={teamId} onChange={(event) => { setTeamId(event.target.value); setUserId(null); }}>
                            {teams.map((team) => (
                                <option key={team.id} value={team.id}>{team.name}</option>
                            ))}
                        </select>
                    </label>
                ) : null}
                <label className="lh-temp__field">
                    <span>{t('legalHub.tempEmployee')}</span>
                    <input
                        autoFocus
                        type="search"
                        value={query}
                        placeholder={t('legalHub.tempEmployeeSearch')}
                        onChange={(event) => setQuery(event.target.value)}
                        aria-label={t('legalHub.tempEmployeeSearch')}
                    />
                    <select
                        value={picked ? String(picked.id) : ''}
                        onChange={(event) => setUserId(event.target.value ? Number(event.target.value) : null)}
                    >
                        <option value="">{options.length === 0 ? t('legalHub.tempEmployeeEmpty') : t('legalHub.tempEmployee')}</option>
                        {options.map((person) => (
                            <option key={person.id} value={person.id}>
                                {person.position ? `${person.name} — ${person.position}` : person.name}
                            </option>
                        ))}
                    </select>
                </label>
                {picked ? <p className="lh-temp__picked">{picked.email}</p> : null}
                <label className="lh-temp__field">
                    <span>{t('legalHub.tempUntil')}</span>
                    <input
                        type="date"
                        min={minDate}
                        value={accessUntil}
                        onChange={(event) => setAccessUntil(event.target.value)}
                    />
                </label>
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
