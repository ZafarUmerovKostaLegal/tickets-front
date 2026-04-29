import { useRef, useEffect } from 'react';
import type { TimeUserRow } from '@entities/time-tracking/model/types';
import { TimeUserRow as TimeUserRowComponent } from './TimeUserRow';
type TimeUsersTableProps = {
    users: TimeUserRow[];
    openActionsId: string | null;
    onActionsOpen: (id: string) => void;
    onActionsClose: () => void;
    onOpenProjectAccess?: (user: TimeUserRow) => void;
};
export function TimeUsersTable({ users, openActionsId, onActionsOpen, onActionsClose, onOpenProjectAccess, }: TimeUsersTableProps) {
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
          <span className="time-users__col-label">Сотрудник</span>
        </div>
        <div className="time-users__table-cols">
          <span className="time-users__col time-users__col--hours">Часы</span>
          <span className="time-users__col time-users__col--util">Загрузка</span>
          <span className="time-users__col time-users__col--cap" title="Норма часов в неделю">
            Ч/нед
          </span>
          <span className="time-users__col time-users__col--billable">Оплачиваемые часы</span>
          <span className="time-users__col time-users__col--actions" aria-hidden/>
        </div>
      </div>
      <div className="time-users__table-body">
        {users.map((user, idx) => (<TimeUserRowComponent key={user.id} user={user} index={idx} isActionsOpen={openActionsId === user.id} onActionsToggle={onActionsOpen} onActionsClose={onActionsClose} actionsMenuRef={actionsMenuRef} onOpenProjectAccess={onOpenProjectAccess}/>))}
      </div>
    </section>);
}
