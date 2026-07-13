import type { ReactNode } from 'react';
import { getApiBaseUrl } from '@shared/config';
import { isTauriDesktopClient } from '@shared/config/desktopClient';

type DesktopApiConfigGateProps = {
    children: ReactNode;
};

export function DesktopApiConfigGate({ children }: DesktopApiConfigGateProps) {
    if (!isTauriDesktopClient() || getApiBaseUrl()) {
        return <>{children}</>;
    }

    return (
        <div
            role="alert"
            style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1.5rem',
                boxSizing: 'border-box',
                fontFamily: "'Montserrat', system-ui, sans-serif",
                background: '#f8fafc',
                color: '#0f172a',
            }}
        >
            <div style={{ maxWidth: '24rem', textAlign: 'center' }}>
                <h1 style={{ fontSize: '1.15rem', margin: '0 0 0.75rem' }}>Нужен адрес API</h1>
                <p style={{ margin: '0 0 1rem', lineHeight: 1.5, color: '#475569' }}>
                    Соберите desktop-приложение с переменной{' '}
                    <code style={{ fontSize: '0.85em' }}>VITE_API_BASE_URL</code> — публичный URL gateway
                    (например, <code>https://ticketsback.kostalegal.com</code>).
                </p>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                    Убедитесь, что файл <code>.env</code> существует перед командой{' '}
                    <code>npm run desktop:build</code>.
                </p>
            </div>
        </div>
    );
}
