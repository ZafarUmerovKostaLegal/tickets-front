import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useI18n } from '@shared/i18n';
import { useCurrentUser } from '@shared/hooks';
import { listTimeTrackingTeams, type TimeTrackingTeamRow } from '@entities/time-tracking/api/domains/teamsAndLabor';

export type FileManagerAllFilesHandle = {
    openUpload: () => void;
    openCreateFolder: () => void;
};

type Props = {
    canManage: boolean;
};

function TeamIcon() {
    return (
        <span className="fm-all__practice-icon" aria-hidden>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M4 8.5h7l1.5-2H20v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" />
            </svg>
        </span>
    );
}

function memberCount(team: TimeTrackingTeamRow): number {
    if (team.member_auth_user_ids.length > 0)
        return team.member_auth_user_ids.length;
    return team.members?.length ?? 0;
}

function isUserOnTeam(team: TimeTrackingTeamRow, userId: number): boolean {
    if (team.partner_auth_user_id === userId)
        return true;
    if (team.member_auth_user_ids.includes(userId))
        return true;
    return (team.members ?? []).some((member) => member.auth_user_id === userId);
}

export const FileManagerAllFiles = forwardRef<FileManagerAllFilesHandle, Props>(function FileManagerAllFiles({ canManage }, ref) {
    const { t } = useI18n();
    const { user } = useCurrentUser();
    const fileRef = useRef<HTMLInputElement>(null);
    const [teams, setTeams] = useState<TimeTrackingTeamRow[]>([]);
    const [loadingTeams, setLoadingTeams] = useState(true);
    const [teamsError, setTeamsError] = useState(false);

    useImperativeHandle(ref, () => ({
        openUpload: () => fileRef.current?.click(),
        openCreateFolder: () => fileRef.current?.click(),
    }), []);

    useEffect(() => {
        let cancelled = false;
        setLoadingTeams(true);
        setTeamsError(false);
        void listTimeTrackingTeams()
            .then((rows) => {
                if (cancelled)
                    return;
                setTeams(rows.filter((team) => !team.is_archived));
            })
            .catch(() => {
                if (!cancelled) {
                    setTeams([]);
                    setTeamsError(true);
                }
            })
            .finally(() => {
                if (!cancelled)
                    setLoadingTeams(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const visibleTeams = useMemo(() => {
        if (canManage)
            return teams;
        const userId = user?.id;
        if (userId == null)
            return [];
        return teams.filter((team) => isUserOnTeam(team, userId));
    }, [canManage, teams, user?.id]);

    const memberTotal = visibleTeams.reduce((sum, team) => sum + memberCount(team), 0);
    const meta = canManage
        ? t('fileManager.allMetaAdmin')
            .replace('{teams}', String(visibleTeams.length))
            .replace('{members}', String(memberTotal))
        : t('fileManager.allMetaEmployee')
            .replace('{team}', visibleTeams[0]?.name ?? t('fileManager.teams'))
            .replace('{members}', String(memberTotal));

    return (
        <div className="fm-all">
            <div className="fm-all__top">
                <div className="fm-all__intro">
                    <h2 className="fm-all__title">{t('fileManager.all')}</h2>
                    <p className="fm-all__meta">{meta}</p>
                </div>
                <input ref={fileRef} className="fm-all__file" type="file" multiple />
            </div>

            {canManage ? (
                <section className="fm-all__stats" aria-label={t('fileManager.statsAria')}>
                    <article className="fm-all__stat">
                        <span>{t('fileManager.statFiles')}</span>
                        <strong>48 213</strong>
                        <small className="is-up">+312 {t('fileManager.statWeek')}</small>
                    </article>
                    <article className="fm-all__stat">
                        <span>{t('fileManager.statLinks')}</span>
                        <strong>126</strong>
                        <small>12 {t('fileManager.statExternal')} · 2 {t('fileManager.statNoPassword')}</small>
                    </article>
                    <article className="fm-all__stat">
                        <span>{t('fileManager.statRequests')}</span>
                        <strong>7</strong>
                        <small className="is-warn">3 {t('fileManager.statWaiting')}</small>
                    </article>
                    <article className="fm-all__stat">
                        <span>{t('fileManager.statRejected')}</span>
                        <strong>18</strong>
                        <button type="button" className="fm-all__stat-link">{t('fileManager.statLog')}</button>
                    </article>
                </section>
            ) : null}

            <div className="fm-all__layout">
                <div className="fm-all__main">
                    <section className="fm-all__section">
                        <div className="fm-all__section-head">
                            <h3>{t('fileManager.teams')}</h3>
                            {canManage ? <button type="button" className="fm-all__text-btn">{t('fileManager.openTree')}</button> : null}
                        </div>
                        {loadingTeams ? (
                            <p className="fm-all__empty-inline">{t('fileManager.teamsLoading')}</p>
                        ) : teamsError ? (
                            <p className="fm-all__empty-inline" role="alert">{t('fileManager.teamsError')}</p>
                        ) : visibleTeams.length === 0 ? (
                            <p className="fm-all__empty-inline">{t('fileManager.teamsEmpty')}</p>
                        ) : (
                            <div className={`fm-all__practices${visibleTeams.length === 1 ? ' is-single' : ''}`}>
                                {visibleTeams.map((team) => {
                                    const count = memberCount(team);
                                    const lead = (team.partner_display_name || '').trim() || t('fileManager.teamLeadUnknown');
                                    return (
                                        <button key={team.id} type="button" className="fm-all__practice">
                                            <div className="fm-all__practice-top">
                                                <TeamIcon />
                                                <em className="fm-all__badge is-ok">{t('fileManager.teamActive')}</em>
                                            </div>
                                            <strong>{team.name}</strong>
                                            <small>{count} {t('fileManager.members')}</small>
                                            <small className="fm-all__lead">{lead}</small>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
});
