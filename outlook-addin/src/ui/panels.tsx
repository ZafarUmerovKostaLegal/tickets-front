import { useState, type ReactNode } from 'react';
import type { DocRow, Filing, Location } from '../api';
import type { SuggestedLocation } from '../explorer';
import { filedSummary, reasonLabel } from '../explorer';
import type { AttachmentInfo, ItemInfo } from '../mailbox';
import { locationLabel } from '../naming';
import type { FilingRule, RecentTarget } from '../settings';
import { Icon, type IconName } from './icons';

export function formatDate(value: string | null | undefined): string {
  if (!value)
    return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime()))
    return '';
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
}

export function formatSize(bytes: number): string {
  if (bytes < 1024)
    return `${bytes} Б`;
  if (bytes < 1024 * 1024)
    return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

export function Section({ title, icon, aside, children, className }: { title: string; icon?: IconName; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`kf-section${className ? ` ${className}` : ''}`}>
      <header className="kf-section__head">
        <h2>{icon ? <Icon name={icon} size={14} /> : null}{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  );
}

export function LocationText({ location, compact = false, badge }: {
  location: Pick<Location, 'clientName' | 'matterName' | 'matterCode' | 'folderPath'>;
  compact?: boolean;
  badge?: ReactNode;
}) {
  const folders = location.folderPath.map((crumb) => crumb.name);
  return (
    <span className="kf-loc" title={locationLabel(location)}>
      <span className="kf-loc__matter">
        {location.matterCode ? <span className="kf-code">{location.matterCode}</span> : null}
        {location.matterName}
      </span>
      {!compact && location.clientName ? <span className="kf-loc__client">{location.clientName}</span> : null}
      <span className="kf-loc__line">
        <span className="kf-loc__path">{folders.length ? folders.join(' / ') : 'корень matter'}</span>
        {badge}
      </span>
    </span>
  );
}

/** Current message + where it is already filed. */
export function MailCard({ item, filings, loading, onOpen }: {
  item: ItemInfo;
  filings: Filing[];
  loading: boolean;
  onOpen: (filing: Filing) => void;
}) {
  const { message, thread } = filedSummary(filings);
  const [showAll, setShowAll] = useState(false);
  const rows = showAll ? message : message.slice(0, 2);
  return (
    <section className="kf-mail" aria-label="Текущее письмо">
      <div className="kf-mail__top">
        <span className={`kf-badge ${message.length ? 'is-filed' : 'is-new'}`}>
          <Icon name={message.length ? 'check' : 'mail'} size={12} />
          {loading ? 'Проверяем…' : message.length ? 'Сохранено' : 'Не сохранено'}
        </span>
        <span className="kf-mail__date">{formatDate(item.received)}</span>
      </div>
      <p className="kf-mail__subject">{item.subject}</p>
      <p className="kf-mail__from">{item.fromName}{item.fromEmail && item.fromEmail !== item.fromName ? <span> · {item.fromEmail}</span> : null}</p>
      {rows.length ? (
        <ul className="kf-filed">
          {rows.map((filing) => (
            <li key={`${filing.documentId}-${filing.kind}`}>
              <button type="button" className="kf-filed__row" onClick={() => onOpen(filing)} title="Открыть в Kosta Hub">
                <Icon name={filing.kind === 'thread' ? 'thread' : filing.kind === 'attachment' ? 'clip' : 'mail'} size={14} />
                <LocationText location={filing} compact />
                <span className="kf-filed__meta">{filing.filedBy} · {formatDate(filing.filedAt)}</span>
                <Icon name="open" size={13} className="kf-filed__open" />
              </button>
            </li>
          ))}
          {message.length > 2 ? (
            <li><button type="button" className="kf-link" onClick={() => setShowAll(!showAll)}>{showAll ? 'Свернуть' : `Ещё ${message.length - 2}`}</button></li>
          ) : null}
        </ul>
      ) : null}
      {!message.length && thread.length ? (
        <p className="kf-mail__thread">
          <Icon name="thread" size={13} />
          Переписка уже есть в <strong>{thread[0]!.matterName}</strong>{thread.length > 1 ? ` и ещё ${thread.length - 1}` : ''}
        </p>
      ) : null}
    </section>
  );
}

export function Suggestions({ items, sender, selectedKey, onPick, onQuickFile, busy }: {
  items: SuggestedLocation[];
  sender: string;
  selectedKey: string | null;
  onPick: (location: SuggestedLocation) => void;
  onQuickFile: (location: SuggestedLocation) => void;
  busy: boolean;
}) {
  if (!items.length)
    return null;
  return (
    <Section title="Куда обычно сохраняют" icon="spark" className="kf-suggest">
      <ul className="kf-suggest__list">
        {items.map((item) => {
          const key = `${item.matterId}|${item.folderId ?? ''}`;
          return (
            <li key={key} className={`kf-suggest__item${selectedKey === key ? ' is-selected' : ''}`}>
              <button type="button" className="kf-suggest__pick" onClick={() => onPick(item)} aria-pressed={selectedKey === key}>
                <LocationText location={item} compact badge={<span className={`kf-reason kf-reason--${item.reason}`}>{reasonLabel(item, sender)}</span>} />
              </button>
              <button
                type="button"
                className="kf-iconbtn kf-suggest__go"
                disabled={busy || item.filedHere}
                onClick={() => onQuickFile(item)}
                title={item.filedHere ? 'Уже сохранено сюда' : 'Сохранить письмо сюда'}
                aria-label={item.filedHere ? 'Уже сохранено сюда' : `Сохранить письмо в ${item.matterName}`}
              >
                <Icon name={item.filedHere ? 'check' : 'upload'} size={15} />
              </button>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

export type FileOptions = {
  message: boolean;
  thread: boolean;
  attachments: string[];
  comment: string;
};

/** Sticky bottom bar: chosen location, what to save, Save. */
export function FileBar({ target, item, options, setOptions, busy, alreadyHere, onSave, onClear, onRule, ruleFor }: {
  target: Location | null;
  item: ItemInfo;
  options: FileOptions;
  setOptions: (next: FileOptions) => void;
  busy: boolean;
  alreadyHere: boolean;
  onSave: () => void;
  onClear: () => void;
  onRule: (match: string, autoFile: boolean) => void;
  ruleFor: FilingRule | null;
}) {
  const [more, setMore] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [ruleOpen, setRuleOpen] = useState(false);
  const [ruleScope, setRuleScope] = useState<'sender' | 'domain'>('domain');
  const [ruleAuto, setRuleAuto] = useState(false);
  const domain = item.fromEmail.includes('@') ? item.fromEmail.split('@')[1]! : '';
  const toggleAttachment = (attachment: AttachmentInfo) => {
    const set = new Set(options.attachments);
    if (set.has(attachment.id))
      set.delete(attachment.id);
    else
      set.add(attachment.id);
    setOptions({ ...options, attachments: [...set] });
  };
  const onlyAttachments = !options.message && !options.thread;
  const nothing = !options.message && !options.thread && !options.attachments.length;
  const count = (options.thread || options.message ? 1 : 0) + options.attachments.length;

  return (
    <div className="kf-filebar" role="region" aria-label="Сохранение">
      <div className="kf-filebar__target">
        {target ? (
          <>
            <Icon name="folder" className="kf-filebar__glyph" />
            <LocationText location={target} />
            <button type="button" className="kf-iconbtn" aria-label="Сбросить выбор" onClick={onClear}><Icon name="close" size={13} /></button>
          </>
        ) : (
          <p className="kf-filebar__placeholder">Выберите папку в дереве или подсказку выше</p>
        )}
      </div>

      <div className="kf-filebar__what" role="group" aria-label="Что сохранить">
        <label className={`kf-chip${options.message && !options.thread ? ' is-on' : ''}`}>
          <input type="radio" name="kf-what" checked={options.message && !options.thread} onChange={() => setOptions({ ...options, message: true, thread: false })} />
          <Icon name="mail" size={13} />Письмо
        </label>
        <label className={`kf-chip${options.thread ? ' is-on' : ''}`}>
          <input type="radio" name="kf-what" checked={options.thread} onChange={() => setOptions({ ...options, message: false, thread: true })} />
          <Icon name="thread" size={13} />Вся переписка
        </label>
        <label className={`kf-chip${!options.message && !options.thread ? ' is-on' : ''}`}>
          <input type="radio" name="kf-what" checked={!options.message && !options.thread} onChange={() => setOptions({ ...options, message: false, thread: false })} />
          Только вложения
        </label>
      </div>

      {item.attachments.length ? (
        <button
          type="button"
          className="kf-attach__toggle"
          aria-expanded={attachOpen || onlyAttachments}
          onClick={() => setAttachOpen(!attachOpen)}
        >
          <Icon name="chevron" size={12} className={attachOpen || onlyAttachments ? 'is-open' : ''} />
          <Icon name="clip" size={13} />
          Вложения отдельными файлами
          <span className="kf-attach__count">{options.attachments.length} из {item.attachments.length}</span>
        </button>
      ) : null}
      {item.attachments.length && (attachOpen || onlyAttachments) ? (
        <ul className="kf-attach" aria-label="Вложения">
          {item.attachments.map((attachment) => (
            <li key={attachment.id}>
              <label className="kf-check">
                <input type="checkbox" checked={options.attachments.includes(attachment.id)} onChange={() => toggleAttachment(attachment)} />
                <Icon name="clip" size={13} />
                <span className="kf-attach__name">{attachment.name}</span>
                <span className="kf-attach__size">{formatSize(attachment.size)}</span>
              </label>
            </li>
          ))}
        </ul>
      ) : null}

      {more ? (
        <label className="kf-field">
          <span>Комментарий к версии</span>
          <input className="kf-input" value={options.comment} maxLength={300} placeholder="Например: договор, финальная редакция" onChange={(event) => setOptions({ ...options, comment: event.target.value })} />
        </label>
      ) : null}

      {ruleOpen && target ? (
        <div className="kf-rulebox">
          <p>Всегда предлагать эту папку для писем</p>
          <div className="kf-filebar__what">
            {domain ? (
              <label className={`kf-chip${ruleScope === 'domain' ? ' is-on' : ''}`}>
                <input type="radio" name="kf-rule" checked={ruleScope === 'domain'} onChange={() => setRuleScope('domain')} />
                от @{domain}
              </label>
            ) : null}
            <label className={`kf-chip${ruleScope === 'sender' || !domain ? ' is-on' : ''}`}>
              <input type="radio" name="kf-rule" checked={ruleScope === 'sender' || !domain} onChange={() => setRuleScope('sender')} />
              от {item.fromEmail}
            </label>
          </div>
          <label className="kf-check">
            <input type="checkbox" checked={ruleAuto} onChange={(event) => setRuleAuto(event.target.checked)} />
            Сохранять автоматически, пока панель открыта
          </label>
          <div className="kf-row">
            <button type="button" className="kf-btn kf-btn--primary" onClick={() => {
              onRule(ruleScope === 'domain' && domain ? `@${domain}` : item.fromEmail, ruleAuto);
              setRuleOpen(false);
            }}>Создать правило</button>
            <button type="button" className="kf-btn" onClick={() => setRuleOpen(false)}>Отмена</button>
          </div>
        </div>
      ) : null}

      <div className="kf-filebar__actions">
        <button type="button" className="kf-btn kf-btn--primary kf-btn--wide" disabled={!target || busy || nothing} onClick={onSave}>
          <Icon name="upload" size={15} />
          {busy ? 'Сохраняем…' : alreadyHere && options.message && !options.thread ? 'Сохранить ещё раз' : count > 1 ? `Сохранить (${count})` : 'Сохранить'}
        </button>
        <button type="button" className={`kf-iconbtn kf-iconbtn--box${more ? ' is-on' : ''}`} aria-label="Комментарий" title="Комментарий" aria-pressed={more} onClick={() => setMore(!more)}>
          <Icon name="doc" size={15} />
        </button>
        {item.fromEmail ? (
          <button
            type="button"
            className={`kf-iconbtn kf-iconbtn--box${ruleOpen ? ' is-on' : ''}`}
            aria-label="Правило для отправителя"
            title={ruleFor ? `Правило: ${ruleFor.match}` : 'Правило для отправителя'}
            disabled={!target}
            aria-pressed={ruleOpen}
            onClick={() => setRuleOpen(!ruleOpen)}
          >
            <Icon name="rule" size={15} />
          </button>
        ) : null}
      </div>
      {alreadyHere ? <p className="kf-filebar__note">Письмо уже есть в этой папке — повторное сохранение создаст новую версию.</p> : null}
    </div>
  );
}

export function DocList({ docs, empty, compose, onOpen, onAttach, onLink, onLocate, busy }: {
  docs: DocRow[];
  empty: string;
  compose: boolean;
  onOpen: (doc: DocRow) => void;
  onAttach?: (doc: DocRow) => void;
  onLink?: (doc: DocRow) => void;
  onLocate?: (doc: DocRow) => void;
  busy: boolean;
}) {
  if (!docs.length)
    return <p className="kf-empty">{empty}</p>;
  return (
    <ul className="kf-docs">
      {docs.map((doc) => (
        <li key={doc.id} className="kf-docs__item">
          <Icon name={doc.kind === 'email' || /\.eml$/i.test(doc.name) ? 'mail' : 'doc'} className="kf-docs__glyph" />
          <div className="kf-docs__body">
            <span className="kf-docs__name" title={doc.name}>{doc.name}</span>
            <span className="kf-docs__meta">
              {doc.docNumber}{doc.version > 1 ? ` · v${doc.version}` : ''} · {formatDate(doc.updatedAt)}
              {onLocate ? <> · <button type="button" className="kf-link" onClick={() => onLocate(doc)}>{doc.matterName}</button></> : null}
              {doc.checkedOutBy ? ` · у ${doc.checkedOutBy}` : ''}
            </span>
          </div>
          <span className="kf-docs__tools">
            {compose && onAttach ? (
              <button type="button" className="kf-iconbtn" disabled={busy} title="Вложить в письмо" aria-label={`Вложить ${doc.name}`} onClick={() => onAttach(doc)}><Icon name="clip" size={14} /></button>
            ) : null}
            {compose && onLink ? (
              <button type="button" className="kf-iconbtn" disabled={busy} title="Вставить ссылку" aria-label={`Ссылка на ${doc.name}`} onClick={() => onLink(doc)}><Icon name="link" size={14} /></button>
            ) : null}
            <button type="button" className="kf-iconbtn" title="Открыть в Kosta Hub" aria-label={`Открыть ${doc.name}`} onClick={() => onOpen(doc)}><Icon name="open" size={14} /></button>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function PlaceList({ places, selectedKey, onPick, empty }: {
  places: Array<Location & { key: string; icon: IconName; meta?: string }>;
  selectedKey: string | null;
  onPick: (location: Location) => void;
  empty: string;
}) {
  if (!places.length)
    return <p className="kf-empty">{empty}</p>;
  return (
    <ul className="kf-places">
      {places.map((place) => (
        <li key={place.key}>
          <button type="button" className={`kf-places__row${selectedKey === `${place.matterId}|${place.folderId ?? ''}` ? ' is-selected' : ''}`} onClick={() => onPick(place)}>
            <Icon name={place.icon} className="kf-places__glyph" />
            <LocationText location={place} />
            {place.meta ? <span className="kf-places__meta">{place.meta}</span> : null}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function recentToPlaces(rows: RecentTarget[]) {
  return rows.map((row) => ({ ...row, key: `r:${row.matterId}|${row.folderId ?? ''}`, icon: 'clock' as IconName, meta: formatDate(row.usedAt) }));
}
