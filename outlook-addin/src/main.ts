import './styles.css';
import {
  checkinDocument,
  ensureDocumentsFolder,
  ensureEmailsFolder,
  listMatters,
  pingApi,
  uploadToMatter,
  type MatterOption,
} from './api';
import { ensureHubSession, fetchHubMe, loginWithHub, logoutHub } from './auth/authApi';
import { clearLegacyOutlookTokens, getProfile, isAuthenticated, readAzureAccessToken } from './auth/session';
import { listConversationMessages } from './conversation';
import { buildConversationEml } from './conversationBuild';
import { buildEml, readCurrentMail, type MailSnapshot } from './email';
import { hostLabel, readCurrentOfficeDocument } from './officeDoc';
import { itemHasSavedCategory, markItemSavedToKosta, SAVED_CATEGORY } from './outlookCategory';
import { describeMatch, matchRule } from './rules';
import {
  getConversationDoc,
  getSettings,
  loadRoamingSettings,
  markFiled,
  newRuleId,
  saveSettings,
  setConversationDoc,
  wasFiled,
  type FilingRule,
} from './settings';

type Tab = 'file' | 'rules' | 'settings';

const ASSET_BASE = import.meta.env.BASE_URL || '/';

const app = document.getElementById('app');
if (!app)
  throw new Error('#app missing');

let tab: Tab = 'file';
let officeHost: Office.HostType | null = null;
let mail: MailSnapshot | null = null;
let matters: MatterOption[] = [];
let statusText = '';
let statusKind: '' | 'ok' | 'error' = '';
let busy = false;
let outlookSavedCategory = false;
/** Matter override for full-thread save when no sender rule matches. */
let threadMatterId = '';
/** Matter for Word/Excel/PowerPoint upload. */
let documentMatterId = '';
let draft: { match: string; matterId: string; autoFile: boolean } = { match: '', matterId: '', autoFile: true };
/** True after user pins the task pane (New/Classic Outlook). */
let panePinned = false;

function isOutlookHost(): boolean {
  return officeHost === Office.HostType.Outlook;
}

function isDocumentHost(): boolean {
  return officeHost === Office.HostType.Word
    || officeHost === Office.HostType.Excel
    || officeHost === Office.HostType.PowerPoint;
}

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

let autoFileInFlight: string | null = null;

async function refreshMail(options: { autoFile?: boolean } = {}): Promise<void> {
  const wantAuto = options.autoFile !== false;
  mail = await readCurrentMail();
  await refreshOutlookCategoryFlag();
  if (!wantAuto)
    return;
  await tryAutoFileCurrent();
}

/** Auto-file current message when rule has autoFile. Requires open taskpane + Hub session. */
async function tryAutoFileCurrent(): Promise<boolean> {
  if (!mail || !isAuthenticated() || busy)
    return false;
  const settings = getSettings();
  const rule = matchRule(mail.fromEmail, settings.rules);
  if (!rule) {
    return false;
  }
  if (!rule.autoFile) {
    setStatus(`Правило «${rule.match}» без автозагрузки — нажмите «Загрузить в matter»`, '');
    return false;
  }
  if (wasFiled(mail.messageId)) {
    void ensureOutlookSavedMark();
    setStatus(`Уже в matter «${rule.matterName}» (это письмо уже загружали)`, 'ok');
    return false;
  }
  if (autoFileInFlight === mail.messageId)
    return false;
  autoFileInFlight = mail.messageId;
  try {
    await fileMail(rule, true);
    return true;
  } finally {
    autoFileInFlight = null;
  }
}

async function refreshMatters(): Promise<void> {
  matters = await listMatters();
}

async function ensureOutlookSavedMark(): Promise<void> {
  const result = await markItemSavedToKosta();
  outlookSavedCategory = result.ok || await itemHasSavedCategory();
  if (!result.ok && result.detail)
    setStatus(`Файл в FM ок, но категорию Outlook не удалось поставить: ${result.detail}`, 'error');
}

async function refreshOutlookCategoryFlag(): Promise<void> {
  outlookSavedCategory = await itemHasSavedCategory();
}

