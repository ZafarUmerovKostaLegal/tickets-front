import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  checkMeetingNow,
  checkZoomNow,
  clearApiCaches,
  deleteMeetingLink,
  deleteZoomLink,
  listMyMeetingLinks,
  setUnauthorizedHandler,
  type MeetingLinkDto,
} from '../api';
import { loginWithHub, logoutHub, signInSilently } from '../auth/authApi';
import type { AuthProfile } from '../auth/session';
import { Icon } from '../ui/icons';
import { formatDate } from '../ui/panels';
import { Brand, SignInScreen } from '../ui/screens';

type Phase = 'boot' | 'signin' | 'ready';
type Notice = { text: string; kind: 'ok' | 'error' } | null;

const SIGN_IN_INTRO = 'Kosta File сохраняет записи и расшифровки встреч Teams в matters файлового менеджера. Вход выполняется рабочей учётной записью Microsoft и запоминается.';
const ZOOM_PREFIX = 'zoom:';

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isZoom(link: MeetingLinkDto): boolean {
  return link.provider === 'zoom' || link.chatId.startsWith(ZOOM_PREFIX);
}

function meetingTime(link: MeetingLinkDto): string {
  if (!link.startsAt)
    return '';
  const date = new Date(link.startsAt);
  if (Number.isNaN(date.getTime()))
    return '';
  return `${formatDate(link.startsAt)}, ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
}

function linkState(link: MeetingLinkDto): { label: string; tone: 'ok' | 'wait' | 'error' | 'off' } {
  if (!link.enabled)
    return { label: 'Отключена', tone: 'off' };
  if (link.lastError)
    return { label: 'Ошибка', tone: 'error' };
  if (link.filedTotal > 0)
    return { label: `Сохранено: ${link.filedTotal}`, tone: 'ok' };
  return { label: 'Ждём запись', tone: 'wait' };
}

function MeetingCard({ link, busy, onCheck, onRemove }: {
  link: MeetingLinkDto;
  busy: boolean;
  onCheck: () => void;
  onRemove: () => void;
}) {
  const state = linkState(link);
  const when = meetingTime(link);
  return (
    <li className="kf-mtg">
      <div className="kf-mtg__head">
        <span className={`kf-mtg__app kf-mtg__app--${isZoom(link) ? 'zoom' : 'teams'}`}>{isZoom(link) ? 'Zoom' : 'Teams'}</span>
        <span className={`kf-mtg__state kf-mtg__state--${state.tone}`}>{state.label}</span>
      </div>
      <p className="kf-mtg__topic">{link.topic || 'Встреча без темы'}</p>
      {when ? <p className="kf-mtg__when"><Icon name="clock" size={13} />{when}</p> : null}
      <p className="kf-mtg__where">
        <Icon name="folder" size={14} />
        <span>
          {link.matterCode ? <b>{link.matterCode}</b> : null}
          {link.matterName}
          {link.folderPath ? <em> / {link.folderPath}</em> : null}
        </span>
      </p>
      <p className="kf-mtg__meta">
        {link.includeTranscript ? 'Запись и расшифровка' : 'Только запись'}
        {link.lastFiledAt ? ` · последний файл ${formatDate(link.lastFiledAt)}` : ''}
      </p>
      {link.lastError ? <p className="kf-alert kf-alert--error">{link.lastError}</p> : null}
      <div className="kf-mtg__actions">
        <button type="button" className="kf-btn" disabled={busy || !link.enabled} onClick={onCheck}>
          <Icon name="refresh" size={14} />Проверить запись
        </button>
        {link.canEdit ? (
          <button type="button" className="kf-btn kf-btn--danger" disabled={busy} onClick={onRemove}>
            <Icon name="trash" size={14} />Отвязать
          </button>
        ) : null}
      </div>
    </li>
  );
}

export function MeetingsHome() {
  const [phase, setPhase] = useState<Phase>('boot');
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [signInBusy, setSignInBusy] = useState(false);
  const [signInError, setSignInError] = useState('');
  const [links, setLinks] = useState<MeetingLinkDto[] | null>(null);
  const [serverReady, setServerReady] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    let alive = true;
    void signInSilently().then((me) => {
      if (!alive)
        return;
      setProfile(me);
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

  const load = useCallback(async () => {
    try {
      const data = await listMyMeetingLinks();
      setLinks(data.links);
      setServerReady(data.serverReady);
      if (!data.links.length)
        setShowHelp(true);
    } catch (error) {
      setLinks([]);
      setNotice({ text: errorText(error), kind: 'error' });
    }
  }, []);

  useEffect(() => {
    if (phase === 'ready')
      void load();
  }, [phase, load]);

  const signIn = async () => {
    setSignInBusy(true);
    setSignInError('');
    try {
      setProfile(await loginWithHub());
      setPhase('ready');
    } catch (error) {
      setSignInError(errorText(error));
    } finally {
      setSignInBusy(false);
    }
  };

  const check = async (link: MeetingLinkDto) => {
    setBusyId(link.id);
    setNotice(null);
    try {
      if (isZoom(link))
        await checkZoomNow(link.chatId.slice(ZOOM_PREFIX.length));
      else
        await checkMeetingNow(link.chatId);
      setNotice({ text: `Ищем запись встречи «${link.topic || 'без темы'}». Если она уже готова, файл появится в папке через минуту.`, kind: 'ok' });
      window.setTimeout(() => void load(), 20_000);
    } catch (error) {
      setNotice({ text: errorText(error), kind: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (link: MeetingLinkDto) => {
    setBusyId(link.id);
    setNotice(null);
    try {
      if (isZoom(link))
        await deleteZoomLink(link.chatId.slice(ZOOM_PREFIX.length));
      else
        await deleteMeetingLink(link.chatId);
      setLinks((prev) => (prev ?? []).filter((row) => row.id !== link.id));
      setNotice({ text: 'Встреча отвязана. Её записи больше не сохраняются.', kind: 'ok' });
    } catch (error) {
      setNotice({ text: errorText(error), kind: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const logout = async () => {
    await logoutHub();
    setProfile(null);
    setLinks(null);
    setPhase('signin');
  };

  const stats = useMemo(() => {
    const rows = links ?? [];
    return {
      total: rows.length,
      files: rows.reduce((sum, row) => sum + (row.filedTotal || 0), 0),
      waiting: rows.filter((row) => row.enabled && !row.filedTotal && !row.lastError).length,
    };
  }, [links]);

  if (phase === 'boot')
    return <main className="kf-home"><div className="kf-home__inner"><Brand sub="Записи встреч" /><p className="kf-empty">Загрузка…</p></div></main>;
  if (phase === 'signin')
    return <SignInScreen busy={signInBusy} error={signInError} intro={SIGN_IN_INTRO} onSignIn={() => void signIn()} />;

  return (
    <main className="kf-home">
      <div className="kf-home__inner">
        <header className="kf-home__top">
          <Brand sub="Записи встреч" />
          <div className="kf-home__tools">
            {profile ? <span className="kf-home__user" title={profile.email}>{profile.displayName || profile.email}</span> : null}
            <button type="button" className="kf-iconbtn" title="Обновить" aria-label="Обновить" onClick={() => {
              clearApiCaches();
              setLinks(null);
              void load();
            }}>
              <Icon name="refresh" />
            </button>
            <button type="button" className="kf-iconbtn" title="Выйти" aria-label="Выйти" onClick={() => void logout()}>
              <Icon name="logout" />
            </button>
          </div>
        </header>

        {!serverReady ? <p className="kf-alert kf-alert--error">Сохранение записей Teams ещё не настроено на сервере. Обратитесь к администратору.</p> : null}

        <section className="kf-home__stats" aria-label="Сводка">
          <div><strong>{stats.total}</strong><span>встреч привязано</span></div>
          <div><strong>{stats.files}</strong><span>файлов сохранено</span></div>
          <div><strong>{stats.waiting}</strong><span>ждут запись</span></div>
        </section>

        <section className="kf-home__help">
          <button type="button" className="kf-home__help-toggle" aria-expanded={showHelp} onClick={() => setShowHelp((on) => !on)}>
            <Icon name="record" size={14} />
            Как сохранить запись встречи
            <span className={showHelp ? 'kf-home__chev is-open' : 'kf-home__chev'} aria-hidden="true"><Icon name="chevron" size={14} /></span>
          </button>
          {showHelp ? (
            <ol className="kf-home__steps">
              <li><b>Откройте собрание</b><span>Присоединитесь к встрече Teams, которую нужно сохранить.</span></li>
              <li><b>Apps → Kosta File</b><span>В панели собрания нажмите «Apps» (+) и выберите Kosta File.</span></li>
              <li><b>Выберите matter</b><span>Укажите matter и папку — после встречи запись и расшифровка появятся там сами.</span></li>
            </ol>
          ) : null}
        </section>

        <section className="kf-home__list" aria-label="Мои встречи">
          <h2>Мои встречи</h2>
          {links === null ? <p className="kf-empty">Загрузка встреч…</p> : null}
          {links && !links.length ? (
            <div className="kf-home__empty">
              <Icon name="record" size={22} />
              <p>Вы ещё не привязали ни одной встречи.</p>
              <span>Откройте Kosta File внутри собрания Teams — встреча появится здесь.</span>
            </div>
          ) : null}
          {links && links.length ? (
            <ul className="kf-mtg-grid">
              {links.map((link) => (
                <MeetingCard
                  key={link.id}
                  link={link}
                  busy={busyId === link.id}
                  onCheck={() => void check(link)}
                  onRemove={() => void remove(link)}
                />
              ))}
            </ul>
          ) : null}
        </section>

        {notice ? <p className={`kf-alert ${notice.kind === 'error' ? 'kf-alert--error' : 'kf-alert--ok'}`} role="status">{notice.text}</p> : null}
      </div>
    </main>
  );
}
