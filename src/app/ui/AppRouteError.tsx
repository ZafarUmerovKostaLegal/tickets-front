import { useRouteError, isRouteErrorResponse } from 'react-router-dom';
import { routes } from '@shared/config';
import { hardReloadWithCacheBust, isLikelyStaleBundleErrorMessage } from '@app/lib/staleBundleError';

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
            fontFamily: 'system-ui, "Segoe UI", sans-serif',
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
            ? 'Часто это происходит после выката новой версии: в кэше осталась старая страница, а скрипты и стили на сервере уже с другими именами. Нажмите «Обновить» или сделайте жёсткое обновление: Ctrl+Shift+R (Cmd+Shift+R на macOS).'
            : 'Попробуйте обновить страницу. Если ошибка повторяется — проверьте сеть и зайдите снова.'}
        </p>
        {message
          ? (<details style={{ margin: '0 0 1rem', textAlign: 'left', opacity: 0.8, fontSize: '0.875rem' }}>
            <summary style={{ cursor: 'pointer' }}>Текст ошибки</summary>
            <pre
              style={{
                    margin: '0.5rem 0 0',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontFamily: 'ui-monospace, monospace',
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
          <button
            type="button"
            onClick={hardReloadWithCacheBust}
            style={{
                padding: '0.6rem 1.1rem',
                borderRadius: '0.5rem',
                border: '1px solid rgba(226, 232, 240, 0.35)',
                background: 'transparent',
                color: '#e2e8f0',
                font: 'inherit',
                cursor: 'pointer',
            }}
          >
            Сбросить кэш (?…)
          </button>
          <a
            href={routes.home}
            style={{ alignSelf: 'center', color: '#93c5fd', textDecoration: 'underline' }}
          >
            На главную
          </a>
        </div>
        <p style={{ margin: '1.25rem 0 0', fontSize: '0.8rem', opacity: 0.7 }}>
          Для сервера: убедитесь, что HTML не отдаётся с длинным Cache-Control, иначе клиенты долго не получают
          ссылки на новые файлы в /assets/.
        </p>
      </div>
    </div>);
}