async function fileMail(rule: FilingRule, automatic: boolean): Promise<void> {
  if (!mail)
    mail = await readCurrentMail();
  if (wasFiled(mail.messageId) && automatic) {
    await ensureOutlookSavedMark();
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
    await ensureOutlookSavedMark();
    setStatus(
      `Сохранено в «${rule.matterName}» / Correspondence/Emails\n${file.name}`
      + (outlookSavedCategory ? `\nOutlook: категория «${SAVED_CATEGORY}»` : ''),
      'ok',
    );
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), 'error');
  } finally {
    busy = false;
    render();
  }
}

function resolveThreadTarget(): { matterId: string; matterName: string; clientName: string } | null {
  if (!mail)
    return null;
  const rule = matchRule(mail.fromEmail, getSettings().rules);
  if (rule)
    return { matterId: rule.matterId, matterName: rule.matterName, clientName: rule.clientName };
  const matter = matters.find((row) => row.id === threadMatterId);
  if (!matter)
    return null;
  return { matterId: matter.id, matterName: matter.name, clientName: matter.clientName };
}

/** Save or update the full Outlook conversation as one FM document (like one Outlook thread). */
async function fileConversation(mode: 'all' | 'new'): Promise<void> {
  const target = resolveThreadTarget();
  if (!target) {
    setStatus('Укажите matter для переписки (правило или выбор ниже)', 'error');
    return;
  }
  if (!readAzureAccessToken()) {
    setStatus('Для переписки нужен Mail.Read — выйдите и войдите снова', 'error');
    return;
  }
  busy = true;
  setStatus(mode === 'all' ? 'Читаем всю переписку…' : 'Проверяем переписку…');
  try {
    const { conversationId, messages } = await listConversationMessages();
    if (!messages.length) {
      setStatus('В переписке нет писем', 'error');
      return;
    }

    const { file, storageKey } = await buildConversationEml(
      conversationId,
      messages,
      (index, total) => setStatus(`Собираем тред ${index}/${total}…`),
    );
    const existing = getConversationDoc(storageKey);
    const sameMatter = existing?.matterId === target.matterId;
    const noNewMail = mode === 'new'
      && sameMatter
      && existing
      && existing.messageCount >= messages.length;

    if (noNewMail) {
      setStatus(
        `Переписка уже в FM (${messages.length} писем) → «${target.matterName}»\n${existing.fileName}`,
        'ok',
      );
      await ensureOutlookSavedMark();
      return;
    }

    const comment = `Outlook thread · ${messages.length} msg · ${target.clientName}`;
    let documentId = sameMatter ? existing?.documentId : undefined;
    let action = 'сохранена';

    if (documentId) {
      setStatus(`Обновляем файл переписки (${messages.length} писем)…`);
      try {
        await checkinDocument(documentId, file, comment);
        action = 'обновлена';
      } catch {
        documentId = undefined;
      }
    }

    if (!documentId) {
      setStatus(`Загружаем один файл переписки (${messages.length} писем)…`);
      const folderId = await ensureEmailsFolder(target.matterId);
      const uploaded = await uploadToMatter(target.matterId, folderId, file, comment);
      documentId = uploaded[0]?.id;
      if (!documentId)
        throw new Error('API не вернул id документа после загрузки');
      action = 'сохранена';
    }

    setConversationDoc(storageKey, {
      documentId,
      matterId: target.matterId,
      fileName: file.name,
      messageCount: messages.length,
      updatedAt: new Date().toISOString(),
    });
    for (const row of messages)
      markFiled(row.internetMessageId);
    await ensureOutlookSavedMark();
    setStatus(
      `Переписка ${action} → «${target.matterName}» / Correspondence/Emails\n`
      + `${file.name} · ${messages.length} писем в одном файле`
      + (outlookSavedCategory ? `\nOutlook: «${SAVED_CATEGORY}»` : ''),
      'ok',
    );
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

function matterSelectOptions(selectedId: string): string {
  return matters.map((matter) => {
    const label = `${matter.clientName} · ${matter.code ? `${matter.code} · ` : ''}${matter.name}`;
    const selected = selectedId === matter.id ? 'selected' : '';
    return `<option value="${escape(matter.id)}" ${selected}>${escape(label)}</option>`;
  }).join('');
}

async function fileOfficeDocument(): Promise<void> {
  const matter = matters.find((row) => row.id === documentMatterId);
  if (!matter) {
    setStatus('Выберите matter для документа', 'error');
    return;
  }
  busy = true;
  setStatus(`Читаем файл ${hostLabel(officeHost ?? undefined)}…`);
  try {
    const file = await readCurrentOfficeDocument(officeHost ?? undefined);
    setStatus(`Загрузка «${file.name}»…`);
    const folderId = await ensureDocumentsFolder(matter.id);
    await uploadToMatter(
      matter.id,
      folderId,
      file,
      `${hostLabel(officeHost ?? undefined)} · ${getProfile()?.email || ''}`,
    );
    setStatus(
      `Сохранено в «${matter.name}» / Correspondence/Documents\n${file.name}`,
      'ok',
    );
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), 'error');
  } finally {
    busy = false;
    render();
  }
}

