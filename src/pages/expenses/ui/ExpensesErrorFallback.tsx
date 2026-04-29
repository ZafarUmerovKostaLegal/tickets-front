import { useRouteError, Link } from 'react-router-dom';
import { routes } from '@shared/config';
import './ExpensesPage.css';
export function ExpensesErrorFallback() {
    const err = useRouteError();
    const message = err instanceof Error ? err.message : String(err);
    const staleEquivBug = message.includes('equivalentAmount') && message.includes('toFixed');
    const hardReload = () => {
        const u = new URL(window.location.href);
        u.searchParams.set('v', String(Date.now()));
        window.location.replace(u.toString());
    };
    return (<div className="expenses-page" style={{ minHeight: '70vh' }}>
      <main className="expenses-page__main">
        <div className="expenses-page__content">
          <div className="exp-service-err" role="alert">
            <h2 className="exp-service-err__title">Не удалось показать раздел расходов</h2>
            <p className="exp-service-err__desc">
              {staleEquivBug ? (<>
                  Сообщение <code>e.equivalentAmount.toFixed is not a function</code> почти всегда значит, что
                  загружена <strong>устаревшая сборка</strong> фронта (кэш браузера, CDN или прокси). В текущем коде
                  репозитория эта ошибка устранена — нужна <strong>новая выкладка</strong> и сброс кэша.
                </>) : (message)}
            </p>
            <p className="exp-service-err__desc">
              Попробуйте жёсткое обновление: <strong>Ctrl+Shift+R</strong> (Windows/Linux) или{' '}
              <strong>Cmd+Shift+R</strong> (macOS), либо окно инкогнито. На сервере для <code>index.html</code>{' '}
              не задавайте длинный <code>Cache-Control</code> — иначе браузер не увидит новые имена{' '}
              <code>index-*.js</code>.
            </p>
            <div style={{
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            justifyContent: 'center',
            marginTop: 8,
        }}>
              <button type="button" className="exp-service-err__btn" onClick={() => window.location.reload()}>
                Обновить страницу
              </button>
              <button type="button" className="exp-service-err__btn" onClick={hardReload}>
                Перезагрузить с ?v=…
              </button>
              <Link to={routes.home} className="exp-service-err__btn" style={{ textDecoration: 'none', marginTop: '0.5rem' }}>
                На главную
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>);
}
