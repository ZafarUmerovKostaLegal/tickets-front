import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { DocRow, Filing, Location } from '../api';
import type { SuggestedLocation } from '../explorer';
import { filedSummary, reasonLabel } from '../explorer';
import { mailCapabilities, type AttachmentInfo, type ItemInfo } from '../mailbox';
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

export function MailStatus({ item, filings, loading, onOpen }: {
  item: ItemInfo;
  filings: Filing[];
  loading: boolean;
  onOpen: (filing: Filing) => void;
}) {
  const { message, thread } = filedSummary(filings);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const tone = loading ? 'checking' : message.length ? 'filed' : thread.length ? 'thread' : 'new';
  const label = loading
    ? 'Проверяем…'
    : message.length
      ? `Сохранено${message.length > 1 ? ` · ${message.length}` : ''}`
      : thread.length ? 'Переписка' : 'Не сохранено';
  const hint = loading
    ? 'Проверяем, сохранено ли письмо'
    : message.length
      ? `Письмо сохранено (${message.length}) — нажмите, чтобы посмотреть куда`
      : thread.length
        ? `Само письмо не сохранено, но переписка уже есть в «${thread[0]!.matterName}»`
        : 'Письмо ещё не сохранено в Kosta';

  useEffect(() => {
    setOpen(false);
  }, [item.messageId]);

  useEffect(() => {
    if (!open)
      return;
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node))
        setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape')
        setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="kf-mailstate" ref={rootRef}>
      <button
        type="button"
        className={`kf-mailstate__pill is-${tone}`}
        title={`${hint}\n${item.subject}${item.fromName ? `\n${item.fromName}` : ''}`}
        aria-label={hint}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="kf-mailstate__dot" aria-hidden />
        <span className="kf-mailstate__text">{label}</span>
      </button>
      {open ? (
        <div className="kf-mailstate__pop" role="dialog" aria-label="Где сохранено письмо">
          <p className="kf-mailstate__subject" title={item.subject}>{item.subject}</p>
          <p className="kf-mailstate__from">
            {item.fromName}{item.fromEmail && item.fromEmail !== item.fromName ? ` · ${item.fromEmail}` : ''}
            {item.received ? ` · ${formatDate(item.received)}` : ''}
          </p>
          {message.length ? (
            <ul className="kf-filed">
              {message.map((filing) => (
                <li key={`${filing.documentId}-${filing.kind}`}>
                  <button type="button" className="kf-filed__row"
                    onClick={() => onOpen(filing.visible === false ? { ...filing, documentId: '' } : filing)}
                    title={filing.visible === false ? 'Сохранил коллега — доступ к письму открывает партнёр. Откроется папка.' : 'Открыть в Kosta Hub'}>
                    <Icon name={filing.kind === 'thread' ? 'thread' : filing.kind === 'attachment' ? 'clip' : 'mail'} size={14} />
                    <LocationText location={filing} compact />
                    <span className="kf-filed__meta">
                      {filing.filedBy} · {formatDate(filing.filedAt)}
                      {filing.visible === false ? ' · доступ у партнёра' : ''}
                    </span>
                    <Icon name="open" size={13} className="kf-filed__open" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="kf-mailstate__note">
              {thread.length
                ? <>Переписка уже есть в <strong>{thread[0]!.matterName}</strong>{thread.length > 1 ? ` и ещё ${thread.length - 1}` : ''}. Само письмо не сохранено.</>
                : 'Письмо ещё не сохранено — выберите папку ниже.'}
            </p>
          )}
        </div>
      ) : null}
    </div>
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
  const caps = mailCapabilities();
  const canAttach = caps.attachments;
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
        {canAttach ? (
          <label className={`kf-chip${!options.message && !options.thread ? ' is-on' : ''}`}>
            <input type="radio" name="kf-what" checked={!options.message && !options.thread} onChange={() => setOptions({ ...options, message: false, thread: false })} />
            Только вложения
          </label>
        ) : null}
      </div>

      {item.attachments.length && !canAttach ? (
        <p className="kf-note">
          <Icon name="clip" size={13} />
          {caps.originalFile
            ? 'Вложения сохранятся внутри письма. Отдельными файлами их можно сохранить с компьютера.'
            : 'Outlook на этом устройстве не отдаёт вложения надстройкам — письмо сохранится без них. Вложения сохраните с компьютера.'}
        </p>
      ) : null}

      {item.attachments.length && canAttach ? (
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
      {item.attachments.length && canAttach && (attachOpen || onlyAttachments) ? (
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
          {busy ? 'Сохраняем…' : count > 1 ? `Сохранить (${count})` : 'Сохранить'}
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
      {alreadyHere ? <p className="kf-filebar__note">Это письмо уже есть в этом matter — копию Kosta не создаст. Можно сохранить вложения или всю переписку (она обновится новой версией).</p> : null}
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

export function TreeDoc({ doc, compose, busy, onOpen, onAttach, onLink }: {
  doc: DocRow;
  compose: boolean;
  busy: boolean;
  onOpen: (doc: DocRow) => void;
  onAttach: (doc: DocRow) => void;
  onLink: (doc: DocRow) => void;
}) {
  const meta = [doc.docNumber, doc.version > 1 ? `v${doc.version}` : '', formatDate(doc.updatedAt), doc.checkedOutBy ? `у ${doc.checkedOutBy}` : '']
    .filter(Boolean).join(' · ');
  return (
    <div className="kf-tree__row kf-tree__row--doc">
      <span className="kf-tree__twist" aria-hidden="true" />
      <button type="button" role="treeitem" className="kf-tree__label" title={`${doc.name}\n${meta}\nОткрыть в Kosta Hub`} onClick={() => onOpen(doc)}>
        <Icon name={doc.kind === 'email' || /\.eml$/i.test(doc.name) ? 'mail' : 'doc'} className="kf-tree__glyph" />
        <span className="kf-tree__name">{doc.name}</span>
        {doc.version > 1 ? <span className="kf-tree__count">v{doc.version}</span> : null}
      </button>
      <span className="kf-tree__tools">
        {compose ? (
          <>
            <button type="button" className="kf-iconbtn" disabled={busy} title="Вложить в письмо" aria-label={`Вложить ${doc.name}`} onClick={() => onAttach(doc)}><Icon name="clip" size={14} /></button>
            <button type="button" className="kf-iconbtn" disabled={busy} title="Вставить ссылку" aria-label={`Ссылка на ${doc.name}`} onClick={() => onLink(doc)}><Icon name="link" size={14} /></button>
          </>
        ) : null}
        <button type="button" className="kf-iconbtn" title="Открыть в Kosta Hub" aria-label={`Открыть ${doc.name}`} onClick={() => onOpen(doc)}><Icon name="open" size={14} /></button>
      </span>
    </div>
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

type ToastStatus = { text: string; kind: '' | 'ok' | 'error' } | null;

const TOAST_MS = { ok: 4500, error: 9000, '': 4500 } as const;

export function Toast({ status, busy, onClose }: { status: ToastStatus; busy: boolean; onClose: () => void }) {
  const [hover, setHover] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => setLeaving(false), [status]);

  useEffect(() => {
    if (!status || hover || (busy && status.kind === ''))
      return;
    const timer = window.setTimeout(() => setLeaving(true), TOAST_MS[status.kind]);
    return () => window.clearTimeout(timer);
  }, [status, hover, busy]);

  useEffect(() => {
    if (!leaving)
      return;
    const timer = window.setTimeout(() => closeRef.current(), 180);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  if (!status)
    return null;
  const [title, ...rest] = status.text.split('\n');
  const progress = busy && status.kind === '';
  return (
    <div className="kf-toasts" aria-live={status.kind === 'error' ? 'assertive' : 'polite'}>
      <div
        className={`kf-toast is-${status.kind || 'info'}${leaving ? ' is-leaving' : ''}`}
        role={status.kind === 'error' ? 'alert' : 'status'}
        title={status.text}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
      >
        <span className="kf-toast__icon" aria-hidden="true">
          {progress ? <span className="kf-spinner kf-spinner--small" /> : <Icon name={status.kind === 'error' ? 'close' : status.kind === 'ok' ? 'check' : 'spark'} size={14} />}
        </span>
        <div className="kf-toast__body">
          <p className="kf-toast__title">{title}</p>
          {rest.length ? <p className="kf-toast__detail">{rest.join(' · ')}</p> : null}
        </div>
        {!progress ? (
          <button type="button" className="kf-iconbtn" aria-label="Скрыть уведомление" onClick={() => setLeaving(true)}>
            <Icon name="close" size={13} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
