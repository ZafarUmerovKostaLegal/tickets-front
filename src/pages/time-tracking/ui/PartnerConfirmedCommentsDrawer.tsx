import { useEffect, useId, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { PartnerReportConfirmationRequest } from '@entities/time-tracking';
import { localeTag } from '@shared/i18n/ticketUi';

export type PartnerConfirmedReportComment = {
    id: string;
    authUserId: number;
    text: string;
    createdAt: string;
};

function fmtCommentWhen(iso: string, locale: 'ru' | 'en'): string {
    try {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime()))
            return iso;
        return d.toLocaleString(localeTag(locale), { dateStyle: 'short', timeStyle: 'short' });
    }
    catch {
        return iso;
    }
}

function userLabel(map: Map<number, string>, id: number): string {
    return map.get(id) ?? `ID ${id}`;
}

export function partnerConfirmedCommentsCountLabel(count: number, locale: 'ru' | 'en', labels: {
    zero: string;
    one: string;
    few: string;
    many: string;
}): string {
    if (count <= 0)
        return labels.zero;
    if (locale === 'ru') {
        const mod10 = count % 10;
        const mod100 = count % 100;
        if (mod10 === 1 && mod100 !== 11)
            return labels.one.replace('{count}', String(count));
        if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20))
            return labels.few.replace('{count}', String(count));
        return labels.many.replace('{count}', String(count));
    }
    return count === 1
        ? labels.one.replace('{count}', String(count))
        : labels.many.replace('{count}', String(count));
}

const IcoComment = () => (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
</svg>);

export function PartnerConfirmedCommentsCell({ count, preview, countLabel, openLabel, emptyLabel, onOpen, }: {
    count: number;
    preview: string | null;
    countLabel: string;
    openLabel: string;
    emptyLabel: string;
    onOpen: () => void;
}) {
    const hasComments = count > 0;
    return (<button type="button" className="tt-partner-confirmed__comments-btn" onClick={onOpen} aria-label={openLabel} title={openLabel}>
      <span className="tt-partner-confirmed__comments-btn-icon" aria-hidden>
        <IcoComment />
      </span>
      <span className="tt-partner-confirmed__comments-btn-body">
        <span className="tt-partner-confirmed__comments-btn-count">{hasComments ? countLabel : emptyLabel}</span>
        {preview ? <span className="tt-partner-confirmed__comments-btn-preview">{preview}</span> : null}
      </span>
    </button>);
}

