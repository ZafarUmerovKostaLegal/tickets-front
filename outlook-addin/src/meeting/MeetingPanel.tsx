import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  browse,
  clearApiCaches,
  createFolder,
  listClients,
  setUnauthorizedHandler,
  type BrowseFolder,
  type ClientNode,
  type Location,
  type MeetingLinkDto,
  type MeetingLinkResponse,
} from '../api';
import { loginWithHub, signInSilently } from '../auth/authApi';
import { filterClients, folderPath, locationKey } from '../explorer';
import { locationLabel } from '../naming';
import { FolderTree, type FolderState } from '../ui/FolderTree';
import { Icon } from '../ui/icons';
import { formatDate } from '../ui/panels';
import { Brand, SignInScreen } from '../ui/screens';

type Phase = 'boot' | 'signin' | 'ready';

export type MeetingLinkInput = { matterId: string; folderId: string | null; includeTranscript: boolean; autoRecord: boolean };

export type MeetingSource = {
  app: 'Teams' | 'Zoom';
  load: () => Promise<MeetingLinkResponse>;
  save: (body: MeetingLinkInput) => Promise<MeetingLinkResponse>;
  remove: () => Promise<unknown>;
  check: () => Promise<unknown>;
  signIn?: () => Promise<unknown>;
  autoRecord?: boolean;
  recordNow?: () => Promise<void>;
};
type Notice = { text: string; kind: 'ok' | 'error' } | null;

const NO_FAVORITES: ReadonlySet<string> = new Set();

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function linkLocation(link: MeetingLinkDto): Location {
  return {
    matterId: link.matterId,
    matterName: link.matterName,
    matterCode: link.matterCode,
    clientId: link.clientId,
    clientName: link.clientName,
    folderId: link.folderId,
    folderPath: link.folderPath ? link.folderPath.split(' / ').map((name, i) => ({ id: `${i}`, name })) : [],
  };
}

