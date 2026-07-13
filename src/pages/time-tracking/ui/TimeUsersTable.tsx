import { useRef, useEffect } from 'react';
import type { TimeUserRow } from '@entities/time-tracking/model/types';
import { useI18n } from '@shared/i18n';
import { TimeUserRow as TimeUserRowComponent } from './TimeUserRow';

type TimeUsersTableProps = {
    users: TimeUserRow[];
    openActionsId: string | null;
    onActionsOpen: (id: string) => void;
    onActionsClose: () => void;
    onOpenProjectAccess?: (user: TimeUserRow) => void;
};

export function TimeUsersTable({ users, openActionsId, onActionsOpen, onActionsClose, onOpenProjectAccess, }: TimeUsersTableProps) {
    const { t } = useI18n();
    const actionsMenuRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (openActionsId == null)
            return;
        const onDocClick = (e: MouseEvent) => {
            if (actionsMenuRef.current?.contains(e.target as Node))
                return;
            onActionsClose();
        };
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, [openActionsId, onActionsClose]);
    useEffect(() => {
        const onEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape')
                onActionsClose();
        };
        window.addEventListener('keydown', onEscape);
        return () => window.removeEventListener('keydown', onEscape);
    }, [onActionsClose]);
    return (<section className="time-users__table-section time-users__table-section--animate">
      <div className="time-users__table-head">
        <div className="time-users__table-head-user">
          <span className="time-users__col-label">{t('timeTrackingPage.users.table.employee')}</span>
        </div>
        <div className="time-users__table-cols">
          <span className="time-users__col time-users__col--hours">{t('timeTrackingPage.users.table.hours')}</span>
          <span className="time-users__col time-users__col--util">{t('timeTrackingPage.users.table.utilization')}</span>
          <span className="time-users__col time-users__col--cap" title={t('timeTrackingPage.users.table.capacityTitle')}>
            {t('timeTrackingPage.users.table.capacityPerWeek')}
          </span>
          <span className="time-users__col time-users__col--billable">{t('timeTrackingPage.users.table.billableHours')}</span>
          <span className="time-users__col time-users__col--actions" aria-hidden/>
        </div>
      </div>
      <div className="time-users__table-body">
        {users.map((user, idx) => (<TimeUserRowComponent key={user.id} user={user} index={idx} isActionsOpen={openActionsId === user.id} onActionsToggle={onActionsOpen} onActionsClose={onActionsClose} actionsMenuRef={actionsMenuRef} onOpenProjectAccess={onOpenProjectAccess}/>))}
      </div>
    </section>);
}
