import './styles.css';
import { ensureEmailsFolder, listMatters, pingApi, uploadToMatter, type MatterOption } from './api';
import { ensureHubSession, fetchHubMe, loginWithHub, logoutHub } from './auth/authApi';
import { clearLegacyOutlookTokens, getProfile, isAuthenticated } from './auth/session';
import { buildEml, readCurrentMail, type MailSnapshot } from './email';
import { describeMatch, matchRule } from './rules';
import {
  getSettings,
  loadRoamingSettings,
  markFiled,
  newRuleId,
  saveSettings,
  wasFiled,
  type FilingRule,
} from './settings';

type Tab = 'file' | 'rules' | 'settings';

const ASSET_BASE = import.meta.env.BASE_URL || '/';

const app = document.getElementById('app');
if (!app)
  throw new Error('#app missing');

let tab: Tab = 'file';
let mail: MailSnapshot | null = null;
let matters: MatterOption[] = [];
let statusText = '';
let statusKind: '' | 'ok' | 'error' = '';
let busy = false;
let draft: { match: string; matterId: string; autoFile: boolean } = { match: '', matterId: '', autoFile: true };

function setStatus(text: string, kind: '' | 'ok' | 'error' = '') {
  statusText = text;
  statusKind = kind;
  render();
}

function escape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function refreshMail(): Promise<void> {
  mail = await readCurrentMail();
  if (!isAuthenticated())
    return;
  const settings = getSettings();
  const rule = matchRule(mail.fromEmail, settings.rules);
  if (rule && rule.autoFile && !wasFiled(mail.messageId))
    await fileMail(rule, true);
}

async function refreshMatters(): Promise<void> {
  matters = await listMatters();
}

async function fileMail(rule: FilingRule, automatic: boolean): Promise<void> {
  if (!mail)
    mail = await readCurrentMail();
  if (wasFiled(mail.messageId) && automatic) {
    setStatus(`Уже загружено ранее → ${rule.matterName}`, 'ok');
    return;
  }
  busy = true;
  setStatus(automatic ? 'Автозагрузка…' : 'Загрузка письма…');
  try {
    const folderId = await ensureEmailsFolder(rule.matterId);
    const file = buildEml(mail);
    await uploadToMatter(
      rule.matterId,
      folderId,
      file,
      `Outlook · ${mail.fromEmail} · ${describeMatch(rule)}`,
    );
    markFiled(mail.messageId);
    setStatus(`Сохранено в «${rule.matterName}» / Correspondence/Emails\n${file.name}`, 'ok');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), 'error');
  } finally {
    busy = false;
    render();
  }
}

function renderAuthGate(): string {
  const profile = getProfile();
  if (isAuthenticated() && profile) {
    return `
      <section class="card">
        <h2>Сессия Hub</h2>
        <div class="mail">
          <strong>${escape(profile.displayName)}</strong>
          <div class="muted">${escape(profile.email)}</div>
          <div class="muted">Та же авторизация, что и в Kosta Hub</div>
        </div>
        <div class="row" style="margin-top:8px">
          <button type="button" id="logoutBtn">Выйти</button>
        </div>
      </section>
    `;
  }
  return `
    <section class="card">
      <h2>Вход</h2>
      <p class="hint">1) Если появится белый диалог — нажмите <strong>Allow</strong>. 2) Войдите в Microsoft и дождитесь закрытия окна.</p>
      <button type="button" class="primary" id="loginBtn" ${busy ? 'disabled' : ''}>Войти в Kosta Hub</button>
    </section>
  `;
}

function renderSettings(): string {
  const s = getSettings();
  return `
    ${renderAuthGate()}
    <section class="card">
      <h2>Подключение</h2>
      <label class="field">File Manager API
        <input id="apiBase" value="${escape(s.apiBase)}" placeholder="https://ticketsback.kostalegal.com/api/v1/files" />
      </label>
      <p class="hint">Сессия Hub в этом WebView Outlook (токен после входа через Microsoft).</p>
      <div class="row">
        <button type="button" id="saveSettings">Сохранить URL</button>
        <button type="button" id="testApi" ${!isAuthenticated() ? 'disabled' : ''}>Проверить API</button>
      </div>
    </section>
  `;
}

