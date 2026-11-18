import { useEffect, useRef } from 'react';
import type { AuthProfile } from '../auth/session';
import { describeMatch } from '../rules';
import type { FilingRule } from '../settings';
import { Icon } from './icons';

const ASSET_BASE = import.meta.env.BASE_URL || '/';

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

export function SignInScreen({ busy, error, onSignIn }: { busy: boolean; error: string; onSignIn: () => void }) {
  return (
    <main className="kf-signin">
      <Brand />
      <h1>Войдите один раз</h1>
      <p>
        Kosta File сохраняет письма и вложения в matters файлового менеджера.
        Вход выполняется той же учётной записью Microsoft, что и Outlook, и запоминается.
      </p>
      <button type="button" className="kf-btn kf-btn--primary kf-btn--wide" disabled={busy} onClick={onSignIn}>
        {busy ? 'Входим…' : 'Войти через Microsoft'}
      </button>
      {error ? <p className="kf-alert kf-alert--error" role="alert">{error}</p> : null}
      <p className="kf-signin__hint">Если Outlook покажет окно с кнопкой Allow, нажмите её — это разрешение открыть окно входа.</p>
    </main>
  );
}

export function SettingsSheet({ profile, rules, onClose, onLogout, onRules, version, apiBase }: {
  profile: AuthProfile | null;
  rules: FilingRule[];
  onClose: () => void;
  onLogout: () => void;
  onRules: (rules: FilingRule[]) => void;
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

  const patch = (id: string, change: Partial<FilingRule>) => onRules(rules.map((rule) => (rule.id === id ? { ...rule, ...change } : rule)));

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
      </section>

      <section className="kf-section">
        <header className="kf-section__head"><h2>Правила ({rules.length})</h2></header>
        {rules.length ? (
          <ul className="kf-rules">
            {rules.map((rule) => (
              <li key={rule.id} className={rule.enabled ? '' : 'is-off'}>
                <div className="kf-rules__head">
                  <span className="kf-rules__match">{describeMatch(rule)}</span>
                  <button type="button" className="kf-iconbtn" aria-label={`Удалить правило ${rule.match}`} onClick={() => onRules(rules.filter((row) => row.id !== rule.id))}>
                    <Icon name="trash" size={14} />
                  </button>
                </div>
                <span className="kf-rules__target">
                  {rule.clientName ? `${rule.clientName} › ` : ''}{rule.matterName}
                  {' › '}{rule.folderPath?.length ? rule.folderPath.map((c) => c.name).join(' / ') : 'Correspondence / Emails'}
                </span>
                <div className="kf-row">
                  <label className="kf-check"><input type="checkbox" checked={rule.enabled} onChange={(event) => patch(rule.id, { enabled: event.target.checked })} />Включено</label>
                  <label className="kf-check"><input type="checkbox" checked={rule.autoFile} onChange={(event) => patch(rule.id, { autoFile: event.target.checked })} />Автосохранение</label>
                </div>
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
