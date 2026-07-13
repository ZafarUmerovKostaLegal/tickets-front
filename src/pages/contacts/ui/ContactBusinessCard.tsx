import type { ContactCard } from '../lib/contactsModel';
import { contactAvatarColor, contactInitials, mailHref, telHref } from '../lib/contactsModel';

export type ContactBusinessCardProps = {
    card: ContactCard;
    youBadge?: string;
    primaryBadge?: string;
    saveLabel?: string;
    isYou?: boolean;
    onSave?: () => void;

    preview?: boolean;
};

function IconPhone() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
    );
}

function IconMail() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
        </svg>
    );
}

export function ContactBusinessCard({
    card,
    youBadge,
    primaryBadge,
    saveLabel,
    isYou,
    onSave,
    preview = false,
}: ContactBusinessCardProps) {
    const tel = card.phone ? telHref(card.phone) : null;
    const mail = card.email ? mailHref(card.email) : null;
    const canSave = Boolean(onSave && (card.phone || card.email));

    return (
        <article className={`contacts-card contacts-card--${card.kind}${preview ? ' contacts-card--preview' : ''}`}>
            <div className="contacts-card__accent" style={{ background: contactAvatarColor(card.name) }} aria-hidden />
            <div className="contacts-card__body">
                <div className="contacts-card__head">
                    {card.picture ? (
                        <img className="contacts-card__avatar contacts-card__avatar--photo" src={card.picture} alt="" />
                    ) : (
                        <span
                            className="contacts-card__avatar"
                            style={{ background: contactAvatarColor(card.name) }}
                            aria-hidden
                        >
                            {contactInitials(card.name)}
                        </span>
                    )}
                    <div className="contacts-card__identity">
                        <h3 className="contacts-card__name">
                            {card.name}
                            {isYou && youBadge ? <span className="contacts-card__you">{youBadge}</span> : null}
                        </h3>
                        {card.subtitle ? <p className="contacts-card__subtitle">{card.subtitle}</p> : null}
                        {card.isPrimary && primaryBadge ? (
                            <span className="contacts-card__badge">{primaryBadge}</span>
                        ) : null}
                    </div>
                </div>

                <ul className="contacts-card__rows">
                    {card.phone ? (
                        <li className="contacts-card__row">
                            <span className="contacts-card__row-icon"><IconPhone /></span>
                            {tel ? (
                                <a className="contacts-card__row-link" href={tel}>{card.phone}</a>
                            ) : (
                                <span className="contacts-card__row-text">{card.phone}</span>
                            )}
                        </li>
                    ) : null}
                    {card.email ? (
                        <li className="contacts-card__row">
                            <span className="contacts-card__row-icon"><IconMail /></span>
                            {mail ? (
                                <a className="contacts-card__row-link" href={mail}>{card.email}</a>
                            ) : (
                                <span className="contacts-card__row-text">{card.email}</span>
                            )}
                        </li>
                    ) : null}
                </ul>

                {canSave && !preview ? (
                    <button type="button" className="contacts-card__save" onClick={onSave}>
                        {saveLabel}
                    </button>
                ) : null}
            </div>
        </article>
    );
}