function renderRules(): string {
  if (!isAuthenticated())
    return `<section class="card gate"><p class="hint">Сначала войдите на вкладке «Настройки».</p></section>`;
  const s = getSettings();
  const options = matters.map((matter) => {
    const label = `${matter.clientName} · ${matter.code ? `${matter.code} · ` : ''}${matter.name}`;
    return `<option value="${escape(matter.id)}" ${draft.matterId === matter.id ? 'selected' : ''}>${escape(label)}</option>`;
  }).join('');
  const list = s.rules.length === 0
    ? `<p class="hint">Правил пока нет.</p>`
    : `<div class="rules">${s.rules.map((rule) => `
        <article class="rule">
          <header>
            <span>${escape(rule.match)}</span>
            <button type="button" data-del="${escape(rule.id)}">Удалить</button>
          </header>
          <div class="meta">${escape(rule.clientName)} · ${escape(rule.matterName)}</div>
          <label class="check"><input type="checkbox" data-enabled="${escape(rule.id)}" ${rule.enabled ? 'checked' : ''}/> Включено</label>
          <label class="check"><input type="checkbox" data-auto="${escape(rule.id)}" ${rule.autoFile ? 'checked' : ''}/> Автозагрузка</label>
        </article>
      `).join('')}</div>`;
  return `
    <section class="card">
      <h2>Новое правило</h2>
      <label class="field">Отправитель или домен
        <input id="ruleMatch" value="${escape(draft.match)}" placeholder="user@acme.com или @acme.com" />
      </label>
      <label class="field">Matter
        <select id="ruleMatter"><option value="">Выберите matter…</option>${options}</select>
      </label>
      <label class="check"><input type="checkbox" id="ruleAuto" ${draft.autoFile ? 'checked' : ''}/> Автозагрузка</label>
      <div class="row">
        <button type="button" class="primary" id="addRule">Добавить</button>
        <button type="button" id="reloadMatters">Обновить matters</button>
      </div>
    </section>
    <section class="card"><h2>Правила (${s.rules.length})</h2>${list}</section>
  `;
}

function renderFile(): string {
  if (!isAuthenticated())
    return `<section class="card gate"><p class="hint">Войдите через Microsoft на вкладке «Настройки».</p></section>`;
  const s = getSettings();
  const rule = mail ? matchRule(mail.fromEmail, s.rules) : null;
  return `
    <section class="card">
      <h2>Текущее письмо</h2>
      ${mail ? `
        <div class="mail">
          <strong>${escape(mail.subject)}</strong>
          <div>От: ${escape(mail.fromName)} &lt;${escape(mail.fromEmail)}&gt;</div>
          <div class="muted">${escape(mail.received)}</div>
          ${rule
            ? `<span class="chip">${escape(rule.match)} → ${escape(rule.matterName)}</span>`
            : `<div class="muted">Нет правила для отправителя</div>`}
        </div>
      ` : `<p class="hint">Откройте письмо в Outlook.</p>`}
      <div class="row" style="margin-top:10px">
        <button type="button" id="refreshMail">Обновить</button>
        <button type="button" class="primary" id="fileNow" ${!rule || busy ? 'disabled' : ''}>Загрузить в matter</button>
      </div>
    </section>
  `;
}

function render(): void {
  app!.innerHTML = `
    <header class="brand">
      <img class="brand-logo" src="${ASSET_BASE}assets/logo.svg" width="28" height="40" alt="Kosta Legal" />
      <div class="brand-copy">
        <h1>Kosta File</h1>
        <p class="sub">Сессия Hub · New Outlook</p>
      </div>
    </header>
    <nav class="tabs" aria-label="Разделы">
      <button type="button" data-tab="file" class="${tab === 'file' ? 'is-on' : ''}">Письмо</button>
      <button type="button" data-tab="rules" class="${tab === 'rules' ? 'is-on' : ''}">Правила</button>
      <button type="button" data-tab="settings" class="${tab === 'settings' ? 'is-on' : ''}">Настройки</button>
    </nav>
    ${tab === 'file' ? renderFile() : ''}
    ${tab === 'rules' ? renderRules() : ''}
    ${tab === 'settings' ? renderSettings() : ''}
    ${statusText ? `<div class="status ${statusKind ? `is-${statusKind}` : ''}">${escape(statusText)}</div>` : ''}
  `;
  bind();
}

