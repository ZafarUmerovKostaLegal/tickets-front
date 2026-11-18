import { createRoot } from 'react-dom/client';
import './styles.css';
import { App } from './ui/App';

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

const container = document.getElementById('app');
if (!container)
  throw new Error('#app missing');
const root = createRoot(container);

function start(host: Office.HostType | null): void {
  applyTheme();
  root.render(<App host={host} />);
}

if (typeof Office !== 'undefined' && typeof Office.onReady === 'function')
  void Office.onReady((info) => start(info.host ?? null));
else
  start(null);