export function MeetingPanel({ source, outside }: { source: MeetingSource | null; outside: string }) {
  const appName = source?.app ?? 'Teams';
  const [phase, setPhase] = useState<Phase>('boot');
  const [signInBusy, setSignInBusy] = useState(false);
  const [signInError, setSignInError] = useState('');
  const [link, setLink] = useState<MeetingLinkDto | null>(null);
  const [serverReady, setServerReady] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [clients, setClients] = useState<ClientNode[]>([]);
  const [clientsError, setClientsError] = useState('');
  const [filter, setFilter] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [folders, setFolders] = useState<Record<string, FolderState>>({});
  const [target, setTarget] = useState<Location | null>(null);
  const [transcript, setTranscript] = useState(true);
  const [autoRecord, setAutoRecord] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const foldersRef = useRef(folders);
  foldersRef.current = folders;

  useEffect(() => {
    let alive = true;
    void signInSilently().then((me) => {
      if (alive)
        setPhase(me ? 'ready' : 'signin');
    });
    setUnauthorizedHandler(async () => {
      const me = await signInSilently({ force: true });
      if (!me)
        setPhase('signin');
      return Boolean(me);
    });
    return () => {
      alive = false;
      setUnauthorizedHandler(null);
    };
  }, []);

  const loadLink = useCallback(async () => {
    if (!source)
      return;
    try {
      const data = await source.load();
      setLink(data.link);
      setServerReady(data.serverReady);
      setEditing(!data.link);
      if (data.link) {
        setTranscript(data.link.includeTranscript);
        setAutoRecord(data.link.autoRecord);
      }
    } catch (error) {
      setNotice({ text: errorText(error), kind: 'error' });
    } finally {
      setLoaded(true);
    }
  }, [source]);

  useEffect(() => {
    if (phase === 'ready')
      void loadLink();
  }, [phase, loadLink]);

  useEffect(() => {
    if (phase !== 'ready' || !editing || clients.length)
      return;
    listClients().then(setClients, (error: unknown) => setClientsError(errorText(error)));
  }, [phase, editing, clients.length]);

  const loadFolders = useCallback(async (matterId: string, force = false): Promise<BrowseFolder[] | null> => {
    const current = foldersRef.current[matterId];
    if (!force && Array.isArray(current))
      return current;
    setFolders((prev) => ({ ...prev, [matterId]: Array.isArray(prev[matterId]) ? prev[matterId]! : 'loading' }));
    try {
      const data = await browse(matterId);
      setFolders((prev) => ({ ...prev, [matterId]: data.folders }));
      return data.folders;
    } catch (error) {
      setFolders((prev) => ({ ...prev, [matterId]: { error: errorText(error) } }));
      return null;
    }
  }, []);

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key))
        next.delete(key);
      else
        next.add(key);
      return next;
    });
    if (key.startsWith('m:') && !expanded.has(key))
      void loadFolders(key.slice(2));
  };

  const createFolderIn = async (matterId: string, parentId: string | null, name: string) => {
    try {
      const created = await createFolder(matterId, name, parentId);
      const rows = await loadFolders(matterId, true);
      const client = clients.find((row) => row.matters.some((m) => m.id === matterId));
      const matter = client?.matters.find((m) => m.id === matterId);
      if (client && matter) {
        setTarget({
          matterId,
          matterName: matter.name,
          matterCode: matter.code,
          clientId: client.id,
          clientName: client.name,
          folderId: created.id,
          folderPath: rows ? folderPath(rows, created.id) : [{ id: created.id, name }],
        });
      }
    } catch (error) {
      setNotice({ text: errorText(error), kind: 'error' });
    }
  };

  const signIn = async () => {
    setSignInBusy(true);
    setSignInError('');
    try {
      await (source?.signIn ? source.signIn() : loginWithHub());
      setPhase('ready');
    } catch (error) {
      setSignInError(errorText(error));
    } finally {
      setSignInBusy(false);
    }
  };

  const save = async () => {
    if (!source || !target)
      return;
    setBusy(true);
    setNotice(null);
    try {
      const data = await source.save({
        matterId: target.matterId,
        folderId: target.folderId,
        includeTranscript: transcript,
        autoRecord: Boolean(source.autoRecord) && autoRecord,
      });
      setLink(data.link);
      setEditing(false);
      setNotice(data.warning
        ? { text: data.warning, kind: 'error' }
        : { text: 'Готово. Запись встречи сохранится сюда автоматически.', kind: 'ok' });
    } catch (error) {
      setNotice({ text: errorText(error), kind: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const unlink = async () => {
    if (!source)
      return;
    setBusy(true);
    try {
      await source.remove();
      setLink(null);
      setTarget(null);
      setEditing(true);
      setNotice({ text: 'Встреча отвязана. Записи больше не сохраняются.', kind: 'ok' });
    } catch (error) {
      setNotice({ text: errorText(error), kind: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const checkNow = async () => {
    if (!source)
      return;
    setBusy(true);
    try {
      await source.check();
      setNotice({ text: 'Ищем запись. Если встреча уже закончилась, файл появится в папке через минуту.', kind: 'ok' });
      window.setTimeout(() => void loadLink(), 20_000);
    } catch (error) {
      setNotice({ text: errorText(error), kind: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const recordNow = async () => {
    if (!source?.recordNow)
      return;
    setBusy(true);
    try {
      await source.recordNow();
      setNotice({ text: `Запись в облако ${appName} началась.`, kind: 'ok' });
    } catch (error) {
      setNotice({ text: `${appName} не начал запись: ${errorText(error)}. Начать запись может организатор или тот, кому он разрешил.`, kind: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const filtered = useMemo(() => filterClients(clients, filter, { hideClosed: true }), [clients, filter]);
  const selectedKey = target ? locationKey(target) : null;

  if (phase === 'boot')
    return <main className="kf-teams"><Brand sub="Запись встречи" /><p className="kf-empty">Загрузка…</p></main>;
  if (phase === 'signin')
    return <SignInScreen busy={signInBusy} error={signInError} onSignIn={() => void signIn()} />;

  return (
    <main className="kf-teams">
      <header className="kf-top">
        <Brand sub="Запись встречи" />
        <div className="kf-top__tools">
          <button type="button" className="kf-iconbtn" title="Обновить" aria-label="Обновить" onClick={() => {
            clearApiCaches();
            setClients([]);
            setFolders({});
            void loadLink();
          }}>
            <Icon name="refresh" />
          </button>
        </div>
      </header>

      {!source ? <p className="kf-alert kf-alert--error">{outside}</p> : null}
      {source && !serverReady ? (
        <p className="kf-alert kf-alert--error">Сохранение записей {appName} ещё не настроено на сервере. Обратитесь к администратору.</p>
      ) : null}

      {source && link?.topic ? <p className="kf-teams__topic"><Icon name="record" size={14} />{link.topic}</p> : null}

      {source && loaded && link?.hidden ? (
        <section className="kf-teams__card" aria-label="Встреча уже привязана">
          <p className="kf-teams__label">Запись этой встречи уже сохраняет в Kosta {link.ownerName}.</p>
        </section>
      ) : null}

      {source && loaded && link && !link.hidden && !editing ? (
        <section className="kf-teams__card" aria-label="Куда сохраняется запись">
          <p className="kf-teams__label">Запись и расшифровка сохраняются в</p>
          <p className="kf-teams__where"><Icon name="folder" size={15} />{locationLabel(linkLocation(link))}</p>
          <ul className="kf-teams__facts">
            <li>{link.includeTranscript ? 'Запись и расшифровка' : 'Только запись'}</li>
            {link.autoRecord ? <li>Автозапись включена</li> : <li>Запись запускается кнопкой «Запись» в {appName}{source.recordNow ? ' или кнопкой ниже' : ''}</li>}
            <li>Привязал(а): {link.mine ? 'вы' : link.ownerName}</li>
            {link.filedTotal ? <li>Сохранено файлов: {link.filedTotal}{link.lastFiledAt ? `, последний ${formatDate(link.lastFiledAt)}` : ''}</li> : <li>Файлов пока нет — они появятся через несколько минут после окончания записи</li>}
          </ul>
          {link.lastError ? <p className="kf-alert kf-alert--error">{link.lastError}</p> : null}
          <div className="kf-teams__actions">
            {source.recordNow ? (
              <button type="button" className="kf-btn kf-btn--primary" disabled={busy} onClick={() => void recordNow()}>
                <Icon name="record" size={14} />Запись в облако
              </button>
            ) : null}
            <button type="button" className="kf-btn" disabled={busy} onClick={() => void checkNow()}>
              <Icon name="refresh" size={14} />Проверить сейчас
            </button>
            {link.canEdit ? (
              <>
                <button type="button" className="kf-btn" disabled={busy} onClick={() => {
                  setTarget(linkLocation(link));
                  setEditing(true);
                }}>
                  <Icon name="folderOpen" size={14} />Изменить
                </button>
                <button type="button" className="kf-btn kf-btn--danger" disabled={busy} onClick={() => void unlink()}>
                  <Icon name="trash" size={14} />Отвязать
                </button>
              </>
            ) : null}
          </div>
        </section>
      ) : null}

      {source && loaded && editing ? (
        <section className="kf-teams__pick" aria-label="Выбор папки">
          <p className="kf-teams__label">Выберите matter и папку для записи этой встречи</p>
          <div className="kf-filter">
            <Icon name="search" size={14} />
            <input
              className="kf-input kf-input--bare"
              value={filter}
              placeholder="Клиент, matter или код"
              aria-label="Фильтр клиентов и matters"
              onChange={(event) => setFilter(event.target.value)}
            />
            {filter ? <button type="button" className="kf-iconbtn" aria-label="Очистить" onClick={() => setFilter('')}><Icon name="close" size={13} /></button> : null}
          </div>
          {clientsError ? <p className="kf-alert kf-alert--error">{clientsError}</p> : null}
          {!clients.length && !clientsError ? <p className="kf-empty">Загрузка клиентов…</p> : (
            <div className="kf-teams__tree">
              <FolderTree
                clients={filtered}
                autoExpand={Boolean(filter.trim())}
                expanded={expanded}
                onToggle={toggle}
                folders={folders}
                selectedKey={selectedKey}
                dropKey={null}
                favorites={NO_FAVORITES}
                onSelect={setTarget}
                onFavorite={() => undefined}
                onCreateFolder={createFolderIn}
                onDropFiles={() => undefined}
              />
            </div>
          )}
          <label className="kf-check">
            <input type="checkbox" checked={transcript} onChange={(event) => setTranscript(event.target.checked)} />
            Сохранять расшифровку (если она включена в {appName})
          </label>
          {source.autoRecord ? (
            <label className="kf-check">
              <input type="checkbox" checked={autoRecord} onChange={(event) => setAutoRecord(event.target.checked)} />
              Включить автозапись встречи
            </label>
          ) : null}
          <div className="kf-teams__bar">
            <p className="kf-teams__target">
              {target ? <><Icon name="folder" size={14} />{locationLabel(target)}</> : 'Папка не выбрана'}
            </p>
            <div className="kf-teams__actions">
              {link ? <button type="button" className="kf-btn" disabled={busy} onClick={() => setEditing(false)}>Отмена</button> : null}
              <button type="button" className="kf-btn kf-btn--primary" disabled={!target || busy || !serverReady} onClick={() => void save()}>
                <Icon name="record" size={14} />{busy ? 'Сохраняем…' : 'Сохранять запись сюда'}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {notice ? <p className={`kf-alert ${notice.kind === 'error' ? 'kf-alert--error' : 'kf-alert--ok'}`} role="status">{notice.text}</p> : null}
    </main>
  );
}
