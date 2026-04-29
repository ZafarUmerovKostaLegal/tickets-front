import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { setAccessToken, setSessionCookieHint } from '@shared/lib';
import { useSessionCookieOnly } from '@shared/config';
import { refreshCurrentUser } from '@shared/hooks';
import { routes } from '@shared/config';
function parseCallbackParams(): {
    token: string | null;
    error: string | null;
} {
    const hash = window.location.hash.replace(/^#/, '');
    if (hash) {
        const hashParams = new URLSearchParams(hash);
        const token = hashParams.get('access_token');
        const error = hashParams.get('error');
        if (token || error)
            return { token, error };
    }
    const searchParams = new URLSearchParams(window.location.search);
    return {
        token: searchParams.get('access_token'),
        error: searchParams.get('error'),
    };
}
export function AuthCallbackPage() {
    const navigate = useNavigate();
    useEffect(() => {
        const { token, error } = parseCallbackParams();
        if (error) {
            navigate(`${routes.login}?error=${encodeURIComponent(error)}`, { replace: true });
            return;
        }
        if (useSessionCookieOnly()) {
            window.history.replaceState({}, document.title, window.location.pathname);
            void refreshCurrentUser().then((u) => {
                if (u) {
                    setSessionCookieHint(true);
                    navigate(routes.home, { replace: true });
                }
                else {
                    navigate(routes.login, { replace: true });
                }
            });
            return;
        }
        if (token) {
            setAccessToken(token);
            window.history.replaceState({}, document.title, window.location.pathname);
            void refreshCurrentUser().finally(() => {
                navigate(routes.home, { replace: true });
            });
        }
        else {
            navigate(routes.login, { replace: true });
        }
    }, [navigate]);
    return (<div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        minHeight: '100vh',
        fontFamily: 'inherit',
        color: 'var(--app-text, #0f172a)',
        background: 'var(--app-bg, #f8fafc)',
    }}>
      <span style={{ fontSize: '0.95rem', color: 'var(--app-muted, #64748b)' }}>Выполняется вход…</span>
    </div>);
}