function bind(): void {
  app!.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((button) => {
    button.onclick = () => {
      tab = button.dataset.tab as Tab;
      render();
    };
  });

  const loginBtn = app!.querySelector<HTMLButtonElement>('#loginBtn');
  if (loginBtn) {
    loginBtn.onclick = async () => {
      const apiBase = app!.querySelector<HTMLInputElement>('#apiBase')?.value.trim();
      if (apiBase !== undefined)
        saveSettings({ apiBase: apiBase || getSettings().apiBase });
      busy = true;
      setStatus('Если белый диалог — нажмите Allow, затем войдите в Microsoft…');
      try {
        const profile = await loginWithHub();
        setStatus(`Вход выполнен: ${profile.email}`, 'ok');
        try {
          await refreshMatters();
        } catch {
          /* optional until API ready */
        }
      } catch (error) {
        setStatus(error instanceof Error ? error.message : String(error), 'error');
      } finally {
        busy = false;
        render();
      }
    };
  }

  const logoutBtn = app!.querySelector<HTMLButtonElement>('#logoutBtn');
  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      await logoutHub();
      matters = [];
      setStatus('Сессия Hub завершена', 'ok');
    };
  }

  const saveSettingsBtn = app!.querySelector<HTMLButtonElement>('#saveSettings');
  if (saveSettingsBtn) {
    saveSettingsBtn.onclick = () => {
      saveSettings({
        apiBase: app!.querySelector<HTMLInputElement>('#apiBase')?.value.trim() ?? '',
      });
      setStatus('URL сохранён', 'ok');
    };
  }

  const testApi = app!.querySelector<HTMLButtonElement>('#testApi');
  if (testApi) {
    testApi.onclick = async () => {
      saveSettings({
        apiBase: app!.querySelector<HTMLInputElement>('#apiBase')?.value.trim() ?? '',
      });
      try {
        setStatus(await pingApi(), 'ok');
      } catch (error) {
        setStatus(error instanceof Error ? error.message : String(error), 'error');
      }
    };
  }

  const reloadMatters = app!.querySelector<HTMLButtonElement>('#reloadMatters');
  if (reloadMatters) {
    reloadMatters.onclick = async () => {
      try {
        await refreshMatters();
        setStatus(`Matters: ${matters.length}`, 'ok');
      } catch (error) {
        setStatus(error instanceof Error ? error.message : String(error), 'error');
      }
    };
  }

  const addRule = app!.querySelector<HTMLButtonElement>('#addRule');
  if (addRule) {
    addRule.onclick = () => {
      const match = app!.querySelector<HTMLInputElement>('#ruleMatch')?.value.trim() ?? '';
      const matterId = app!.querySelector<HTMLSelectElement>('#ruleMatter')?.value ?? '';
      const autoFile = Boolean(app!.querySelector<HTMLInputElement>('#ruleAuto')?.checked);
      const matter = matters.find((row) => row.id === matterId);
      if (!match || !matter) {
        setStatus('Укажите match и matter', 'error');
        return;
      }
      saveSettings({
        rules: [...getSettings().rules, {
          id: newRuleId(),
          match,
          matterId: matter.id,
          matterName: matter.name,
          clientName: matter.clientName,
          autoFile,
          enabled: true,
        }],
      });
      draft = { match: '', matterId: '', autoFile: true };
      setStatus(`Правило: ${match} → ${matter.name}`, 'ok');
    };
  }

  app!.querySelectorAll<HTMLButtonElement>('[data-del]').forEach((button) => {
    button.onclick = () => {
      saveSettings({ rules: getSettings().rules.filter((rule) => rule.id !== button.dataset.del) });
      render();
    };
  });
  app!.querySelectorAll<HTMLInputElement>('[data-enabled]').forEach((input) => {
    input.onchange = () => {
      saveSettings({
        rules: getSettings().rules.map((rule) => (rule.id === input.dataset.enabled ? { ...rule, enabled: input.checked } : rule)),
      });
    };
  });
  app!.querySelectorAll<HTMLInputElement>('[data-auto]').forEach((input) => {
    input.onchange = () => {
      saveSettings({
        rules: getSettings().rules.map((rule) => (rule.id === input.dataset.auto ? { ...rule, autoFile: input.checked } : rule)),
      });
    };
  });

  const refresh = app!.querySelector<HTMLButtonElement>('#refreshMail');
  if (refresh) {
    refresh.onclick = async () => {
      try {
        await refreshMail();
        render();
      } catch (error) {
        setStatus(error instanceof Error ? error.message : String(error), 'error');
      }
    };
  }
  const fileNow = app!.querySelector<HTMLButtonElement>('#fileNow');
  if (fileNow) {
    fileNow.onclick = async () => {
      if (!mail)
        return;
      const rule = matchRule(mail.fromEmail, getSettings().rules);
      if (rule)
        await fileMail(rule, false);
    };
  }

  const ruleMatch = app!.querySelector<HTMLInputElement>('#ruleMatch');
  if (ruleMatch)
    ruleMatch.oninput = () => { draft.match = ruleMatch.value; };
  const ruleMatter = app!.querySelector<HTMLSelectElement>('#ruleMatter');
  if (ruleMatter)
    ruleMatter.onchange = () => { draft.matterId = ruleMatter.value; };
  const ruleAuto = app!.querySelector<HTMLInputElement>('#ruleAuto');
  if (ruleAuto)
    ruleAuto.onchange = () => { draft.autoFile = ruleAuto.checked; };
}

function wireOutlook(): void {
  Office.onReady(async (info) => {
    if (info.host !== Office.HostType.Outlook) {
      setStatus('Откройте надстройку внутри Outlook', 'error');
      return;
    }
    await loadRoamingSettings();
    clearLegacyOutlookTokens();
    if (await ensureHubSession()) {
      try {
        await fetchHubMe();
        await refreshMatters();
        setStatus(`Сессия: ${getProfile()?.email || 'OK'}`, 'ok');
      } catch {
        setStatus('');
      }
    } else {
      setStatus('Нажмите «Войти в Kosta Hub» и завершите вход в открывшемся окне', '');
    }
    render();
    try {
      await refreshMail();
      render();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error), 'error');
    }
    Office.context.mailbox.addHandlerAsync(Office.EventType.ItemChanged, async () => {
      try {
        await refreshMail();
        render();
      } catch (error) {
        setStatus(error instanceof Error ? error.message : String(error), 'error');
      }
    });
  });
}

render();
wireOutlook();
