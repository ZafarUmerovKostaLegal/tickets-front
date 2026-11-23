import { createRoot } from 'react-dom/client';
import zoomSdk from '@zoom/appssdk';
import '../styles.css';
import { checkZoomNow, deleteZoomLink, getZoomLink, saveZoomLink } from '../api';
import { signInWithZoomCode } from '../auth/authApi';
import { createPkcePair, randomState } from '../auth/pkce';
import { MeetingPanel, type MeetingSource } from '../meeting/MeetingPanel';
import { Brand } from '../ui/screens';

const container = document.getElementById('app');
if (!container)
  throw new Error('#app missing');
const root = createRoot(container);

const OUTSIDE = 'Откройте Kosta File во время встречи Zoom — вне встречи сохранять нечего.';

function applyTheme(): void {
  const params = new URLSearchParams(window.location.search);
  const dark = params.get('theme') === 'dark'
    || (!params.get('theme') && (window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false));
  document.body.dataset.theme = dark ? 'dark' : 'light';
}

let authorizeWaiter: ((event: { code: string; result: boolean; state?: string }) => void) | null = null;

async function zoomSignIn(): Promise<void> {
  const { verifier, challenge } = await createPkcePair();
  const state = randomState();
  const code = await new Promise<string>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('Zoom не ответил на вход — попробуйте ещё раз')), 120_000);
    authorizeWaiter = (event) => {
      window.clearTimeout(timer);
      authorizeWaiter = null;
      if (!event.result || !event.code)
        reject(new Error('Вход через Zoom отменён'));
      else if (event.state && event.state !== state)
        reject(new Error('Ответ Zoom не совпал с запросом входа'));
      else
        resolve(event.code);
    };
    zoomSdk.authorize({ codeChallenge: challenge, state }).catch((error: unknown) => {
      window.clearTimeout(timer);
      authorizeWaiter = null;
      reject(error instanceof Error ? error : new Error(String(error)));
    });
  });
  await signInWithZoomCode(code, verifier);
}

function zoomSource(uuid: string, meetingId: string, demo = false): MeetingSource {
  return {
    app: 'Zoom',
    load: () => getZoomLink(uuid),
    save: (body) => saveZoomLink({ uuid, meetingId, matterId: body.matterId, folderId: body.folderId, includeTranscript: body.includeTranscript }),
    remove: () => deleteZoomLink(uuid),
    check: () => checkZoomNow(uuid),
    signIn: demo ? undefined : zoomSignIn,
    recordNow: demo ? undefined : async () => {
      await zoomSdk.cloudRecording({ action: 'start' });
    },
  };
}

function OutsideZoom() {
  return (
    <main className="kf-teams">
      <Brand sub="Запись встречи" />
      <p className="kf-alert kf-alert--error">Эта страница открывается внутри Zoom. Добавьте Kosta File в Zoom (Приложения → Kosta File) и откройте его во встрече.</p>
    </main>
  );
}

async function start(): Promise<void> {
  applyTheme();
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('view') === 'demo') {
    root.render(<MeetingPanel source={zoomSource('demo-uuid==', '81234567890', true)} outside={OUTSIDE} />);
    return;
  }
  try {
    await zoomSdk.config({
      version: '0.16',
      capabilities: ['getRunningContext', 'getMeetingContext', 'getMeetingUUID', 'authorize', 'onAuthorized', 'cloudRecording'],
    });
  } catch {
    root.render(<OutsideZoom />);
    return;
  }
  zoomSdk.onAuthorized((event) => authorizeWaiter?.(event));

  let source: MeetingSource | null = null;
  try {
    const { context } = await zoomSdk.getRunningContext();
    if (context === 'inMeeting') {
      const [{ meetingUUID }, { meetingID }] = await Promise.all([zoomSdk.getMeetingUUID(), zoomSdk.getMeetingContext()]);
      const meetingId = String(meetingID ?? '').replace(/\D/g, '');
      if (meetingUUID && meetingId)
        source = zoomSource(meetingUUID, meetingId);
    }
  } catch {
    source = null;
  }
  root.render(<MeetingPanel source={source} outside={OUTSIDE} />);
}

void start();
