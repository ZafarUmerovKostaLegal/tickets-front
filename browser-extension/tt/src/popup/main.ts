import { MSG } from '../shared/constants';
import { elapsedSeconds, formatClock } from '../shared/format';
import type { ExtensionState } from '../shared/types';
import './popup.css';

const app = document.getElementById('app')!;

function render(state: ExtensionState | null | undefined): void {
    if (!state) {
        app.innerHTML = `
          <div class="tt-ext">
            <h1 class="tt-ext__title">Kosta Legal TT</h1>
            <p class="tt-ext__muted">Не удалось связаться с фоновым скриптом. Обновите расширение на chrome://extensions.</p>
          </div>`;
        return;
    }
    const { auth, timer, todayHours, error, busy } = state;
    if (!auth) {
        app.innerHTML = `
          <div class="tt-ext">
            <h1 class="tt-ext__title">Kosta Legal TT</h1>
            <p class="tt-ext__muted">Откройте вкладку Kosta Legal и войдите в аккаунт — сессия подхватится автоматически (cookie или токен).</p>
            <ol class="tt-ext__steps">
              <li>Откройте приложение и убедитесь, что вы вошли</li>
              <li>Оставьте вкладку открытой</li>
              <li>Снова откройте это окно</li>
            </ol>
            <a class="tt-ext__link" href="https://tickets.kostalegal.com" target="_blank" rel="noopener">Открыть приложение</a>
          </div>`;
        return;
    }
    const clock = timer ? formatClock(elapsedSeconds(timer)) : '—';
    const project = timer?.snapshot.project?.trim() || '—';
    const task = timer?.snapshot.task?.trim() || '';
    const paused = Boolean(timer?.paused);
    const today = todayHours != null ? `${formatTodayHours(todayHours)} ч` : '—';

    app.innerHTML = `
      <div class="tt-ext">
        <header class="tt-ext__head">
          <div>
            <p class="tt-ext__user">${escapeHtml(auth.user.display_name || auth.user.email)}</p>
            <p class="tt-ext__today">Сегодня: ${today}</p>
          </div>
          <span class="tt-ext__status ${timer ? (paused ? 'tt-ext__status--pause' : 'tt-ext__status--run') : ''}">
            ${timer ? (paused ? 'Пауза' : 'Идёт') : 'Стоп'}
          </span>
        </header>
        <div class="tt-ext__clock" aria-live="polite">${clock}</div>
        <div class="tt-ext__meta">
          <strong>${escapeHtml(project)}</strong>
          ${task ? `<span>${escapeHtml(task)}</span>` : ''}
        </div>
        ${error ? `<p class="tt-ext__err" role="alert">${escapeHtml(error)}</p>` : ''}
        <div class="tt-ext__actions">
          ${timer
            ? `<button type="button" class="tt-ext__btn tt-ext__btn--ghost" data-action="pause" ${busy ? 'disabled' : ''}>
                ${paused ? 'Продолжить' : 'Пауза'}
               </button>
               <button type="button" class="tt-ext__btn tt-ext__btn--danger" data-action="stop" ${busy ? 'disabled' : ''}>Стоп</button>`
            : `<button type="button" class="tt-ext__btn tt-ext__btn--primary" data-action="start" ${busy ? 'disabled' : ''}>
                Продолжить последнюю
               </button>`}
        </div>
        <footer class="tt-ext__foot">
          <a href="${safeTimeTrackingHref(auth.apiBase)}" target="_blank" rel="noopener">Открыть расписание</a>
        </footer>
      </div>`;

    app.querySelector('[data-action="start"]')?.addEventListener('click', () => void send(MSG.TIMER_START_RECENT));
    app.querySelector('[data-action="pause"]')?.addEventListener('click', () => void send(MSG.TIMER_TOGGLE_PAUSE));
    app.querySelector('[data-action="stop"]')?.addEventListener('click', () => void send(MSG.TIMER_STOP));
}

function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Only allow http(s) origins; never inject raw apiBase into href. */
function safeTimeTrackingHref(apiBase: string): string {
    try {
        const u = new URL(apiBase);
        if (u.protocol !== 'https:' && u.protocol !== 'http:')
            return 'https://tickets.kostalegal.com/time-tracking';
        return `${u.origin}/time-tracking`;
    }
    catch {
        return 'https://tickets.kostalegal.com/time-tracking';
    }
}

function formatTodayHours(h: number): string {
    const fixed = h.toFixed(2);
    return fixed.endsWith('.00') ? String(Math.round(h)) : fixed;
}

async function send(type: string): Promise<void> {
    await chrome.runtime.sendMessage({ type });
    await refresh();
}

async function refresh(): Promise<void> {
    try {
        const state = await chrome.runtime.sendMessage({ type: MSG.GET_STATE }) as ExtensionState;
        render(state);
    }
    catch {
        render(null);
    }
}

chrome.runtime.onMessage.addListener((message) => {
    if (message.type === MSG.STATE_CHANGED)
        render(message.state as ExtensionState);
});

void refresh();
setInterval(() => { void refresh(); }, 1000);
