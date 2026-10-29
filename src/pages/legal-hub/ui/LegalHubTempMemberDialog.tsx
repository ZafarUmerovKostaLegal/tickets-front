import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TimeTrackingTeamRow } from '@entities/time-tracking/api/domains/teamsAndLabor';
import { useI18n } from '@shared/i18n';

export type TempTeamRef = {
    id: TimeTrackingTeamRow['id'];
    name: string;
};

export type TempMemberDraft = {
    teamId: TempTeamRef['id'];
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

function isEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function LegalHubTempMemberDialog({ teams, onClose, onCreate }: {
    teams: TempTeamRef[];
    onClose: () => void;
    onCreate: (draft: TempMemberDraft) => void;
}) {
    const { t } = useI18n();
    const formId = useId();
    const [teamId, setTeamId] = useState(teams[0]?.id ?? '');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [position, setPosition] = useState('');
    const [accessUntil, setAccessUntil] = useState('');
    const [canLogTime, setCanLogTime] = useState(true);
    const [canComment, setCanComment] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const minDate = todayIso();

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
        const trimmedName = name.trim();
        const trimmedEmail = email.trim();
        if (!trimmedName) {
            setError(t('legalHub.tempNameRequired'));
            return;
        }
        if (!isEmail(trimmedEmail)) {
            setError(t('legalHub.tempEmailInvalid'));
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
            name: trimmedName,
            email: trimmedEmail,
            position: position.trim() || t('legalHub.tempPositionDefault'),
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
                        <select value={teamId} onChange={(event) => setTeamId(event.target.value)}>
                            {teams.map((team) => (
                                <option key={team.id} value={team.id}>{team.name}</option>
                            ))}
                        </select>
                    </label>
                ) : null}
                <label className="lh-temp__field">
                    <span>{t('legalHub.tempName')}</span>
                    <input
                        autoFocus
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        autoComplete="name"
                    />
                </label>
                <label className="lh-temp__field">
                    <span>{t('legalHub.tempEmail')}</span>
                    <input
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        autoComplete="email"
                        inputMode="email"
                    />
                </label>
                <div className="lh-temp__row">
                    <label className="lh-temp__field">
                        <span>{t('legalHub.tempPosition')}</span>
                        <input
                            value={position}
                            placeholder={t('legalHub.tempPositionDefault')}
                            onChange={(event) => setPosition(event.target.value)}
                        />
                    </label>
                    <label className="lh-temp__field">
                        <span>{t('legalHub.tempUntil')}</span>
                        <input
                            type="date"
                            min={minDate}
                            value={accessUntil}
                            onChange={(event) => setAccessUntil(event.target.value)}
                        />
                    </label>
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