export function PartnerConfirmedCommentsDrawer({ open, row, projectLabel, clientLabel, periodLabel, comments, usersById, locale, draft, onDraftChange, onAdd, onClose, labels, currentUserId, loading, submitting, error, allowCompose: allowComposeProp, }: {
    open: boolean;
    row: PartnerReportConfirmationRequest | null;
    projectLabel: string;
    clientLabel: string;
    periodLabel: string;
    comments: PartnerConfirmedReportComment[];
    usersById: Map<number, string>;
    locale: 'ru' | 'en';
    draft: string;
    onDraftChange: (value: string) => void;
    onAdd: () => void | Promise<void>;
    onClose: () => void;
    currentUserId: number | null;
    loading?: boolean;
    submitting?: boolean;
    error?: string | null;
    allowCompose?: boolean;
    labels: {
        title: string;
        empty: string;
        loading?: string;
        composePlaceholder: string;
        add: string;
        close: string;
        you: string;
        composeDisabledPartial?: string;
    };
}) {
    const uid = useId();
    const isSubmitting = Boolean(submitting);
    const isLoading = Boolean(loading);
    const status = String(row?.status || '').trim().toLowerCase();
    const canComposeByStatus = status === 'fully_confirmed' || status === 'pending_partners';
    const allowCompose = allowComposeProp ?? canComposeByStatus;

    useEffect(() => {
        if (!open)
            return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape')
                onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    const canSubmit = draft.trim().length > 0
        && currentUserId != null
        && !isSubmitting
        && !isLoading
        && allowCompose;

    const content = useMemo(() => {
        if (!open || !row)
            return null;
        const disabledPartial = !allowCompose ? labels.composeDisabledPartial : undefined;
        const submitIfAllowed = () => {
            if (!canSubmit)
                return;
            void onAdd();
        };
        return (<div className="tt-partner-confirmed__comments-drawer-ov" role="presentation" onClick={onClose}>
          <aside className="tt-partner-confirmed__comments-drawer" role="dialog" aria-modal="true" aria-labelledby={`${uid}-title`} onClick={(e) => e.stopPropagation()}>
            <header className="tt-partner-confirmed__comments-drawer-head">
              <div className="tt-partner-confirmed__comments-drawer-head-text">
                <h3 id={`${uid}-title`} className="tt-partner-confirmed__comments-drawer-title">{labels.title}</h3>
                <p className="tt-partner-confirmed__comments-drawer-sub">{projectLabel}</p>
                <p className="tt-partner-confirmed__comments-drawer-meta">
                  <span>{clientLabel}</span>
                  <span className="tt-partner-confirmed__comments-drawer-meta-sep" aria-hidden>·</span>
                  <span>{periodLabel}</span>
                </p>
              </div>
              <button type="button" className="tt-partner-confirmed__comments-drawer-close" onClick={onClose} aria-label={labels.close}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </header>

            <div className="tt-partner-confirmed__comments-drawer-body">
              {error ? (<p className="tt-reports__table-err tt-partner-confirmed__err" role="alert">{error}</p>) : null}
              {isLoading ? (<p className="tt-partner-confirmed__comments-drawer-empty">{labels.loading ?? labels.empty}</p>) : null}
              {!isLoading && comments.length === 0 ? (<p className="tt-partner-confirmed__comments-drawer-empty">{labels.empty}</p>) : null}
              {!isLoading && comments.length > 0 ? (<ul className="tt-partner-confirmed__comments-thread">
                  {comments.map((comment) => {
                const isYou = currentUserId != null && comment.authUserId === currentUserId;
                return (<li key={comment.id} className="tt-partner-confirmed__comments-item">
                      <div className="tt-partner-confirmed__comments-item-head">
                        <span className="tt-partner-confirmed__comments-item-author">
                          {userLabel(usersById, comment.authUserId)}
                          {isYou ? <span className="tt-partner-confirmed__comments-item-you">{labels.you}</span> : null}
                        </span>
                        <time className="tt-partner-confirmed__comments-item-when" dateTime={comment.createdAt}>{fmtCommentWhen(comment.createdAt, locale)}</time>
                      </div>
                      <p className="tt-partner-confirmed__comments-item-text">{comment.text}</p>
                    </li>);
            })}
                </ul>) : null}
            </div>

            <footer className="tt-partner-confirmed__comments-drawer-foot">
              {disabledPartial ? (<p className="tt-partner-confirmed__comments-drawer-hint">{disabledPartial}</p>) : null}
              <label className="tt-partner-confirmed__comments-compose-label" htmlFor={`${uid}-compose`}>{labels.composePlaceholder}</label>
              <textarea
                id={`${uid}-compose`}
                className="tt-partner-confirmed__comments-compose"
                rows={3}
                value={draft}
                onChange={(e) => onDraftChange(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing)
                        return;
                    e.preventDefault();
                    submitIfAllowed();
                }}
                placeholder={labels.composePlaceholder}
                spellCheck
                disabled={currentUserId == null || isSubmitting || !allowCompose}
              />
              <div className="tt-partner-confirmed__comments-drawer-actions">
                <button type="button" className="tt-reports__btn tt-reports__btn--outline" onClick={onClose}>{labels.close}</button>
                <button type="button" className="tt-reports__btn tt-reports__btn--accent" disabled={!canSubmit} onClick={submitIfAllowed}>
                  {labels.add}
                </button>
              </div>
            </footer>
          </aside>
        </div>);
    }, [allowCompose, canSubmit, clientLabel, comments, currentUserId, draft, error, isLoading, isSubmitting, labels, locale, onAdd, onClose, onDraftChange, open, periodLabel, projectLabel, row, uid, usersById]);

    return typeof document !== 'undefined' && content ? createPortal(content, document.body) : null;
}
