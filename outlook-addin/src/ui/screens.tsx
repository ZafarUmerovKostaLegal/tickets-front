import { useEffect, useRef } from 'react';
import { currentAuthMethod } from '../auth/authApi';
import { ssoState } from '../auth/naa';
import type { MailboxDto } from '../api';
import type { AuthProfile } from '../auth/session';
import { Icon } from './icons';

const ASSET_BASE = import.meta.env.BASE_URL || '/';

const METHOD_LABEL: Record<string, string> = {
  sso: 'через учётную запись Office',
  cookie: 'по общей сессии Kosta Hub',
  token: 'по сохранённой сессии',
  dialog: 'через окно входа',
};

function SignInInfo() {
  const method = currentAuthMethod();
  const single = ssoState().status === 'ok';
  return (
    <div className={`kf-signinfo${single ? ' is-ok' : ''}`}>
      <span className="kf-signinfo__dot" aria-hidden="true" />
      <div>
        <strong>{single ? 'Единый вход работает' : 'Вход выполнен'}</strong>
        <span>Вход {METHOD_LABEL[method] ?? 'выполнен'}.{single ? ' Word, Excel, PowerPoint и Outlook входят сами.' : ''}</span>
      </div>
    </div>
  );
}

export function Brand({ sub }: { sub?: string }) {
  return (
    <div className="kf-brand">
      <img className="kf-brand__logo" src={`${ASSET_BASE}assets/logo.svg`} width="18" height="26" alt="" />
      <div className="kf-brand__copy">
        <span className="kf-brand__name">Kosta File</span>
        {sub ? <span className="kf-brand__sub">{sub}</span> : null}
      </div>
    </div>
  );
}

export function SignInScreen({ busy, error, details, onSignIn }: { busy: boolean; error: string; details: string; onSignIn: () => void }) {
  return (
    <main className="kf-signin">
      <Brand />
      <h1>Войдите один раз</h1>
      <p>
        Kosta File сохраняет письма, вложения и документы Office в matters файлового менеджера. Вход выполняется той же учётной записью Microsoft, что и Outlook, и запоминается.
      </p>
      <button type="button" className="kf-btn kf-btn--primary kf-btn--wide" disabled={busy} onClick={onSignIn}>
        {busy ? 'Входим…' : 'Войти через Microsoft'}
      </button>
      {error ? <p className="kf-alert kf-alert--error" role="alert">{error}</p> : null}
      {error && details ? (
        <details className="kf-signin__details">
          <summary>Подробности для администратора</summary>
          <pre>{details}</pre>
          <p>Отчёт об ошибке уже отправлен администратору.</p>
        </details>
      ) : null}
      <p className="kf-signin__hint">Откроется окно входа Microsoft. Если хост спросит Allow / Разрешить — нажмите, затем войдите своей учётной записью.</p>
    </main>
  );
}

export function SettingsSheet({
  profile, mailbox, serverReady, onClose, onLogout, onAutofile,
}: {
  profile: AuthProfile | null;
  mailbox: MailboxDto | null;
  serverReady: boolean;
  onClose: () => void;
  onLogout: () => void;
  onAutofile: (enabled: boolean) => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape')
        onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="kf-sheet" role="dialog" aria-modal="true" aria-label="Настройки">
      <header className="kf-sheet__head">
        <button ref={closeRef} type="button" className="kf-iconbtn" aria-label="Назад" onClick={onClose}><Icon name="back" /></button>
        <h1>Настройки</h1>
      </header>

      <section className="kf-section">
        <header className="kf-section__head"><h2>Учётная запись</h2></header>
        <div className="kf-account">
          <span className="kf-avatar" aria-hidden="true">{(profile?.displayName || '?').slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>{profile?.displayName}</strong>
            <span>{profile?.email}</span>
          </div>
          <button type="button" className="kf-btn" onClick={onLogout}><Icon name="logout" size={14} />Выйти</button>
        </div>
        <SignInInfo />
      </section>

      <section className="kf-section">
        <header className="kf-section__head"><h2>Автосохранение почты</h2></header>
        <div className={`kf-autofile${mailbox?.enabled ? ' is-on' : ''}`}>
          <label className="kf-check">
            <input type="checkbox" checked={Boolean(mailbox?.enabled)} onChange={(event) => onAutofile(event.target.checked)} />
            Сохранять мою почту по правилам автоматически
          </label>
          <p className="kf-text kf-text--small">
            {mailbox?.enabled
              ? `Сервер проверяет ${mailbox.email} каждые 5 минут, Outlook можно не открывать. Сохранено писем: ${mailbox.filedTotal}.`
              : 'Сервер не читает вашу почту. Правила срабатывают, только когда письмо открыто здесь.'}
          </p>
          {!serverReady ? <p className="kf-alert kf-alert--error">Сервер ещё не настроен для чтения почты — обратитесь к администратору.</p> : null}
        </div>
      </section>

    </div>
  );
}
