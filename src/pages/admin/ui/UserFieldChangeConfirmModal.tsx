import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { User } from '@entities/user';
import type { AdminUserFieldPendingConfirm } from '../model/AdminContext.types';
import type { TTRole } from '../model/constants';
type Props = {
    pending: AdminUserFieldPendingConfirm;
    ttRoleOptions: {
        value: TTRole;
        label: string;
        color: string;
        bg: string;
        border: string;
    }[];
    savingUserId: number | null;
    onConfirm: () => void;
    onDismiss: () => void;
};
function ttLabel(opts: Props['ttRoleOptions'], v: TTRole): string {
    return opts.find((o) => o.value === v)?.label ?? '—';
}
export function UserFieldChangeConfirmModal({ pending, ttRoleOptions, savingUserId, onConfirm, onDismiss, }: Props) {
    useEffect(() => {
        if (!pending)
            return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape')
                onDismiss();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [pending, onDismiss]);
    if (!pending)
        return null;
    const user: User = pending.user;
    const busy = savingUserId === user.id;
    const title = pending.kind === 'role' ? 'Смена роли' : 'Смена роли в учёте времени';
    const body = pending.kind === 'role' ? (<>
        <p className="ap__modal-desc ap__modal-desc--confirm">
          Изменить роль пользователя <strong>{user.display_name || user.email}</strong>?
        </p>
        <div className="ap__modal-row ap__modal-row--col">
          <span className="ap__modal-lbl">Было</span>
          <span className="ap__modal-val">{user.role || '—'}</span>
        </div>
        <div className="ap__modal-row ap__modal-row--col">
          <span className="ap__modal-lbl">Будет</span>
          <span className="ap__modal-val ap__modal-val--accent">{pending.newRole}</span>
        </div>
      </>) : (<>
        <p className="ap__modal-desc ap__modal-desc--confirm">
          Изменить роль в учёте времени для <strong>{user.display_name || user.email}</strong>?
        </p>
        <div className="ap__modal-row ap__modal-row--col">
          <span className="ap__modal-lbl">Было</span>
          <span className="ap__modal-val">{ttLabel(ttRoleOptions, user.time_tracking_role ?? null)}</span>
        </div>
        <div className="ap__modal-row ap__modal-row--col">
          <span className="ap__modal-lbl">Будет</span>
          <span className="ap__modal-val ap__modal-val--accent">
            {ttLabel(ttRoleOptions, pending.newTtRole)}
          </span>
        </div>
      </>);
    return createPortal(<div className="ap__overlay" role="presentation" onClick={() => { if (!busy)
        onDismiss(); }}>
      <div className="ap__modal ap__modal--confirm" role="dialog" aria-modal="true" aria-labelledby="ap-user-field-confirm-title" onClick={(e) => e.stopPropagation()}>
        <div className="ap__modal-head">
          <h3 id="ap-user-field-confirm-title" className="ap__modal-title">
            {title}
          </h3>
          <button type="button" className="ap__modal-close" aria-label="Закрыть" disabled={busy} onClick={onDismiss}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="ap__modal-body">{body}</div>
        <div className="ap__modal-foot">
          <button type="button" className="ap__btn ap__btn--ghost" disabled={busy} onClick={onDismiss}>
            Отмена
          </button>
          <button type="button" className="ap__btn ap__btn--primary" disabled={busy} onClick={() => void onConfirm()}>
            {busy ? 'Сохранение…' : 'Подтвердить'}
          </button>
        </div>
      </div>
    </div>, document.body);
}
