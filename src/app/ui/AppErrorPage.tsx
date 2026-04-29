import { useMemo, useState } from 'react';
import { logout } from '@shared/lib';
import '../styles/AppErrorPage.css';
type AppErrorPageProps = {
    message?: string;
    onRetry: () => void;
};
const DEFAULT_HINT = 'Не удалось загрузить данные. Проверьте подключение к интернету или повторите попытку.';
function friendlyErrorText(raw: string | undefined): string {
    const t = raw?.trim() ?? '';
    if (!t)
        return DEFAULT_HINT;
    if (/failed to fetch|networkerror|load failed/i.test(t)) {
        return 'Не удалось связаться с сервером. Проверьте интернет и попробуйте ещё раз.';
    }
    if (/401|unauthorized/i.test(t))
        return 'Сессия истекла. Выйдите и войдите снова или повторите попытку.';
    if (/403|forbidden/i.test(t))
        return 'Нет доступа к сервису. Обратитесь к администратору.';
    if (/5\d\d|server error/i.test(t))
        return 'На сервере временные неполадки. Попробуйте позже.';
    return t;
}
export function AppErrorPage({ message, onRetry }: AppErrorPageProps) {
    const [retrying, setRetrying] = useState(false);
    const handleRetry = () => {
        setRetrying(true);
        onRetry();
    };
    const handleLogout = () => {
        logout();
    };
    const hint = useMemo(() => friendlyErrorText(message), [message]);
    return (<div className="app-error">
      <div className="app-error__bg" aria-hidden>
        <div className="app-error__mesh"/>
        <div className="app-error__orb app-error__orb--a"/>
        <div className="app-error__orb app-error__orb--b"/>
      </div>

      <div className="app-error__card" role="alert">
        <div className="app-error__card-accent" aria-hidden/>
        <div className="app-error__left">
          <div className="app-error__glow" aria-hidden/>
          <div className="app-error__icon-wrap">
            <div className="app-error__icon" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                <path d="M12 16h.01"/>
              </svg>
            </div>
          </div>
          <p className="app-error__eyebrow">Ошибка загрузки</p>
          <h1 className="app-error__title">Что-то пошло не так</h1>
          <p className="app-error__text">{hint}</p>
          <div className="app-error__chips" aria-hidden>
            <span className="app-error__chip">Сервер</span>
            <span className="app-error__chip">Сеть</span>
            <span className="app-error__chip">Сессия</span>
          </div>
        </div>

        <div className="app-error__right">
          <p className="app-error__hint-title">Что можно сделать сейчас</p>
          <ul className="app-error__hint-list">
            <li>Проверьте подключение к интернету и VPN.</li>
            <li>Обновите страницу или повторите запрос.</li>
            <li>Если ошибка повторяется, выйдите и войдите снова.</li>
          </ul>

          <div className="app-error__actions">
            <button type="button" className={`app-error__btn app-error__btn--primary${retrying ? ' app-error__btn--loading' : ''}`} onClick={handleRetry} disabled={retrying}>
              {retrying ? (<span className="app-error__spinner" aria-hidden/>) : (<>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 2v6h-6"/>
                    <path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
                    <path d="M3 22v-6h6"/>
                    <path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
                  </svg>
                  Повторить
                </>)}
            </button>
            <button type="button" className="app-error__btn app-error__btn--secondary" onClick={handleLogout}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Выйти
            </button>
          </div>
        </div>
      </div>
    </div>);
}
