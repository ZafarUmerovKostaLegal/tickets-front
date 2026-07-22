import { useRouteError, isRouteErrorResponse } from 'react-router-dom';
import { routes } from '@shared/config';
import {
    isLikelyStaleBundleErrorMessage,
    STALE_BUNDLE_USER_MESSAGE,
} from '@app/lib/staleBundleError';

function routeErrorToText(err: unknown): string {
    if (isRouteErrorResponse(err))
        return err.statusText || `HTTP ${err.status}`;
    if (err instanceof Error)
        return err.message;
    return String(err ?? '');
}
export function AppRouteError() {
    const err = useRouteError();
    const message = routeErrorToText(err);
    const likelyStale = isLikelyStaleBundleErrorMessage(message);
    return (<div
      style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            boxSizing: 'border-box',
            background: '#0f172a',
            color: '#e2e8f0',
            fontFamily: "'Montserrat', system-ui, sans-serif",
            fontSize: '16px',
            lineHeight: 1.5,
        }}
    >
      <div style={{ maxWidth: '32rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.75rem' }}>
          {likelyStale ? 'Нужно обновить страницу' : 'Сбой при загрузке интерфейса'}
        </h1>
        <p style={{ margin: '0 0 1rem', opacity: 0.92 }}>
          {likelyStale
            ? STALE_BUNDLE_USER_MESSAGE
            : 'Попробуйте обновить страницу. Если ошибка повторяется — проверьте сеть и зайдите снова.'}
        </p>
        {message && !likelyStale
          ? (<details style={{ margin: '0 0 1rem', textAlign: 'left', opacity: 0.8, fontSize: '0.875rem' }}>
            <summary style={{ cursor: 'pointer' }}>Текст ошибки</summary>
            <pre
              style={{
                    margin: '0.5rem 0 0',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontFamily: "'Montserrat', system-ui, sans-serif",
                }}
            >
              {message}
            </pre>
          </details>)
          : null}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
                padding: '0.6rem 1.1rem',
                borderRadius: '0.5rem',
                border: 'none',
                background: '#4f46e5',
                color: '#fff',
                font: 'inherit',
                cursor: 'pointer',
            }}
          >
            Обновить страницу
          </button>
          <a
            href={routes.home}
            style={{ alignSelf: 'center', color: '#93c5fd', textDecoration: 'underline' }}
          >
            На главную
          </a>
        </div>
      </div>
    </div>);
}
