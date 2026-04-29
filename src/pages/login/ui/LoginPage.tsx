import { useState } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { getAzureLoginUrl, AUTH_ERROR_AUTH_FAILED } from '@shared/config';
import './LoginPage.css';
type LoginLocationState = {
    from?: {
        pathname: string;
    };
    blocked?: boolean;
    archived?: boolean;
};
export function LoginPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [searchParams] = useSearchParams();
    const { state } = useLocation() as {
        state?: LoginLocationState;
    };
    const error = searchParams.get('error');
    const blockedMsg = state?.blocked ? 'Ваш аккаунт заблокирован. Обратитесь к администратору.' : null;
    const archivedMsg = state?.archived ? 'Ваш аккаунт в архиве. Обратитесь к администратору.' : null;
    const statusMsg = blockedMsg ?? archivedMsg;
    function handleLogin() {
        if (isLoading)
            return;
        setIsLoading(true);
        window.location.href = getAzureLoginUrl();
    }
    return (<div className="lp">
      <div className="lp__bg" aria-hidden>
        <div className="lp__mesh"/>
      </div>

      <div className="lp__form-panel">
        <div className="lp__card">
          <div className="lp__card-glow"/>
          <div className="lp__badge">Kosta Legal</div>

          <div className="lp__card-header">
            <div className="lp__card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <h2 className="lp__card-title">Добро пожаловать</h2>
            <p className="lp__card-sub">Войдите через корпоративный аккаунт <strong>Microsoft 365</strong></p>
          </div>

          {(error || statusMsg) && (<div className="lp__error" role="alert">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span>
                {statusMsg ?? (error === AUTH_ERROR_AUTH_FAILED
                ? 'Ошибка входа. Сервис авторизации недоступен. Попробуйте позже.'
                : 'Ошибка входа. Попробуйте снова.')}
              </span>
            </div>)}

          <button type="button" className={`lp__btn${isLoading ? ' lp__btn--loading' : ''}`} onClick={handleLogin} disabled={isLoading} aria-label="Войти через Microsoft" aria-busy={isLoading}>
            <span className="lp__btn-shine"/>
            {isLoading ? (<span className="lp__btn-spinner" aria-hidden/>) : (<>
                <span className="lp__btn-ms-icon">
                  <svg viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect width="10" height="10" fill="#F25022"/>
                    <rect x="11" width="10" height="10" fill="#7FBA00"/>
                    <rect y="11" width="10" height="10" fill="#00A4EF"/>
                    <rect x="11" y="11" width="10" height="10" fill="#FFB900"/>
                  </svg>
                </span>
                <span>Войти через Microsoft</span>
              </>)}
          </button>

          <p className="lp__card-note">
            Проблемы со входом? <a className="lp__card-link" href="mailto:it@kostalegal.com">Обратитесь в IT-службу</a>
          </p>
        </div>
      </div>
    </div>);
}
