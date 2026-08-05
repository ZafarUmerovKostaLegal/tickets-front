(function () {
  'use strict';

  var WEEK_CAPACITY = 40;
  var DAY_CAPACITY = 8;

  var MOCK_PROJECTS = [
    {
      id: 'p1',
      client: 'Acme Holdings',
      name: 'Share Sale 2026',
      color: '#4f46e5',
      currency: 'USD',
      language: 'English',
      tasks: [
        { id: 't1', name: 'Drafting', billable: true },
        { id: 't2', name: 'Document Review', billable: true },
        { id: 't3', name: 'Emails', billable: true },
      ],
    },
    {
      id: 'p2',
      client: 'Kosta Legal',
      name: 'Kosta Legal Internal',
      color: '#94a3b8',
      currency: 'USD',
      language: 'Русский',
      tasks: [{ id: 't4', name: 'Internal meetings', billable: false }],
    },
  ];

  var STEPS = [
    {
      id: 'open-tab',
      title: 'Шаг 1. Откройте табель',
      text: 'Перейдите в «Учёт времени» → «Расписание (Время)». Ниже — тот же экран, что в тикет-системе.',
      hint: 'Изучите вкладки и нажмите «Далее».',
      target: '[data-train="tabbar"]',
      action: 'next',
    },
    {
      id: 'pick-day',
      title: 'Шаг 2. Выберите день',
      text: 'Нажмите на сегодняшний день в полоске недели. Активный день подсвечивается.',
      hint: 'Кликните по дню «Сегодня» в полоске недели.',
      target: '[data-train="today-day"]',
      action: 'pick-day',
    },
    {
      id: 'add-time',
      title: 'Шаг 3. Добавьте время',
      text: 'Нажмите «Добавить время» — как в рабочем табеле.',
      hint: 'Нажмите фиолетовую кнопку «Добавить время».',
      target: '[data-train="add-time"]',
      action: 'add-time',
    },
    {
      id: 'fill-modal',
      title: 'Шаг 4. Заполните запись',
      text: 'Выберите проект и задачу, напишите примечание (мин. 5 символов) и укажите часы, например 1:30.',
      hint: 'Заполните форму и нажмите «Добавить».',
      target: '[data-train="entry-modal"]',
      action: 'save-entry',
    },
    {
      id: 'read-row',
      title: 'Шаг 5. Проверьте запись',
      text: 'Цветная полоска — проект, ниже задача и примечание. Справа — часы и кнопки действий.',
      hint: 'Нажмите «Далее», когда понятна структура строки.',
      target: '[data-train="entry-row"]',
      action: 'next',
    },
    {
      id: 'timer',
      title: 'Шаг 6. Таймер',
      text: '«Старт» запускает учёт времени, «Стоп» сохраняет результат. Одновременно активен один таймер.',
      hint: 'Нажмите «Старт», подождите 2–3 секунды и нажмите «Стоп».',
      target: '[data-train="timer-btn"]',
      action: 'timer',
    },
    {
      id: 'submit',
      title: 'Шаг 7. Сдайте неделю',
      text: 'В конце недели — «Отправить на утверждение» (срок: понедельник, 12:00, Ташкент).',
      hint: 'Нажмите «Отправить на утверждение» внизу табеля.',
      target: '[data-train="submit-week"]',
      action: 'submit',
    },
  ];

  var state = {
    stepIndex: 0,
    selectedDayIndex: null,
    entries: [],
    timerRunning: false,
    timerStartedAt: null,
    timerEntryId: null,
    timerTick: null,
    weekSubmitted: false,
  };

  var initialized = false;
  var els = {};

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function findIn(arr, fn) {
    for (var i = 0; i < arr.length; i++) {
      if (fn(arr[i])) return arr[i];
    }
    return null;
  }

  function formatHours(decimal) {
    var h = Math.floor(decimal);
    var m = Math.round((decimal - h) * 60);
    if (m === 60) { h += 1; m = 0; }
    return h + ':' + String(m).padStart(2, '0');
  }

  function parseHoursInput(raw) {
    var s = String(raw || '').trim();
    if (!s) return NaN;
    if (s.indexOf(':') >= 0) {
      var p = s.split(':');
      var hh = parseInt(p[0], 10);
      var mm = parseInt(p[1] || '0', 10);
      if (!isFinite(hh) || !isFinite(mm)) return NaN;
      return hh + mm / 60;
    }
    if (/^\d+$/.test(s)) {
      if (s.length <= 2) return parseInt(s, 10);
      if (s.length === 3) return parseInt(s.slice(0, 1), 10) + parseInt(s.slice(1), 10) / 60;
      return parseInt(s.slice(0, -2), 10) + parseInt(s.slice(-2), 10) / 60;
    }
    return NaN;
  }

  function localIso(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function getWeekDays() {
    var today = new Date();
    var todayIso = localIso(today);
    var dow = today.getDay();
    var mondayOffset = dow === 0 ? -6 : 1 - dow;
    var monday = new Date(today);
    monday.setHours(12, 0, 0, 0);
    monday.setDate(today.getDate() + mondayOffset);
    var labels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
    var days = [];
    for (var i = 0; i < 7; i++) {
      var d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push({
        index: i,
        label: labels[i],
        num: d.getDate(),
        iso: localIso(d),
        isToday: localIso(d) === todayIso,
        isWeekend: i >= 5,
      });
    }
    return days;
  }

  function dayTotalHours(dayIndex) {
    var sum = 0;
    for (var i = 0; i < state.entries.length; i++) {
      if (state.entries[i].dayIndex === dayIndex) sum += state.entries[i].hours;
    }
    return sum;
  }

  function weekTotalHours() {
    var sum = 0;
    for (var i = 0; i < state.entries.length; i++) sum += state.entries[i].hours;
    return sum;
  }

  function findProject(id) {
    return findIn(MOCK_PROJECTS, function (p) { return p.id === id; });
  }

  function findTask(project, taskId) {
    if (!project) return null;
    return findIn(project.tasks, function (t) { return t.id === taskId; });
  }

  function currentStep() {
    return STEPS[state.stepIndex];
  }

  function toast(msg) {
    if (!els.toast) return;
    els.toast.textContent = msg;
    els.toast.classList.add('is-visible');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () {
      els.toast.classList.remove('is-visible');
    }, 2400);
  }

  function clearSpotlight() {
    var nodes = document.querySelectorAll('.train-spotlight');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].classList.remove('train-spotlight');
    }
  }

  function applySpotlight(selector) {
    clearSpotlight();
    if (!selector) return;
    var node = els.sandbox ? els.sandbox.querySelector(selector) : null;
    if (!node && selector.indexOf('entry-modal') >= 0) {
      node = document.getElementById('train-entry-modal');
    }
    if (!node) return;
    node.classList.add('train-spotlight');
    try { node.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {}
  }

  function ensureEntryModalOpen() {
    if (!els.modalOverlay || state.weekSubmitted) return;
    if (els.modalOverlay.classList.contains('is-open')) return;
    if (state.selectedDayIndex == null) {
      var days = getWeekDays();
      var today = findIn(days, function (d) { return d.isToday; });
      state.selectedDayIndex = today ? today.index : 0;
      renderHeading();
      renderWeekStrip();
    }
    populateModalSelects();
    els.modalNotes.value = '';
    els.modalHours.value = '1:30';
    els.modalErr.textContent = '';
    els.modalOverlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function advanceStep() {
    if (state.stepIndex < STEPS.length - 1) {
      state.stepIndex += 1;
      renderCoach();
    } else {
      renderCoach();
    }
  }

  function renderCoach() {
    var step = currentStep();
    if (!step || !els.coachTitle) return;

    els.coachTitle.textContent = step.title;
    els.coachText.textContent = step.text;
    els.coachHint.textContent = step.hint || '';
    els.coachHint.style.display = step.hint ? 'block' : 'none';
    els.coachBadge.textContent = 'Шаг ' + (state.stepIndex + 1) + ' из ' + STEPS.length;

    els.progress.innerHTML = '';
    for (var i = 0; i < STEPS.length; i++) {
      var dot = document.createElement('span');
      dot.className = 'train-coach__dot';
      if (i < state.stepIndex) dot.className += ' train-coach__dot--done';
      if (i === state.stepIndex) dot.className += ' train-coach__dot--active';
      els.progress.appendChild(dot);
    }

    els.btnBack.disabled = state.stepIndex === 0;
    els.btnNext.style.display = step.action === 'next' ? 'inline-block' : 'none';

    if (state.weekSubmitted && state.stepIndex === STEPS.length - 1) {
      els.coachDone.style.display = 'block';
      els.coachDone.textContent = 'Тренинг завершён. Можно вернуться к правилам или открыть рабочий табель.';
      els.btnNext.style.display = 'none';
      els.btnRestart.style.display = 'inline-block';
    } else {
      els.coachDone.style.display = 'none';
      els.btnRestart.style.display = state.stepIndex > 0 ? 'inline-block' : 'none';
    }

    if (step.action === 'save-entry') ensureEntryModalOpen();
    applySpotlight(step.target);
  }

  function renderWeekStrip() {
    if (!els.weekStrip) return;
    var days = getWeekDays();
    els.weekStrip.innerHTML = '';

    for (var d = 0; d < days.length; d++) {
      (function (day) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'tsp__day';
        btn.setAttribute('data-day-index', String(day.index));
        if (day.isToday) btn.className += ' tsp__day--today';
        if (day.isWeekend) btn.className += ' tsp__day--wknd';
        if (state.selectedDayIndex === day.index) btn.className += ' tsp__day--active';
        if (day.isToday) btn.setAttribute('data-train', 'today-day');

        var total = dayTotalHours(day.index);
        var pct = Math.min(100, (total / DAY_CAPACITY) * 100);
        var barClass = total >= DAY_CAPACITY ? 'tsp__day-bar tsp__day-bar--full' : 'tsp__day-bar tsp__day-bar--on';

        btn.innerHTML =
          '<span class="tsp__day-wk">' + day.label + '</span>' +
          '<span class="tsp__day-n">' + day.num + '</span>' +
          '<span class="tsp__day-bar-wrap"><span class="' + barClass + '" style="width:' + pct + '%"></span></span>' +
          '<span class="tsp__day-h' + (total > 0 ? ' tsp__day-h--on' : ' tsp__day-h-zero') + '">' +
          (total > 0 ? formatHours(total) : '—') + '</span>';

        els.weekStrip.appendChild(btn);
      })(days[d]);
    }

    var wtotal = document.createElement('div');
    wtotal.className = 'tsp__wtotal';
    wtotal.innerHTML =
      '<span class="tsp__wtotal-lbl">Итого<br>за неделю</span>' +
      '<span class="tsp__wtotal-n">' + formatHours(weekTotalHours()) + '</span>' +
      '<span class="tsp__wtotal-cap">из ' + WEEK_CAPACITY + '</span>';
    els.weekStrip.appendChild(wtotal);
  }

  function renderEntries() {
    if (!els.content) return;
    var dayIdx = state.selectedDayIndex;
    var days = getWeekDays();
    var dayMeta = dayIdx != null ? days[dayIdx] : null;

    if (dayIdx == null) {
      els.content.innerHTML =
        '<div class="tsp__empty">' +
        '<div class="tsp__empty-ico-wrap"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></div>' +
        '<p class="tsp__empty-h">Выберите день</p>' +
        '<p class="tsp__empty-s">Нажмите на день в полоске недели.</p></div>';
      return;
    }

    var dayEntries = [];
    for (var i = 0; i < state.entries.length; i++) {
      if (state.entries[i].dayIndex === dayIdx) dayEntries.push(state.entries[i]);
    }

    if (dayEntries.length === 0) {
      els.content.innerHTML =
        '<div class="tsp__empty">' +
        '<div class="tsp__empty-ico-wrap"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></div>' +
        '<p class="tsp__empty-h">Нет записей за этот день</p>' +
        '<p class="tsp__empty-s">Добавьте первую запись, чтобы начать отслеживать время</p>' +
        '<button type="button" class="tsp__empty-cta" data-train="add-time">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>' +
        'Добавить время</button></div>';
      return;
    }

    var html = '<div class="tsp__groups">';
    html += '<div class="tsp__ghd' + (dayMeta && dayMeta.isToday ? ' tsp__ghd--today' : '') + '">';
    html += '<div class="tsp__ghd-name">';
    if (dayMeta && dayMeta.isToday) html += '<span class="tsp__ghd-badge">Сегодня</span>';
    html += 'среда, ' + (dayMeta ? dayMeta.num : '') + '</div>';
    html += '<div class="tsp__ghd-total">' + formatHours(dayTotalHours(dayIdx)) + '</div></div>';

    for (var j = 0; j < dayEntries.length; j++) {
      var entry = dayEntries[j];
      var proj = findProject(entry.projectId);
      var task = findTask(proj, entry.taskId);
      var running = state.timerRunning && state.timerEntryId === entry.id;
      html += '<div class="tsp__row' + (running ? ' tsp__row--run' : '') + '"' + (j === 0 ? ' data-train="entry-row"' : '') + '>';
      html += '<div class="tsp__row-bar" style="background:' + (proj ? proj.color : '#4f46e5') + '"></div>';
      html += '<div class="tsp__row-txt">';
      html += '<p class="tsp__row-proj"><strong>' + (proj ? proj.name : '') + '</strong> <span class="tsp__row-client">' + (proj ? proj.client : '') + '</span>';
      if (task && !task.billable) html += ' <span class="tsp__row-nb">Non-billable</span>';
      html += '</p><p class="tsp__row-task">' + (task ? task.name : '') + '</p>';
      html += '<p class="tsp__row-notes">' + entry.notes + '</p></div>';
      html += '<div class="tsp__row-acts"><span class="tsp__row-h">' + formatHours(entry.hours) + '</span>';
      if (j === 0) {
        html += '<button type="button" class="tsp__row-start' + (running ? ' tsp__row-start--stop' : '') + '" data-train="timer-btn" data-entry-id="' + entry.id + '">';
        html += running ? 'Стоп' : 'Старт';
        html += '</button>';
      }
      html += '<button type="button" class="tsp__row-edit">Изменить</button></div></div>';
    }

    html += '<div class="tsp__day-sum"><span class="tsp__day-sum-r">Итого: <span class="tsp__day-sum-n">' +
      formatHours(dayTotalHours(dayIdx)) + '</span></span>';
    html += '<button type="button" class="tsp__day-sum-add" data-train="add-time">';
    html += '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>';
    html += 'Добавить время</button></div></div>';

    els.content.innerHTML = html;
  }

  function renderFoot() {
    if (els.footTotalN) els.footTotalN.textContent = formatHours(weekTotalHours());
    if (!els.submitBtn) return;
    if (state.weekSubmitted) {
      els.submitBtn.textContent = 'Неделя отправлена';
      els.submitBtn.disabled = true;
    } else {
      els.submitBtn.textContent = 'Отправить на утверждение';
      els.submitBtn.disabled = false;
    }
  }

  function renderHeading() {
    if (!els.heading) return;
    var days = getWeekDays();
    var sel = state.selectedDayIndex != null ? days[state.selectedDayIndex] : findIn(days, function (d) { return d.isToday; });
    if (sel) els.heading.textContent = 'Эта неделя · ' + sel.label.toLowerCase() + ', ' + sel.num;
  }

  function renderAll() {
    renderHeading();
    renderWeekStrip();
    renderEntries();
    renderFoot();
    renderCoach();
  }

  function populateModalSelects() {
    var html = '';
    for (var i = 0; i < MOCK_PROJECTS.length; i++) {
      var p = MOCK_PROJECTS[i];
      html += '<option value="' + p.id + '">' + p.client + ' — ' + p.name + '</option>';
    }
    els.modalProject.innerHTML = html;
    updateTaskOptions();
  }

  function updateTaskOptions() {
    var proj = findProject(els.modalProject.value);
    if (!proj) return;
    var html = '';
    for (var i = 0; i < proj.tasks.length; i++) {
      var t = proj.tasks[i];
      html += '<option value="' + t.id + '">' + t.name + '</option>';
    }
    els.modalTask.innerHTML = html;
    els.modalMeta.textContent = 'Валюта проекта: ' + proj.currency + ' · Язык записей: ' + proj.language;
    if (els.modal) els.modal.style.setProperty('--tsp-m-stripe', proj.color);
  }

  function openModal() {
    if (state.weekSubmitted) return;
    if (state.selectedDayIndex == null) {
      var days = getWeekDays();
      var today = findIn(days, function (d) { return d.isToday; });
      state.selectedDayIndex = today ? today.index : 0;
      renderHeading();
      renderWeekStrip();
    }
    populateModalSelects();
    els.modalNotes.value = '';
    els.modalHours.value = '1:30';
    els.modalErr.textContent = '';
    els.modalOverlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    renderCoach();
    if (currentStep().id === 'add-time') advanceStep();
  }

  function closeModal() {
    els.modalOverlay.classList.remove('is-open');
    document.body.style.overflow = '';
    renderCoach();
  }

  function saveEntry() {
    var notes = els.modalNotes.value.trim();
    var hours = parseHoursInput(els.modalHours.value);
    if (notes.length < 5) {
      els.modalErr.textContent = 'Заполните примечание — минимум 5 символов.';
      return;
    }
    if (!isFinite(hours) || hours <= 0) {
      els.modalErr.textContent = 'Укажите корректное время.';
      return;
    }
    if (hours > 8) {
      els.modalErr.textContent = 'Максимум 8 часов за одну запись';
      return;
    }
    state.entries.push({
      id: 'e' + Date.now(),
      dayIndex: state.selectedDayIndex,
      projectId: els.modalProject.value,
      taskId: els.modalTask.value,
      notes: notes,
      hours: hours,
    });
    closeModal();
    toast('Запись добавлена');
    renderAll();
    if (currentStep().action === 'save-entry') advanceStep();
  }

  function startTimer(entryId) {
    state.timerRunning = true;
    state.timerEntryId = entryId;
    state.timerStartedAt = Date.now();
    var entry = findIn(state.entries, function (e) { return e.id === entryId; });
    if (entry && entry.baseHours == null) entry.baseHours = entry.hours;
    state.timerTick = setInterval(function () {
      var e = findIn(state.entries, function (x) { return x.id === entryId; });
      if (!e) return;
      e.hours = (e.baseHours || 0) + (Date.now() - state.timerStartedAt) / 3600000;
      renderWeekStrip();
      renderEntries();
      renderFoot();
    }, 400);
    renderEntries();
    toast('Таймер запущен');
  }

  function stopTimer() {
    clearInterval(state.timerTick);
    state.timerRunning = false;
    state.timerStartedAt = null;
    state.timerEntryId = null;
    toast('Время сохранено');
    renderAll();
    if (currentStep().action === 'timer') advanceStep();
  }

  function resetTraining() {
    clearInterval(state.timerTick);
    state.stepIndex = 0;
    state.selectedDayIndex = null;
    state.entries = [];
    state.timerRunning = false;
    state.weekSubmitted = false;
    closeModal();
    renderAll();
    toast('Тренинг начат заново');
  }

  function onSandboxClick(e) {
    var target = e.target;
    if (!target || !els.sandbox) return;

    var addBtn = target.closest('[data-train="add-time"]');
    if (addBtn) {
      e.preventDefault();
      openModal();
      return;
    }

    var dayBtn = target.closest('.tsp__day[data-day-index]');
    if (dayBtn) {
      state.selectedDayIndex = parseInt(dayBtn.getAttribute('data-day-index'), 10);
      renderAll();
      if (currentStep().action === 'pick-day' && dayBtn.getAttribute('data-train') === 'today-day') {
        advanceStep();
      }
      return;
    }

    var timerBtn = target.closest('[data-train="timer-btn"]');
    if (timerBtn) {
      var entryId = timerBtn.getAttribute('data-entry-id');
      if (state.timerRunning && state.timerEntryId === entryId) stopTimer();
      else if (!state.timerRunning) startTimer(entryId);
      return;
    }

    var submitBtn = target.closest('#train-submit');
    if (submitBtn) {
      if (state.weekSubmitted) return;
      if (state.entries.length === 0) {
        toast('Добавьте хотя бы одну запись');
        return;
      }
      state.weekSubmitted = true;
      renderFoot();
      toast('Неделя отправлена на утверждение');
      if (currentStep().action === 'submit') advanceStep();
    }
  }

  function cacheElements() {
    els.fullscreen = document.getElementById('training-fullscreen');
    els.sandbox = document.getElementById('train-sandbox');
    els.coachTitle = document.getElementById('train-coach-title');
    els.coachText = document.getElementById('train-coach-text');
    els.coachHint = document.getElementById('train-coach-hint');
    els.coachBadge = document.getElementById('train-coach-badge');
    els.coachDone = document.getElementById('train-coach-done');
    els.progress = document.getElementById('train-progress');
    els.btnBack = document.getElementById('train-back');
    els.btnNext = document.getElementById('train-next');
    els.btnRestart = document.getElementById('train-restart');
    els.toast = document.getElementById('train-toast');
    els.weekStrip = document.getElementById('train-week-strip');
    els.content = document.getElementById('train-content');
    els.footTotalN = document.getElementById('train-foot-total-n');
    els.submitBtn = document.getElementById('train-submit');
    els.heading = document.getElementById('train-heading');
    els.modalOverlay = document.getElementById('train-modal-overlay');
    els.modal = document.getElementById('train-entry-modal');
    els.modalProject = document.getElementById('train-modal-project');
    els.modalMeta = document.getElementById('train-modal-meta');
    els.modalTask = document.getElementById('train-modal-task');
    els.modalNotes = document.getElementById('train-modal-notes');
    els.modalHours = document.getElementById('train-modal-hours');
    els.modalErr = document.getElementById('train-modal-err');
    els.modalDate = document.getElementById('train-modal-date');
    els.exitBtn = document.getElementById('training-exit');
  }

  function initTraining() {
    cacheElements();
    if (!els.sandbox || initialized) return;
    initialized = true;

    var days = getWeekDays();
    var today = findIn(days, function (d) { return d.isToday; });
    if (els.modalDate && today) {
      els.modalDate.textContent = today.iso.split('-').reverse().join('.');
    }

    els.sandbox.addEventListener('click', onSandboxClick);

    els.modalProject.addEventListener('change', updateTaskOptions);
    els.modalOverlay.addEventListener('click', function (e) {
      if (e.target === els.modalOverlay) closeModal();
    });
    if (els.modal) {
      els.modal.addEventListener('click', function (e) { e.stopPropagation(); });
    }
    document.getElementById('train-modal-close').addEventListener('click', closeModal);
    document.getElementById('train-modal-cancel').addEventListener('click', closeModal);
    document.getElementById('train-modal-save').addEventListener('click', saveEntry);

    els.btnNext.addEventListener('click', advanceStep);
    els.btnBack.addEventListener('click', function () {
      if (state.stepIndex > 0) {
        state.stepIndex -= 1;
        renderCoach();
      }
    });
    els.btnRestart.addEventListener('click', resetTraining);

    if (els.exitBtn) {
      els.exitBtn.addEventListener('click', function () {
        closeTraining();
      });
    }

    renderAll();
  }

  function openTraining() {
    cacheElements();
    initTraining();
    document.body.classList.add('training-mode');
    if (els.fullscreen) els.fullscreen.classList.add('is-open');
    renderAll();
  }

  function closeTraining() {
    document.body.classList.remove('training-mode');
    if (els.fullscreen) els.fullscreen.classList.remove('is-open');
    closeModal();
    var rulesBtn = document.querySelector('[data-page-mode="rules"]');
    if (rulesBtn) rulesBtn.classList.add('is-active');
    var trainBtn = document.querySelector('[data-page-mode="training"]');
    if (trainBtn) trainBtn.classList.remove('is-active');
  }

  function initModeSwitch() {
    cacheElements();
    var btns = document.querySelectorAll('[data-page-mode]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function () {
        var mode = this.getAttribute('data-page-mode');
        for (var j = 0; j < btns.length; j++) btns[j].classList.toggle('is-active', btns[j] === this);
        if (mode === 'training') openTraining();
        else closeTraining();
      });
    }
    initTraining();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initModeSwitch);
  } else {
    initModeSwitch();
  }
})();
