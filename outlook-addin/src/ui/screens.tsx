import { useEffect, useRef } from 'react';
import { currentAuthMethod } from '../auth/authApi';
import { ssoProblem, ssoState } from '../auth/naa';
import type { MailboxDto } from '../api';
import type { AuthProfile } from '../auth/session';
import { describeMatch } from '../rules';
import type { FilingRule } from '../settings';
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
  const sso = ssoState();
  const single = sso.status === 'ok';
  const reason = sso.status === 'unsupported'
    ? 'эта версия Office не поддерживает единый вход — обновите Microsoft 365'
    : sso.status === 'consent'
      ? 'нужно один раз подтвердить вход: нажмите «Выйти» и войдите снова'
      : sso.status === 'failed'
        ? 'Office не выдал вход — сообщите администратору'
        : '';
  return (
    <div className={`kf-signinfo${single ? ' is-ok' : reason ? ' is-warn' : ''}`}>
      <span className="kf-signinfo__dot" aria-hidden="true" />
      <div>
        <strong>{single ? 'Единый вход работает' : reason ? 'Единый вход не работает' : 'Вход выполнен'}</strong>
        <span>Вход {METHOD_LABEL[method] ?? 'выполнен'}.{reason ? ` Причина: ${reason}.` : single ? ' Word, Excel, PowerPoint и Outlook входят сами.' : ''}</span>
        {sso.error && !single ? <code title={sso.error}>{sso.error}</code> : null}
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

function SsoProblem() {
  const problem = ssoProblem();
  if (!problem)
    return null;
  const { error } = ssoState();
  return (
    <div className="kf-signinfo is-warn">
      <span className="kf-signinfo__dot" aria-hidden="true" />
      <div>
        <strong>Единый вход не сработал</strong>
        <span>{problem}</span>
        {error ? <code title={error}>{error}</code> : null}
      </div>
    </div>
  );
}

export function SignInScreen({ busy, error, onSignIn }: { busy: boolean; error: string; onSignIn: () => void }) {
  return (
    <main className="kf-signin">
      <Brand />
      <h1>Войдите один раз</h1>
      <p>
        Kosta File сохраняет письма, вложения и документы Office в matters файлового менеджера.
        Вход выполняется той же учётной записью Microsoft, что и Outlook, и запоминается.
      </p>
      <button type="button" className="kf-btn kf-btn--primary kf-btn--wide" disabled={busy} onClick={onSignIn}>
        {busy ? 'Входим…' : 'Войти через Microsoft'}
      </button>
      {error ? <p className="kf-alert kf-alert--error" role="alert">{error}</p> : null}
      <SsoProblem />
      <p className="kf-signin__hint">Если Outlook покажет окно с кнопкой Allow, нажмите её — это разрешение открыть окно входа.</p>
    </main>
  );
}

export function SettingsSheet({
  profile, rules, mailbox, serverReady, hubRulesUrl, onClose, onLogout, onToggleRule, onDeleteRule, onAutofile, version, apiBase,
}: {
  profile: AuthProfile | null;
  rules: FilingRule[];
  mailbox: MailboxDto | null;
  serverReady: boolean;
  hubRulesUrl: string;
  onClose: () => void;
  onLogout: () => void;
  onToggleRule: (rule: FilingRule, enabled: boolean) => void;
  onDeleteRule: (rule: FilingRule) => void;
  onAutofile: (enabled: boolean) => void;
  version: string;
  apiBase: string;
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
        <div className={`kf-autofile${mailbox?.enabled ? ' is-on' : ''}${mailbox?.lastError ? ' is-error' : ''}`}>
          <label className="kf-check">
            <input type="checkbox" checked={Boolean(mailbox?.enabled)} onChange={(event) => onAutofile(event.target.checked)} />
            Сохранять мою почту по правилам автоматически
          </label>
          <p className="kf-text kf-text--small">
            {mailbox?.enabled
              ? `Сервер проверяет ${mailbox.email} каждые 5 минут, Outlook можно не открывать. Сохранено писем: ${mailbox.filedTotal}.`
              : 'Сервер не читает вашу почту. Правила срабатывают, только когда письмо открыто здесь.'}
          </p>
          {mailbox?.enabled && mailbox.lastError ? <p className="kf-alert kf-alert--error">{mailbox.lastError}</p> : null}
          {!serverReady ? <p className="kf-alert kf-alert--error">Сервер ещё не настроен для чтения почты — обратитесь к администратору.</p> : null}
        </div>
      </section>

      <section className="kf-section">
        <header className="kf-section__head">
          <h2>Правила ({rules.length})</h2>
          <a className="kf-link" href={hubRulesUrl} target="_blank" rel="noreferrer">Все правила в Hub</a>
        </header>
        {rules.length ? (
          <ul className="kf-rules">
            {rules.map((rule) => (
              <li key={rule.id} className={rule.enabled ? '' : 'is-off'}>
                <div className="kf-rules__head">
                  <span className="kf-rules__match">
                    {describeMatch(rule)}
                    {rule.scope === 'shared' ? <span className="kf-tag">общее</span> : null}
                  </span>
                  {rule.canEdit !== false ? (
                    <button type="button" className="kf-iconbtn" aria-label={`Удалить правило ${rule.match}`} onClick={() => onDeleteRule(rule)}>
                      <Icon name="trash" size={14} />
                    </button>
                  ) : null}
                </div>
                <span className="kf-rules__target">
                  {rule.clientName ? `${rule.clientName} › ` : ''}{rule.matterName}
                  {' › '}{rule.folderPath?.length ? rule.folderPath.map((c) => c.name).join(' / ') : 'Correspondence / Emails'}
                </span>
                {rule.canEdit !== false ? (
                  <label className="kf-check"><input type="checkbox" checked={rule.enabled} onChange={(event) => onToggleRule(rule, event.target.checked)} />Включено</label>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="kf-empty">Правил нет. Выберите папку и нажмите кнопку правила рядом с «Сохранить».</p>
        )}
      </section>

      <section className="kf-section">
        <header className="kf-section__head"><h2>Панель</h2></header>
        <p className="kf-text">
          Чтобы панель не закрывалась при переходе между письмами, нажмите <Icon name="pin" size={13} /> в её заголовке.
          Письма можно перетаскивать прямо на папку в дереве (новый Outlook и Outlook в браузере).
        </p>
        <p className="kf-text kf-text--dim">Версия {version} · {apiBase}</p>
      </section>
    </div>
  );
}