function renderDocumentFile(): string {
  if (!isAuthenticated())
    return `<section class="card gate"><p class="hint">Войдите через Microsoft на вкладке «Настройки».</p></section>`;
  const matterOptions = matterSelectOptions(documentMatterId);
  return `
    <section class="card">
      <h2>Текущий документ · ${escape(hostLabel(officeHost ?? undefined))}</h2>
      <p class="hint">Сохраняет открытый файл в Correspondence/Documents выбранного matter.</p>
      <label class="field">Matter
        <select id="documentMatter"><option value="">Выберите matter…</option>${matterOptions}</select>
      </label>
      <div class="row" style="margin-top:10px">
        <button type="button" class="primary" id="fileDocument" ${!documentMatterId || busy ? 'disabled' : ''}>Сохранить в matter</button>
      </div>
    </section>
  `;
}

function renderPinBanner(): string {
  if (!isOutlookHost() || getSettings().pinTipDismissed || panePinned)
    return '';
  return `
    <section class="card pin-banner" role="status">
      <h2>Закрепите панель один раз</h2>
      <p class="hint">
        Как MacroView: нажмите <strong>📌</strong> в шапке этой панели (New Outlook → Apps / Classic → task pane).
        После этого панель <strong>не закроется</strong> при смене или закрытии письма.
      </p>
      <div class="row" style="margin-top:10px">
        <button type="button" class="primary" id="pinTipDone">Уже закрепил</button>
      </div>
    </section>
  `;
}

function renderMailFile(): string {
  const s = getSettings();
  const rule = mail ? matchRule(mail.fromEmail, s.rules) : null;
  const filed = mail ? wasFiled(mail.messageId) : false;
  const threadTarget = resolveThreadTarget();
  const matterOptions = matterSelectOptions(rule?.matterId || threadMatterId);
  let autoHint = 'Автозагрузка срабатывает при открытии письма, пока открыта эта панель.';
  if (!mail)
    autoHint = panePinned || s.pinTipDismissed
      ? 'Панель активна. Выберите письмо в списке — данные появятся здесь.'
      : 'Сначала закрепите панель (📌), затем выбирайте письма без повторного открытия add-in.';
  else if (mail && rule?.autoFile && !filed)
    autoHint = `Авто: при открытии/смене письма загрузим в «${rule.matterName}».`;
  else if (mail && rule?.autoFile && filed)
    autoHint = 'Это письмо уже загружали по автоправилу.';
  else if (mail && rule && !rule.autoFile)
    autoHint = 'Правило без автозагрузки — кнопка «Это письмо» или вся переписка.';
  else if (mail && !rule)
    autoHint = 'Нет правила для отправителя — выберите matter ниже для переписки.';
  const graphOk = Boolean(readAzureAccessToken());
  return `
    ${renderPinBanner()}
    <section class="card">
      <h2>Текущее письмо</h2>
      ${mail ? `
        <div class="mail">
          <strong>${escape(mail.subject)}</strong>
          <div>От: ${escape(mail.fromName)} &lt;${escape(mail.fromEmail)}&gt;</div>
          <div class="muted">${escape(mail.received)}</div>
          ${rule
            ? `<span class="chip">${escape(rule.match)} → ${escape(rule.matterName)}${rule.autoFile ? ' · авто' : ''}${filed ? ' · уже в FM' : ''}</span>`
            : `<div class="muted">Нет правила для отправителя</div>`}
          ${outlookSavedCategory
            ? `<span class="chip chip-saved">${escape(SAVED_CATEGORY)}</span>`
            : ''}
        </div>
      ` : `<p class="hint">Письмо не выбрано — панель остаётся открытой${panePinned ? ' (закреплена)' : ''}. Выберите сообщение в Outlook.</p>`}
      <p class="hint">${escape(autoHint)}</p>
      <div class="row" style="margin-top:10px">
        <button type="button" id="refreshMail">Обновить / авто</button>
        <button type="button" class="primary" id="fileNow" ${!rule || busy ? 'disabled' : ''}>Это письмо</button>
      </div>
    </section>
    <section class="card">
      <h2>Вся переписка</h2>
      <p class="hint">Один файл Conversation_*.eml со всей перепиской (как тред в Outlook). «Обновить» перезаписывает тот же документ новыми письмами.</p>
      ${!rule ? `
        <label class="field">Matter для переписки
          <select id="threadMatter"><option value="">Выберите matter…</option>${matterOptions}</select>
        </label>
      ` : `<p class="hint">Matter из правила: <strong>${escape(rule.matterName)}</strong></p>`}
      ${!graphOk ? `<p class="hint">Нужен повторный вход (согласие Mail.Read) для чтения треда.</p>` : ''}
      <div class="row">
        <button type="button" class="primary" id="fileThreadAll" ${!threadTarget || busy || !graphOk ? 'disabled' : ''}>Сохранить переписку</button>
        <button type="button" id="fileThreadNew" ${!threadTarget || busy || !graphOk ? 'disabled' : ''}>Обновить переписку</button>
      </div>
    </section>
  `;
}

