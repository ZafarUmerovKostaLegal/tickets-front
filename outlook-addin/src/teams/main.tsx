import { createRoot } from 'react-dom/client';
import { app, pages } from '@microsoft/teams-js';
import '../styles.css';
import { enableHostAuthBridge, preferExternalDialogAuth } from '../auth/naa';
import { Brand } from '../ui/screens';
import { checkMeetingNow, deleteMeetingLink, getMeetingLink, saveMeetingLink } from '../api';
import { MeetingPanel, type MeetingSource } from '../meeting/MeetingPanel';
import { MeetingsHome } from '../meeting/MeetingsHome';

const container = document.getElementById('app');
if (!container)
  throw new Error('#app missing');
const root = createRoot(container);
const view = new URLSearchParams(window.location.search).get('view');

function applyTheme(theme: string | undefined): void {
  const dark = theme === 'dark' || theme === 'contrast'
    || (!theme && (window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false));
  document.body.dataset.theme = dark ? 'dark' : 'light';
}

const OUTSIDE = 'Откройте Kosta File из Apps во время собрания Teams — вне встречи сохранять нечего.';

function teamsSource(chatId: string | null): MeetingSource | null {
  if (!chatId)
    return null;
  return {
    app: 'Teams',
    autoRecord: true,
    load: () => getMeetingLink(chatId),
    save: (body) => saveMeetingLink({ chatId, ...body }),
    remove: () => deleteMeetingLink(chatId),
    check: () => checkMeetingNow(chatId),
  };
}

function ConfigPage() {
  return (
    <main className="kf-teams">
      <Brand sub="Запись встречи" />
      <p className="kf-teams__label">
        Нажмите «Сохранить» / «Add» в шапке Teams — Kosta File откроется в боковой панели этой встречи.
      </p>
    </main>
  );
}

function OutsideTeams() {
  return (
    <main className="kf-teams">
      <Brand sub="Запись встречи" />
      <p className="kf-alert kf-alert--error">Эта страница открывается внутри Microsoft Teams.</p>
    </main>
  );
}

function inMeetingContext(context: app.Context): boolean {
  if (context.meeting?.id)
    return true;
  const frame = String(context.page?.frameContext ?? '');
  return Boolean(context.chat?.id) && (frame === 'sidePanel' || frame === 'meetingStage' || frame === 'content');
}

async function start(): Promise<void> {
  if (import.meta.env.DEV && view === 'home') {
    applyTheme(new URLSearchParams(window.location.search).get('theme') ?? 'default');
    root.render(<MeetingsHome />);
    return;
  }
  if (import.meta.env.DEV && view === 'demo') {
    applyTheme(new URLSearchParams(window.location.search).get('theme') ?? 'default');
    root.render(<MeetingPanel source={teamsSource('19:meeting_demo@thread.v2')} outside={OUTSIDE} />);
    return;
  }
  try {
    await app.initialize();
  } catch {
    applyTheme(undefined);
    root.render(<OutsideTeams />);
    return;
  }
  const context = await app.getContext();
  applyTheme(context.app.theme);
  app.registerOnThemeChangeHandler(applyTheme);

  if (view === 'config') {
    pages.config.registerOnSaveHandler((event) => {
      const base = new URL(import.meta.env.BASE_URL || '/', window.location.origin).href;
      pages.config.setConfig({
        entityId: 'kosta-file-meeting',
        contentUrl: `${base}teams.html`,
        suggestedDisplayName: 'Kosta File',
      }).then(() => event.notifySuccess(), (error: unknown) => event.notifyFailure(String(error)));
    });
    pages.config.setValidityState(true);
    root.render(<ConfigPage />);
    return;
  }

  preferExternalDialogAuth(true);
  enableHostAuthBridge(false);

  const chatId = context.chat?.id ?? null;
  if (!chatId || !inMeetingContext(context)) {
    root.render(<MeetingsHome />);
    return;
  }

  root.render(<MeetingPanel source={teamsSource(chatId)} outside={OUTSIDE} />);
}

void start();
