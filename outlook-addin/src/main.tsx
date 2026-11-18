import { Component, type ErrorInfo, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { App } from './ui/App';

declare global {
  interface Window {
    __kfStarted?: boolean;
    __kfStage?: string;
    __kfFatal?: (title: string, text: string) => void;
    __kfDiagnostics?: () => string;
  }
}

/** Outlook / Office theme → light or dark pane (falls back to the OS setting). */
function applyTheme(): void {
  let dark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  try {
    const background = Office?.context?.officeTheme?.bodyBackgroundColor;
    if (background && /^#?[0-9a-f]{6}$/i.test(background)) {
      const hex = background.replace('#', '');
      const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
      dark = (0.2126 * r! + 0.7152 * g! + 0.0722 * b!) < 128;
    }
  } catch {
    /* keep OS preference */
  }
  document.body.dataset.theme = dark ? 'dark' : 'light';
}

/** A render crash must show what happened instead of an empty pane. */
class CrashGuard extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Kosta File crashed', error, info.componentStack);
  }

  render() {
    if (!this.state.error)
      return this.props.children;
    return (
      <div className="kf-fatal" role="alert">
        <h1>Kosta File не запустился</h1>
        <p>Закройте и снова откройте панель. Если ошибка повторяется, пришлите текст ниже администратору.</p>
        <pre>{`${this.state.error.message}
${window.__kfDiagnostics?.() ?? navigator.userAgent}`}</pre>
        <p><button type="button" className="kf-btn" onClick={() => window.location.reload()}>Перезапустить</button></p>
      </div>
    );
  }
}

window.__kfStage = 'приложение загружено, ждём Office.onReady';

const container = document.getElementById('app');
if (!container)
  throw new Error('#app missing');
const root = createRoot(container);

function start(host: Office.HostType | null): void {
  window.__kfStarted = true;
  window.__kfStage = `запущено (${host ?? 'без хоста'})`;
  // Drop the start-up warning if Office answered after it was shown.
  container!.replaceChildren();
  applyTheme();
  root.render(<CrashGuard><App host={host} /></CrashGuard>);
}

if (typeof Office !== 'undefined' && typeof Office.onReady === 'function') {
  Office.onReady((info) => start(info.host ?? null)).catch((error: unknown) => {
    window.__kfStage = `Office.onReady отклонён: ${String(error)}`;
    window.__kfFatal?.('Office не готов', 'Office не смог запустить надстройку. Закройте и снова откройте панель.');
  });
} else if (import.meta.env.DEV) {
  start(null);
} else {
  window.__kfFatal?.(
    'Не загрузилась библиотека Office',
    'Панель не смогла загрузить office.js с appsforoffice.microsoft.com. Проверьте доступ в интернет или прокси и откройте панель снова.',
  );
}