function renderFile(): string {
  if (!isAuthenticated())
    return `<section class="card gate"><p class="hint">Войдите через Microsoft на вкладке «Настройки».</p></section>`;
  if (isDocumentHost())
    return renderDocumentFile();
  if (isOutlookHost())
    return renderMailFile();
  return `<section class="card gate"><p class="hint">Откройте надстройку в Outlook, Word, Excel или PowerPoint.</p></section>`;
}

function render(): void {
  const fileTabLabel = isDocumentHost() ? 'Документ' : 'Письмо';
  const sub = isOutlookHost()
    ? (panePinned || getSettings().pinTipDismissed
      ? 'Outlook · панель закреплена — остаётся при смене писем'
      : 'Outlook · нажмите 📌 в шапке панели один раз')
    : isDocumentHost()
      ? `${hostLabel(officeHost ?? undefined)} · сессия Hub`
      : 'Сессия Hub';
  app!.innerHTML = `
    <header class="brand">
      <img class="brand-logo" src="${ASSET_BASE}assets/logo.svg" width="28" height="40" alt="Kosta Legal" />
      <div class="brand-copy">
        <h1>Kosta File</h1>
        <p class="sub">${escape(sub)}</p>
      </div>
    </header>
    <nav class="tabs" aria-label="Разделы">
      <button type="button" data-tab="file" class="${tab === 'file' ? 'is-on' : ''}">${escape(fileTabLabel)}</button>
      ${isOutlookHost() ? `<button type="button" data-tab="rules" class="${tab === 'rules' ? 'is-on' : ''}">Правила</button>` : ''}
      <button type="button" data-tab="settings" class="${tab === 'settings' ? 'is-on' : ''}">Настройки</button>
    </nav>
    ${tab === 'file' ? renderFile() : ''}
    ${tab === 'rules' && isOutlookHost() ? renderRules() : ''}
    ${tab === 'settings' ? renderSettings() : ''}
    ${statusText ? `<div class="status ${statusKind ? `is-${statusKind}` : ''}">${escape(statusText)}</div>` : ''}
  `;
  bind();
}

