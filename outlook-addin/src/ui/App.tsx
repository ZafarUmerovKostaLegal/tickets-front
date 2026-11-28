import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  browse,
  clearApiCaches,
  createFolder,
  documentContent,
  filingSuggestions,
  listClients,
  listFavorites,
  lookupFilings,
  recentDocuments,
  searchDocuments,
  setFavorite,
  setUnauthorizedHandler,
  type BrowseFolder,
  type ClientNode,
  type DocRow,
  type Favorites,
  type Filing,
  type Location,
  type Suggestion,
} from '../api';
import { isMobileOutlook, loginWithCode, loginWithHub, logoutHub, signInSilently, signinDetails, type PairingTicket } from '../auth/authApi';
import { officeHost, officePlatform, officeVersion, reportSigninProblem, startPresence } from '../presence';
import { clearLegacyOutlookTokens, type AuthProfile } from '../auth/session';
import { filterClients, folderPath, locationKey, mergeSuggestions, type SuggestedLocation } from '../explorer';
import { fileDropped, fileMail, fileOfficeDocument, ruleTarget, type FileResult } from '../filing';
import { attachToDraft, insertLinkInDraft, onOutlookDrop, openInBrowser, readItemInfo, type ItemInfo } from '../mailbox';
import { hubDocumentUrl, locationLabel } from '../naming';
import { hostLabel } from '../officeDoc';
import { matchRule } from '../rules';
import { getSettings, loadRoamingSettings, saveSettings, wasFiled, type FilingRule } from '../settings';
import { createMailRule, listMailRules, setMailAutofile, type MailboxDto } from '../api';
import { migrateLocalRules, toFilingRule } from '../mailRules';
import { FolderTree, type DocState, type FolderState } from './FolderTree';
import { Icon } from './icons';
import { DocList, FileBar, MailStatus, PlaceList, recentToPlaces, Section, Suggestions, Toast, TreeDoc, type FileOptions } from './panels';
import { Brand, SettingsSheet, SignInScreen } from './screens';

const ASSET_BASE = import.meta.env.BASE_URL || '/';

type Phase = 'boot' | 'signin' | 'ready';
type Tab = 'tree' | 'search' | 'saved';
type Status = { text: string; kind: '' | 'ok' | 'error' } | null;

const HUB_ORIGIN = window.location.origin;
const UI_KEY = 'kosta.addin.ui';

type UiState = { tab: Tab; expanded: string[]; hideClosed: boolean };

function readUi(): UiState {
  try {
    const raw = JSON.parse(localStorage.getItem(UI_KEY) || '{}') as Partial<UiState>;
    return {
      tab: raw.tab === 'search' || raw.tab === 'saved' ? raw.tab : 'tree',
      expanded: Array.isArray(raw.expanded) ? raw.expanded.filter((x) => typeof x === 'string').slice(0, 200) : [],
      hideClosed: raw.hideClosed !== false,
    };
  } catch {
    return { tab: 'tree', expanded: [], hideClosed: true };
  }
}

function writeUi(state: UiState): void {
  try {
    localStorage.setItem(UI_KEY, JSON.stringify(state));
  } catch {
  }
}

