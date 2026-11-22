import { createRoot } from 'react-dom/client';
import { app, nestedAppAuth, pages } from '@microsoft/teams-js';
import '../styles.css';
import { enableHostAuthBridge } from '../auth/naa';
import { Brand } from '../ui/screens';
import { MeetingPanel } from './MeetingPanel';

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

function ConfigPage() {
  return (
    <main className="kf-teams">
      <Brand sub="Запись встречи" />
      <p className="kf-teams__label">
        Kosta File появится в панели встречи. Выберите там matter и папку — запись и расшифровка встречи сохранятся в Kosta Hub автоматически.
      </p>
      <p className="kf-teams__label">Нажмите «Сохранить», чтобы добавить приложение.</p>
    </main>
  );
}

function OutsideTeams() {
  return (
    <main className="kf-teams">
      <Brand sub="Запись встречи" />
      <p className="kf-alert kf-alert--error">Эта страница открывается внутри Microsoft Teams. Добавьте Kosta File во встречу Teams.</p>
    </main>
  );
}

async function start(): Promise<void> {
  if (import.meta.env.DEV && view === 'demo') {
    applyTheme(new URLSearchParams(window.location.search).get('theme') ?? 'default');
    root.render(<MeetingPanel chatId="19:meeting_demo@thread.v2" />);
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

  try {
    enableHostAuthBridge(nestedAppAuth.isNAAChannelRecommended());
  } catch {
    enableHostAuthBridge(false);
  }
  root.render(<MeetingPanel chatId={context.chat?.id ?? null} />);
}

void start();