function bind(): void {
  app!.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((button) => {
    button.onclick = () => {
      tab = button.dataset.tab as Tab;
      if (tab === 'rules' && !isOutlookHost())
        tab = 'file';
      render();
      if (tab === 'file' && isAuthenticated() && isOutlookHost()) {
        void refreshMail().then(() => render()).catch((error) => {
          setStatus(error instanceof Error ? error.message : String(error), 'error');
        });
      }
    };
  });

  const pinTipDone = app!.querySelector<HTMLButtonElement>('#pinTipDone');
  if (pinTipDone) {
    pinTipDone.onclick = () => {
      panePinned = true;
      saveSettings({ pinTipDismissed: true });
      setStatus('Готово. Панель должна оставаться при смене писем.', 'ok');
      render();
    };
  }

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
        if (isOutlookHost()) {
          try {
            await refreshMail({ autoFile: true });
          } catch {
            /* mail optional */
          }
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

  const threadMatter = app!.querySelector<HTMLSelectElement>('#threadMatter');
  if (threadMatter) {
    threadMatter.onchange = () => {
      threadMatterId = threadMatter.value;
      render();
    };
  }
  const fileThreadAll = app!.querySelector<HTMLButtonElement>('#fileThreadAll');
  if (fileThreadAll) {
    fileThreadAll.onclick = () => {
      void fileConversation('all');
    };
  }
  const fileThreadNew = app!.querySelector<HTMLButtonElement>('#fileThreadNew');
  if (fileThreadNew) {
    fileThreadNew.onclick = () => {
      void fileConversation('new');
    };
  }

  const documentMatter = app!.querySelector<HTMLSelectElement>('#documentMatter');
  if (documentMatter) {
    documentMatter.onchange = () => {
      documentMatterId = documentMatter.value;
      render();
    };
  }
  const fileDocument = app!.querySelector<HTMLButtonElement>('#fileDocument');
  if (fileDocument) {
    fileDocument.onclick = () => {
      void fileOfficeDocument();
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

function wirePinTracking(): void {
  const addin = (Office as unknown as {
    addin?: {
      getState?: () => Promise<{ visibilityMode?: string }>;
      onVisibilityModeChanged?: {
        add: (cb: (args: { visibilityMode?: string }) => void) => void;
      };
    };
    VisibilityMode?: { Taskpane?: string };
  }).addin;
  if (!addin)
    return;
  const markPinned = (mode?: string) => {
    if (!mode)
      return;
    // Once the pane is shown and stays through item changes, treat as pinned UX.
    if (mode.toLowerCase().includes('taskpane')) {
      panePinned = true;
      render();
    }
  };
  try {
    void addin.getState?.().then((state) => markPinned(state?.visibilityMode)).catch(() => undefined);
  } catch {
    /* optional API */
  }
  try {
    addin.onVisibilityModeChanged?.add((args) => {
      markPinned(args?.visibilityMode);
      if (getSettings().pinTipDismissed)
        return;
      // Surviving a hide→show cycle usually means the user pinned.
      if (args?.visibilityMode && String(args.visibilityMode).toLowerCase().includes('taskpane'))
        saveSettings({ pinTipDismissed: true });
    });
  } catch {
    /* optional API */
  }
}

function wireOffice(): void {
  Office.onReady(async (info) => {
    officeHost = info.host ?? null;
    const supported = isOutlookHost() || isDocumentHost();
    if (!supported) {
      setStatus('Откройте надстройку в Outlook, Word, Excel или PowerPoint', 'error');
      render();
      return;
    }
    await loadRoamingSettings();
    clearLegacyOutlookTokens();
    if (await ensureHubSession()) {
      try {
        await fetchHubMe();
        await refreshMatters();
        setStatus(`Сессия: ${getProfile()?.email || 'OK'} · ${hostLabel(officeHost ?? undefined)}`, 'ok');
      } catch {
        setStatus('');
      }
    } else {
      setStatus('Нажмите «Войти в Kosta Hub» и завершите вход в открывшемся окне', '');
    }
    render();
    if (!isOutlookHost())
      return;
    wirePinTracking();
    try {
      await refreshMail({ autoFile: true });
      render();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error), 'error');
    }
    try {
      Office.context.mailbox.addHandlerAsync(Office.EventType.ItemChanged, async () => {
        try {
          // Surviving ItemChanged without unload is the pinned-pane signal.
          panePinned = true;
          if (!getSettings().pinTipDismissed)
            saveSettings({ pinTipDismissed: true });
          if (!Office.context.mailbox.item) {
            mail = null;
            outlookSavedCategory = false;
            render();
            return;
          }
          await refreshMail({ autoFile: true });
          render();
        } catch (error) {
          setStatus(error instanceof Error ? error.message : String(error), 'error');
        }
      });
    } catch {
      /* Classic / older clients without ItemChanged */
    }
  });
}

render();
wireOffice();
