import './bufferPolyfill';
import './processPolyfill';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@app';
import { injectPublicEnv } from '@shared/config';
import { applyTheme, getInitialTheme } from '@shared/lib/theme';
injectPublicEnv();
applyTheme(getInitialTheme());
const root = document.getElementById('root');
if (!root)
    throw new Error('Root element not found');
createRoot(root).render(<StrictMode>
    <App />
</StrictMode>);