function signinEnvironment(): string {
  return `Устройство: ${officeHost()} · ${officePlatform()} · Office ${officeVersion() || '?'} · Kosta File ${import.meta.env.VITE_ADDIN_VERSION || '?'}`;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function resultText(result: FileResult, target: Location): Status {
  if (!result.saved.length)
    return { text: result.failed.join('\n') || 'Ничего не сохранено', kind: 'error' };
  const where = [target.matterCode || target.matterName, ...target.folderPath.map((crumb) => crumb.name)].filter(Boolean).join(' › ');
  const files = result.saved.join(' · ');
  if (result.failed.length)
    return { text: `Сохранено частично\n${where}\nНе удалось: ${result.failed.join('; ')}`, kind: 'error' };
  if (!result.fresh)
    return { text: `Уже есть в Kosta — копия не создана\n${files}`, kind: 'ok' };
  return { text: `Сохранено в ${where || locationLabel(target)}\n${files}`, kind: 'ok' };
}

function defaultOptions(): FileOptions {
  return { message: true, thread: false, attachments: [], comment: '' };
}

export function App({ host }: { host: Office.HostType | null }) {
  const isOutlook = host === Office.HostType.Outlook;
  const isDocument = host === Office.HostType.Word || host === Office.HostType.Excel || host === Office.HostType.PowerPoint;

  const [phase, setPhase] = useState<Phase>('boot');
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [signInBusy, setSignInBusy] = useState(false);
  const [signInError, setSignInError] = useState('');
  const [signInDetails, setSignInDetails] = useState('');
  const [pairTicket, setPairTicket] = useState<PairingTicket | null>(null);
  const [pairBusy, setPairBusy] = useState(false);
  const pairAbort = useRef<AbortController | null>(null);

  const ui = useRef(readUi());
  const [tab, setTab] = useState<Tab>(ui.current.tab);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(ui.current.expanded));
  const [hideClosed, setHideClosed] = useState(ui.current.hideClosed);
  const [filter, setFilter] = useState('');

  const [clients, setClients] = useState<ClientNode[]>([]);
  const [clientsError, setClientsError] = useState('');
  const [folders, setFolders] = useState<Record<string, FolderState>>({});
  const [favorites, setFavorites] = useState<Favorites>({ matters: [], folders: [] });

  const [item, setItem] = useState<ItemInfo | null>(null);
  const [filings, setFilings] = useState<Filing[]>([]);
  const [server, setServer] = useState<Suggestion[]>([]);
  const [contextLoading, setContextLoading] = useState(false);

  const [target, setTarget] = useState<Location | null>(null);
  const [options, setOptions] = useState<FileOptions>(defaultOptions());
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rules, setRules] = useState<FilingRule[]>([]);
  const [mailbox, setMailbox] = useState<MailboxDto | null>(null);
  const [serverReady, setServerReady] = useState(true);
  const rulesRef = useRef<FilingRule[]>([]);
  rulesRef.current = rules;
  const mailboxRef = useRef<MailboxDto | null>(null);
  mailboxRef.current = mailbox;
  const [recent, setRecent] = useState(getSettings().recentTargets);
  const [pinTip, setPinTip] = useState(isOutlook && !getSettings().pinTipDismissed);
  const [collapsed, setCollapsed] = useState(() => getSettings().collapsed);
  const toggleCollapsed = (next: boolean) => {
    saveSettings({ collapsed: next });
    setCollapsed(next);
  };

  const [docs, setDocs] = useState<Record<string, DocState>>({});
  const docsRef = useRef(docs);
  docsRef.current = docs;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DocRow[] | 'loading' | null>(null);
  const [recentDocs, setRecentDocs] = useState<DocRow[]>([]);
  const [dropKey, setDropKey] = useState<string | null>(null);

  const itemSeq = useRef(0);
  const autoFiled = useRef(new Set<string>());
  const latest = useRef({ clients, folders, target, busy });
  latest.current = { clients, folders, target, busy };

  const compose = item?.mode === 'compose';

  useEffect(() => {
    writeUi({ tab, expanded: [...expanded], hideClosed });
  }, [tab, expanded, hideClosed]);

  const profileId = profile?.id ?? null;
  useEffect(() => {
    if (phase !== 'ready' || profileId == null)
      return;
    return startPresence();
  }, [phase, profileId]);

  const refreshSettings = useCallback(() => {
    setRecent(getSettings().recentTargets);
  }, []);

  const reloadRules = useCallback(async () => {
    try {
      if (getSettings().rules.length)
        await migrateLocalRules(getSettings().rules);
      const data = await listMailRules();
      setRules(data.rules.map(toFilingRule));
      setMailbox(data.mailbox);
      setServerReady(data.serverReady);
    } catch {
    }
  }, []);

  useEffect(() => {
    if (phase === 'ready')
      void reloadRules();
  }, [phase, reloadRules]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      await loadRoamingSettings();
      clearLegacyOutlookTokens();
      refreshSettings();
      const me = await signInSilently();
      if (!alive)
        return;
      setProfile(me);
      setPhase(me ? 'ready' : 'signin');
    })();
    setUnauthorizedHandler(async () => {
      const me = await signInSilently({ force: true });
      if (!me) {
        setProfile(null);
        setPhase('signin');
      }
      return Boolean(me);
    });
    return () => {
      alive = false;
      setUnauthorizedHandler(null);
    };
  }, [refreshSettings]);

  const signIn = async () => {
    setSignInBusy(true);
    setSignInError('');
    setSignInDetails('');
    try {
      const me = await loginWithHub();
      setProfile(me);
      setPhase('ready');
    } catch (error) {
      const message = errorText(error);
      const details = [signinEnvironment(), signinDetails()].filter(Boolean).join('\n');
      setSignInError(message);
      setSignInDetails(details);
      reportSigninProblem(`${message}\n${details}`);
    } finally {
      setSignInBusy(false);
    }
  };

  const startCodeSignIn = async () => {
    pairAbort.current?.abort();
    const controller = new AbortController();
    pairAbort.current = controller;
    setPairBusy(true);
    setSignInError('');
    setSignInDetails('');
    try {
      const me = await loginWithCode((ticket) => {
        setPairBusy(false);
        setPairTicket(ticket);
      }, controller.signal);
      setProfile(me);
      setPhase('ready');
    } catch (error) {
      if (!controller.signal.aborted)
        setSignInError(errorText(error));
    } finally {
      if (pairAbort.current === controller) {
        pairAbort.current = null;
        setPairTicket(null);
        setPairBusy(false);
      }
    }
  };

  const cancelCodeSignIn = () => {
    pairAbort.current?.abort();
  };

  useEffect(() => () => pairAbort.current?.abort(), []);

  const logout = async () => {
    await logoutHub();
    clearApiCaches();
    setSettingsOpen(false);
    setProfile(null);
    setClients([]);
    setFolders({});
    setDocs({});
    setPhase('signin');
  };

  const loadClients = useCallback(async (force = false) => {
    try {
      setClientsError('');
      setClients(await listClients({ force }));
    } catch (error) {
      setClientsError(errorText(error));
    }
  }, []);

  const loadFavorites = useCallback(async () => {
    try {
      setFavorites(await listFavorites());
    } catch {
    }
  }, []);

  useEffect(() => {
    if (phase !== 'ready')
      return;
    void loadClients();
    void loadFavorites();
  }, [phase, loadClients, loadFavorites]);

  const loadFolders = useCallback(async (matterId: string, force = false): Promise<BrowseFolder[] | null> => {
    const current = latest.current.folders[matterId];
    if (!force && Array.isArray(current))
      return current;
    setFolders((prev) => ({ ...prev, [matterId]: Array.isArray(prev[matterId]) ? prev[matterId]! : 'loading' }));
    try {
      const data = await browse(matterId);
      setFolders((prev) => ({ ...prev, [matterId]: data.folders }));
      setDocs((prev) => ({ ...prev, [`${matterId}|`]: data.documents }));
      return data.folders;
    } catch (error) {
      setFolders((prev) => ({ ...prev, [matterId]: { error: errorText(error) } }));
      return null;
    }
  }, []);

  const loadDocs = useCallback(async (matterId: string, folderId: string | null) => {
    const key = locationKey({ matterId, folderId });
    setDocs((prev) => ({ ...prev, [key]: Array.isArray(prev[key]) ? prev[key]! : 'loading' }));
    try {
      const data = await browse(matterId, folderId);
      setDocs((prev) => ({ ...prev, [key]: data.documents }));
    } catch (error) {
      setDocs((prev) => ({ ...prev, [key]: { error: errorText(error) } }));
    }
  }, []);

  const refreshPlace = useCallback((location: Location) => {
    void loadFolders(location.matterId, true);
    if (location.folderId && docsRef.current[locationKey(location)] !== undefined)
      void loadDocs(location.matterId, location.folderId);
  }, [loadFolders, loadDocs]);

  useEffect(() => {
    if (phase !== 'ready')
      return;
    expanded.forEach((key) => {
      if (key.startsWith('m:') && latest.current.folders[key.slice(2)] === undefined)
        void loadFolders(key.slice(2));
    });
  }, [phase, expanded, loadFolders]);

  useEffect(() => {
    if (phase !== 'ready')
      return;
    for (const [matterId, state] of Object.entries(folders)) {
      if (!Array.isArray(state))
        continue;
      for (const folder of state) {
        if (folder.documents && expanded.has(`f:${folder.id}`) && docsRef.current[locationKey({ matterId, folderId: folder.id })] === undefined)
          void loadDocs(matterId, folder.id);
      }
    }
  }, [phase, expanded, folders, loadDocs]);

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

  const completeLocation = useCallback(async (matterId: string, folderId: string | null, fallback?: Partial<Location>): Promise<Location> => {
    const client = latest.current.clients.find((row) => row.matters.some((m) => m.id === matterId));
    const matter = client?.matters.find((m) => m.id === matterId);
    const rows = await loadFolders(matterId);
    return {
      matterId,
      matterName: matter?.name ?? fallback?.matterName ?? '',
      matterCode: matter?.code ?? fallback?.matterCode ?? '',
      clientId: client?.id ?? fallback?.clientId ?? '',
      clientName: client?.name ?? fallback?.clientName ?? '',
      folderId,
      folderPath: rows ? folderPath(rows, folderId) : fallback?.folderPath ?? [],
    };
  }, [loadFolders]);

  const pick = useCallback((location: Location) => {
    setTarget(location);
    setExpanded((prev) => {
      const next = new Set(prev);
      if (location.clientId)
        next.add(`c:${location.clientId}`);
      next.add(`m:${location.matterId}`);
      location.folderPath.slice(0, -1).forEach((crumb) => crumb.id && next.add(`f:${crumb.id}`));
      return next;
    });
    void loadFolders(location.matterId);
  }, [loadFolders]);

  const fileWithRule = useCallback(async (info: ItemInfo, found: Filing[]) => {
    if (mailboxRef.current?.enabled)
      return;
    const rule = matchRule(info.fromEmail, rulesRef.current, info.subject);
    if (!rule?.autoFile || info.mode !== 'read' || latest.current.busy)
      return;
    if (wasFiled(info.messageId) || found.some((f) => f.sameMessage) || autoFiled.current.has(info.messageId))
      return;
    autoFiled.current.add(info.messageId);
    setBusy(true);
    try {
      const location = await ruleTarget(rule);
      const result = await fileMail(info, { target: location, message: true, thread: false, attachments: [], comment: 'Автоправило' }, (text) => setStatus({ text, kind: '' }));
      const shown = resultText(result, location);
      setStatus(shown && { ...shown, text: `Автоправило «${rule.match}»\n${shown.text}` });
      setFilings(await lookupFilings([info.messageId], info.conversationId));
    } catch (error) {
      setStatus({ text: errorText(error), kind: 'error' });
    } finally {
      setBusy(false);
      refreshSettings();
    }
  }, [refreshSettings]);

  const loadContext = useCallback(async (info: ItemInfo | null) => {
    const seq = ++itemSeq.current;
    setFilings([]);
    setServer([]);
    if (!info || info.mode !== 'read')
      return;
    setContextLoading(true);
    try {
      const [found, suggested] = await Promise.all([
        lookupFilings([info.messageId], info.conversationId).catch(() => [] as Filing[]),
        filingSuggestions(info.fromEmail, info.conversationId).catch(() => [] as Suggestion[]),
      ]);
      if (seq !== itemSeq.current)
        return;
      setFilings(found);
      setServer(suggested);
      void fileWithRule(info, found);
    } finally {
      if (seq === itemSeq.current)
        setContextLoading(false);
    }
  }, [fileWithRule]);

  const refreshItem = useCallback(() => {
    let info: ItemInfo | null = null;
    try {
      info = readItemInfo();
    } catch {
      info = null;
    }
    setItem(info);
    setOptions(defaultOptions());
    setStatus(null);
    void loadContext(info);
  }, [loadContext]);

  useEffect(() => {
    if (phase !== 'ready' || !isOutlook)
      return;
    refreshItem();
    try {
      Office.context.mailbox.addHandlerAsync(Office.EventType.ItemChanged, () => {
        if (!getSettings().pinTipDismissed)
          saveSettings({ pinTipDismissed: true });
        setPinTip(false);
        refreshItem();
      });
    } catch {
    }
    return () => {
      try {
        Office.context.mailbox.removeHandlerAsync(Office.EventType.ItemChanged);
      } catch {
      }
    };
  }, [phase, isOutlook, refreshItem]);

  const rule = item?.mode === 'read' ? matchRule(item.fromEmail, rules, item.subject) : null;
  const [ruleLocation, setRuleLocation] = useState<Location | null>(null);
  useEffect(() => {
    setRuleLocation(null);
    if (!rule || phase !== 'ready')
      return;
    let alive = true;
    void ruleTarget(rule).then((location) => alive && setRuleLocation(location)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [rule?.id, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const suggestions = useMemo<SuggestedLocation[]>(() => mergeSuggestions({
    rule: rule && ruleLocation ? { ...rule, folderId: ruleLocation.folderId, folderPath: ruleLocation.folderPath } : null,
    server,
    recent,
    filings,
  }), [rule, ruleLocation, server, recent, filings]);

  useEffect(() => {
    const top = suggestions[0];
    if (top && (top.reason === 'conversation' || top.reason === 'rule'))
      setTarget((current) => current ?? top);
  }, [suggestions]);


  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) {
      setResults(null);
      return;
    }
    setResults('loading');
    const timer = window.setTimeout(() => {
      searchDocuments(text).then(setResults).catch((error) => {
        setResults([]);
        setStatus({ text: errorText(error), kind: 'error' });
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (phase === 'ready' && tab === 'saved' && compose)
      recentDocuments().then(setRecentDocs).catch(() => undefined);
  }, [phase, tab, compose]);

  const run = async (work: () => Promise<Status>) => {
    setBusy(true);
    try {
      setStatus(await work());
    } catch (error) {
      setStatus({ text: errorText(error), kind: 'error' });
    } finally {
      setBusy(false);
      refreshSettings();
    }
  };

  const saveTo = (location: Location, override?: Partial<FileOptions>) => {
    if (!item && !isDocument)
      return;
    const opts = { ...options, ...override };
    void run(async () => {
      if (isDocument) {
        const result = await fileOfficeDocument(host ?? undefined, location, opts.comment, (text) => setStatus({ text, kind: '' }));
        if (result.saved.length)
          refreshPlace(location);
        return resultText(result, location);
      }
      const info = item!;
      const result = await fileMail(info, {
        target: location,
        message: opts.message,
        thread: opts.thread,
        attachments: info.attachments.filter((a) => opts.attachments.includes(a.id)),
        comment: opts.comment,
      }, (text) => setStatus({ text, kind: '' }));
      if (result.saved.length) {
        setFilings(await lookupFilings([info.messageId], info.conversationId).catch(() => filings));
        refreshPlace(location);
        if (latest.current.target && locationKey(latest.current.target) === locationKey(location))
          setTarget({ ...location });
      }
      return resultText(result, location);
    });
  };

  const dropFiles = (location: Location, files: File[]) => {
    void run(async () => {
      const result = await fileDropped(location, files, (text) => setStatus({ text, kind: '' }));
      refreshPlace(location);
      if (latest.current.target && locationKey(latest.current.target) === locationKey(location))
        setTarget({ ...location });
      return resultText(result, location);
    });
  };

  const createFolderIn = async (matterId: string, parentId: string | null, name: string) => {
    try {
      const created = await createFolder(matterId, name, parentId);
      const rows = await loadFolders(matterId, true);
      const client = latest.current.clients.find((row) => row.matters.some((m) => m.id === matterId));
      const matter = client?.matters.find((m) => m.id === matterId);
      if (client && matter) {
        pick({
          matterId,
          matterName: matter.name,
          matterCode: matter.code,
          clientId: client.id,
          clientName: client.name,
          folderId: created.id,
          folderPath: rows ? folderPath(rows, created.id) : [{ id: created.id, name }],
        });
      }
      setStatus({ text: `Папка «${name}» создана`, kind: 'ok' });
    } catch (error) {
      setStatus({ text: errorText(error), kind: 'error' });
    }
  };

  const toggleFavorite = async (kind: 'matter' | 'folder', id: string, matterId: string, on: boolean) => {
    try {
      await setFavorite(kind, id, matterId, on);
      await loadFavorites();
    } catch (error) {
      setStatus({ text: errorText(error), kind: 'error' });
    }
  };

  const openDoc = (doc: { matterId: string; folderId: string | null; id?: string; documentId?: string }) => {
    openInBrowser(hubDocumentUrl(HUB_ORIGIN, { matterId: doc.matterId, folderId: doc.folderId, documentId: doc.documentId ?? doc.id }));
  };

  const attachDoc = (doc: DocRow) => void run(async () => {
    setStatus({ text: `Вкладываем «${doc.name}»…`, kind: '' });
    await attachToDraft(doc.name, await documentContent(doc.id));
    return { text: `«${doc.name}» вложен в письмо`, kind: 'ok' };
  });

  const linkDoc = (doc: DocRow) => void run(async () => {
    await insertLinkInDraft(hubDocumentUrl(HUB_ORIGIN, { matterId: doc.matterId, folderId: doc.folderId, documentId: doc.id }), `${doc.docNumber} ${doc.name}`);
    return { text: 'Ссылка вставлена в письмо', kind: 'ok' };
  });

  const addRule = (match: string, autoFile: boolean) => {
    if (!target)
      return;
    const where = target;
    void run(async () => {
      await createMailRule({ match, matterId: where.matterId, folderId: where.folderId });
      if (autoFile && !mailboxRef.current?.enabled)
        await setMailAutofile(true);
      await reloadRules();
      return {
        text: `Правило: письма ${match} → ${locationLabel(where)}${autoFile ? '\nСервер будет сохранять такие письма сам, даже при закрытом Outlook' : ''}`,
        kind: 'ok',
      };
    });
  };

  const dropAt = useRef<(x: number, y: number) => Location | null>(() => null);
  dropAt.current = (x, y) => {
    const row = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-drop-matter]');
    if (!row)
      return latest.current.target;
    const matterId = row.dataset.dropMatter!;
    const folderId = row.dataset.dropFolder || null;
    const client = latest.current.clients.find((c) => c.matters.some((m) => m.id === matterId));
    const matter = client?.matters.find((m) => m.id === matterId);
    if (!client || !matter)
      return null;
    const rows = latest.current.folders[matterId];
    return {
      matterId,
      matterName: matter.name,
      matterCode: matter.code,
      clientId: client.id,
      clientName: client.name,
      folderId,
      folderPath: Array.isArray(rows) ? folderPath(rows, folderId) : [],
    };
  };
  const dropFilesRef = useRef(dropFiles);
  dropFilesRef.current = dropFiles;
  useEffect(() => {
    if (phase !== 'ready' || !isOutlook)
      return;
    onOutlookDrop((event) => {
      const location = dropAt.current(event.x, event.y);
      if (event.type === 'dragover') {
        setDropKey(location ? locationKey(location) : null);
        return;
      }
      setDropKey(null);
      if (!location) {
        setStatus({ text: 'Отпустите письмо над папкой в дереве', kind: 'error' });
        return;
      }
      if (event.files.length)
        dropFilesRef.current(location, event.files);
    });
  }, [phase, isOutlook]);

  if (phase === 'boot') {
    return (
      <main className="kf-boot" aria-busy="true">
        <Brand />
        <div className="kf-spinner" aria-hidden="true" />
        <p>Подключаемся к Kosta Hub…</p>
      </main>
    );
  }
  if (phase === 'signin')
    return (
      <SignInScreen busy={signInBusy} error={signInError} details={signInDetails} onSignIn={() => void signIn()}
        preferCode={isMobileOutlook()}
        code={{
          ticket: pairTicket,
          busy: pairBusy,
          onStart: () => void startCodeSignIn(),
          onOpen: () => {
            if (pairTicket)
              openInBrowser(pairTicket.verifyUrl);
          },
          onCancel: cancelCodeSignIn,
        }} />
    );

  const filtered = filterClients(clients, filter, { hideClosed });
  const selectedKey = target ? locationKey(target) : null;
  const favoriteSet = new Set([
    ...favorites.matters.map((m) => `matter:${m.id}`),
    ...favorites.folders.map((f) => `folder:${f.id}`),
  ]);
  const alreadyHere = Boolean(target && filings.some((f) => f.sameMessage && f.kind === 'email' && f.matterId === target.matterId));
  const sub = isDocument ? hostLabel(host ?? undefined) : compose ? 'Новое письмо' : item ? 'Письмо' : 'Выберите письмо';

  const favoritePlaces = [
    ...favorites.matters.map((m) => ({
      matterId: m.id, matterName: m.name, matterCode: m.code, clientId: m.clientId, clientName: m.clientName,
      folderId: null, folderPath: [], key: `fm:${m.id}`, icon: 'starOn' as const,
    })),
    ...favorites.folders.map((f) => ({
      matterId: f.matterId, matterName: f.matterName, matterCode: '', clientId: '', clientName: '',
      folderId: f.id, folderPath: [{ id: f.id, name: f.name }], key: `ff:${f.id}`, icon: 'starOn' as const,
    })),
  ];

  const pickById = (location: Location) => {
    void completeLocation(location.matterId, location.folderId, location).then(pick);
  };

  if (collapsed) {
    const saved = item?.mode === 'read' && filings.some((f) => f.sameMessage);
    return (
      <div className="kf-app is-collapsed">
        <button type="button" className="kf-strip" onClick={() => toggleCollapsed(false)} aria-label="Развернуть Kosta File" title="Развернуть">
          <img className="kf-strip__logo" src={`${ASSET_BASE}assets/logo.svg`} width="14" height="20" alt="" />
          <span className="kf-strip__name">Kosta Legal</span>
          {saved ? <span className="kf-strip__dot" title="Письмо сохранено" aria-label="Письмо сохранено" /> : null}
          <span className="kf-strip__toggle" aria-hidden="true"><Icon name="chevron" size={14} /></span>
        </button>
      </div>
    );
  }

  return (
    <div className={`kf-app${compose ? ' is-compose' : ''}`}>
      <header className="kf-top">
        <Brand sub={sub} />
        {item?.mode === 'read' ? (
          <MailStatus item={item} filings={filings} loading={contextLoading} onOpen={(f) => openDoc(f)} />
        ) : null}
        <div className="kf-top__tools">
          <button type="button" className="kf-iconbtn kf-iconbtn--collapse" title="Свернуть" aria-label="Свернуть панель" onClick={() => toggleCollapsed(true)}>
            <Icon name="chevron" />
          </button>
          <button type="button" className="kf-iconbtn" title="Обновить" aria-label="Обновить" onClick={() => {
            clearApiCaches();
            void loadClients(true);
            void loadFavorites();
            setFolders({});
            setDocs({});
            if (isOutlook)
              refreshItem();
          }}>
            <Icon name="refresh" />
          </button>
          <button type="button" className="kf-avatar kf-avatar--btn" title={`${profile?.displayName ?? ''} · настройки`} aria-label="Настройки" onClick={() => setSettingsOpen(true)}>
            {(profile?.displayName || '?').slice(0, 1).toUpperCase()}
          </button>
        </div>
      </header>

      <main className="kf-main">
        {pinTip ? (
          <div className="kf-tip" role="note">
            <Icon name="pin" />
            <p>Закрепите панель кнопкой <strong>📌</strong> в её заголовке — тогда она останется открытой при переходе между письмами.</p>
            <button type="button" className="kf-iconbtn" aria-label="Скрыть подсказку" onClick={() => {
              saveSettings({ pinTipDismissed: true });
              setPinTip(false);
            }}><Icon name="close" size={13} /></button>
          </div>
        ) : null}

        {isOutlook && !item ? <p className="kf-empty kf-empty--card">Выберите письмо в списке — здесь появится, где оно сохранено и куда его можно сохранить.</p> : null}
        {compose ? <p className="kf-empty kf-empty--card">Выберите документ в Kosta, чтобы вложить его в письмо или вставить ссылку.</p> : null}

        {item?.mode === 'read' ? (
          <Suggestions
            items={suggestions}
            sender={item.fromEmail}
            selectedKey={selectedKey}
            busy={busy}
            onPick={pick}
            onQuickFile={(location) => {
              pick(location);
              saveTo(location, { message: true, thread: false, attachments: [] });
            }}
          />
        ) : null}

        <nav className="kf-tabs" role="tablist" aria-label="Обзор">
          {([['tree', 'Папки', 'folder'], ['search', 'Поиск', 'search'], ['saved', 'Избранное', 'star']] as const).map(([id, label, icon]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'is-on' : ''} onClick={() => setTab(id)}>
              <Icon name={icon} size={14} />{label}
            </button>
          ))}
        </nav>

        {tab === 'tree' ? (
          <div className="kf-panel" role="tabpanel">
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
            <label className="kf-check kf-check--small">
              <input type="checkbox" checked={!hideClosed} onChange={(event) => setHideClosed(!event.target.checked)} />
              Показывать закрытые matters
            </label>
            {clients.length && !filtered.length && !filter.trim() ? (
              <p className="kf-empty">У вас пока нет доступных matters. Попросите партнёра добавить вас в команду проекта.</p>
            ) : null}
            {clientsError ? <p className="kf-alert kf-alert--error">{clientsError}</p> : null}
            {!clients.length && !clientsError ? <p className="kf-empty">Загрузка клиентов…</p> : (
              <FolderTree
                clients={filtered}
                autoExpand={Boolean(filter.trim())}
                expanded={expanded}
                onToggle={toggle}
                folders={folders}
                selectedKey={selectedKey}
                dropKey={dropKey}
                favorites={favoriteSet}
                onSelect={pick}
                onFavorite={(kind, id, matterId, on) => void toggleFavorite(kind, id, matterId, on)}
                onCreateFolder={createFolderIn}
                onDropFiles={dropFiles}
                files={{
                  docs,
                  onLoad: (matterId, folderId) => void loadDocs(matterId, folderId),
                  renderDoc: (doc) => (
                    <TreeDoc doc={doc} compose={compose} busy={busy} onOpen={openDoc} onAttach={attachDoc} onLink={linkDoc} />
                  ),
                }}
              />
            )}
          </div>
        ) : null}

        {tab === 'search' ? (
          <div className="kf-panel" role="tabpanel">
            <div className="kf-filter">
              <Icon name="search" size={14} />
              <input
                autoFocus
                className="kf-input kf-input--bare"
                value={query}
                placeholder="Название, описание или номер KL-…"
                aria-label="Поиск документов"
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            {results === null ? <p className="kf-empty">Введите хотя бы 2 символа. Ищем по всем доступным matters.</p> : null}
            {results === 'loading' ? <p className="kf-empty">Ищем…</p> : null}
            {Array.isArray(results) ? (
              <DocList
                docs={results}
                empty="Ничего не найдено"
                compose={compose}
                busy={busy}
                onOpen={openDoc}
                onAttach={attachDoc}
                onLink={linkDoc}
                onLocate={(doc) => {
                  void completeLocation(doc.matterId, doc.folderId, { matterName: doc.matterName, clientName: doc.clientName, clientId: doc.clientId }).then((location) => {
                    pick(location);
                    setTab('tree');
                  });
                }}
              />
            ) : null}
          </div>
        ) : null}

        {tab === 'saved' ? (
          <div className="kf-panel" role="tabpanel">
            <Section title="Избранное" icon="star">
              <PlaceList places={favoritePlaces} selectedKey={selectedKey} onPick={pickById} empty="Отмечайте matters и папки звёздочкой в дереве." />
            </Section>
            <Section title="Недавние места" icon="clock">
              <PlaceList places={recentToPlaces(recent)} selectedKey={selectedKey} onPick={pickById} empty="Здесь появятся папки, куда вы сохраняли." />
            </Section>
            {compose ? (
              <Section title="Недавние документы" icon="doc">
                <DocList docs={recentDocs} empty="Нет недавних документов" compose busy={busy} onOpen={openDoc} onAttach={attachDoc} onLink={linkDoc} />
              </Section>
            ) : null}
          </div>
        ) : null}

      </main>

      <Toast status={status} busy={busy} onClose={() => setStatus(null)} />

      {item?.mode === 'read' ? (
        <FileBar
          target={target}
          item={item}
          options={options}
          setOptions={setOptions}
          busy={busy}
          alreadyHere={alreadyHere}
          onSave={() => target && saveTo(target)}
          onClear={() => setTarget(null)}
          onRule={addRule}
          ruleFor={rule}
        />
      ) : null}

      {isDocument ? (
        <div className="kf-filebar">
          <div className="kf-filebar__target">
            {target ? <><Icon name="folder" className="kf-filebar__glyph" /><span className="kf-loc"><span className="kf-loc__matter">{locationLabel(target)}</span></span></> : <p className="kf-filebar__placeholder">Выберите папку для документа</p>}
          </div>
          <div className="kf-filebar__actions">
            <button type="button" className="kf-btn kf-btn--primary kf-btn--wide" disabled={!target || busy} onClick={() => target && saveTo(target)}>
              <Icon name="upload" size={15} />{busy ? 'Сохраняем…' : `Сохранить ${hostLabel(host ?? undefined)}`}
            </button>
          </div>
        </div>
      ) : null}

      {settingsOpen ? (
        <SettingsSheet
          profile={profile}
          onClose={() => setSettingsOpen(false)}
          onLogout={() => void logout()}
          mailbox={mailbox}
          serverReady={serverReady}
          onAutofile={(enabled) => void setMailAutofile(enabled).then(reloadRules, () => undefined)}
        />
      ) : null}
    </div>
  );
}
