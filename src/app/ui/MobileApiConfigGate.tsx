import type { ReactNode } from 'react';
import { getApiBaseUrl } from '@shared/config';
import { isTauriAndroidBuild } from '@shared/config/tauriPlatform';

type MobileApiConfigGateProps = {
    children: ReactNode;
};


export function MobileApiConfigGate({ children }: MobileApiConfigGateProps) {
    if (!isTauriAndroidBuild() || getApiBaseUrl()) {
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
            <div style={{ maxWidth: '22rem', textAlign: 'center' }}>
                <h1 style={{ fontSize: '1.15rem', margin: '0 0 0.75rem' }}>Нужен адрес API</h1>
                <p style={{ margin: '0 0 1rem', lineHeight: 1.5, color: '#475569' }}>
                    Соберите APK с переменной{' '}
                    <code style={{ fontSize: '0.85em' }}>VITE_API_BASE_URL</code> — публичный URL gateway,
                    доступный с телефона (не localhost).
                </p>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                    Пример: скопируйте <code>.env.android.example</code> в <code>.env.android</code> и выполните{' '}
                    <code>npm run android:build:apk:debug</code>
                </p>
            </div>
        </div>
    );
}
