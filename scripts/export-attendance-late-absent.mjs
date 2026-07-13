

import ExcelJS from 'exceljs';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const STATUS_LABEL = {
  late: 'Опоздал',
  absent: 'Не пришёл',
};

function parseArgs(argv) {
  const opts = {
    from: process.env.DATE_FROM || '2026-06-01',
    to: process.env.DATE_TO || '2026-06-19',
    out: process.env.OUTPUT || '',
    base: (process.env.API_BASE_URL || process.env.VITE_API_BASE_URL || 'http:
    token: process.env.AUTH_TOKEN || process.env.API_TOKEN || '',
    concurrency: 4,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === '--from' && next) {
      opts.from = next;
      i++;
    }
    else if (a === '--to' && next) {
      opts.to = next;
      i++;
    }
    else if ((a === '--out' || a === '-o') && next) {
      opts.out = next;
      i++;
    }
    else if (a === '--base' && next) {
      opts.base = next.replace(/\/+$/, '');
      i++;
    }
    else if (a === '--token' && next) {
      opts.token = next;
      i++;
    }
    else if (a === '--help' || a === '-h') {
      console.log(`Usage: node scripts/export-attendance-late-absent.mjs [options]

Options:
  --from YYYY-MM-DD   Начало периода (default: 2026-06-01)
  --to YYYY-MM-DD     Конец периода (default: 2026-06-19)
  --out, -o FILE      Файл Excel
  --base URL          API base URL
  --token TOKEN       Bearer access_token

Env: AUTH_TOKEN, API_BASE_URL, DATE_FROM, DATE_TO, OUTPUT
`);
      process.exit(0);
    }
  }
  if (!opts.out) {
    opts.out = `attendance_late_absent_${opts.from}_${opts.to}.xlsx`;
  }
  return opts;
}

function assertIsoDate(s, label) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new Error(`${label} должен быть в формате YYYY-MM-DD, получено: ${s}`);
  }
}

function* eachDay(fromIso, toIso) {
  const cur = new Date(`${fromIso}T12:00:00`);
  const end = new Date(`${toIso}T12:00:00`);
  if (cur > end) {
    throw new Error(`DATE_FROM (${fromIso}) позже DATE_TO (${toIso})`);
  }
  while (cur <= end) {
    yield cur.toISOString().slice(0, 10);
    cur.setDate(cur.getDate() + 1);
  }
}

function formatArrival(iso) {
  if (!iso)
    return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime()))
    return iso;
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

async function fetchDailyReport(base, token, day) {
  const url = `${base}/api/v1/attendance/report/daily?${new URLSearchParams({ day })}`;
  const headers = { Accept: 'application/json' };
  if (token)
    headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  if (res.status === 401) {
    throw new Error('401 Unauthorized — задайте AUTH_TOKEN (access_token из браузера после входа).');
  }
  if (res.status === 403) {
    throw new Error('403 Forbidden — нет доступа к посещаемости.');
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Ошибка ${res.status} за ${day}: ${text || res.statusText}`);
  }
  return res.json();
}

async function mapPool(items, worker, concurrency) {
  const results = new Array(items.length);
  let index = 0;
  async function run() {
    while (index < items.length) {
      const i = index++;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => run()));
  return results;
}

function collectLateAbsentRows(day, report) {
  const items = Array.isArray(report?.items) ? report.items : [];
  const rows = [];
  for (const item of items) {
    if (item.status !== 'late' && item.status !== 'absent')
      continue;
    rows.push({
      date: day,
      name: item.display_name || '—',
      email: item.email || '—',
      role: item.role || '—',
      status: STATUS_LABEL[item.status] || item.status,
      statusCode: item.status,
      arrival: formatArrival(item.first_event_time),
      arrivalRaw: item.first_event_time,
      employeeNo: item.camera_employee_no || '—',
      camera: item.camera_name || '—',
      explanation: item.explanation_text || '',
    });
  }
  return rows;
}

async function buildWorkbook(rows, meta) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'tickets-front export script';
  wb.created = new Date();

  const ws = wb.addWorksheet('Опоздания и отсутствия', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  ws.columns = [
    { header: 'Дата', key: 'date', width: 12 },
    { header: 'Сотрудник', key: 'name', width: 28 },
    { header: 'Email', key: 'email', width: 26 },
    { header: 'Роль', key: 'role', width: 18 },
    { header: 'Статус', key: 'status', width: 14 },
    { header: 'Время прихода', key: 'arrival', width: 14 },
    { header: 'Табельный №', key: 'employeeNo', width: 14 },
    { header: 'Камера', key: 'camera', width: 22 },
    { header: 'Объяснительная', key: 'explanation', width: 32 },
  ];

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: 'middle' };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE8ECF4' },
  };

  rows.sort((a, b) => {
    const rank = (code) => (code === 'late' ? 0 : code === 'absent' ? 1 : 2);
    const d = rank(a.statusCode) - rank(b.statusCode);
    if (d !== 0)
      return d;
    const day = a.date.localeCompare(b.date);
    if (day !== 0)
      return day;
    return a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' });
  });

  for (const row of rows) {
    const excelRow = ws.addRow(row);
    if (row.statusCode === 'absent') {
      excelRow.getCell('status').font = { color: { argb: 'FFB91C1C' } };
    }
    else if (row.statusCode === 'late') {
      excelRow.getCell('status').font = { color: { argb: 'FFB45309' } };
    }
  }

  const summary = wb.addWorksheet('Сводка');
  summary.addRow(['Период', `${meta.from} — ${meta.to}`]);
  summary.addRow(['Дней обработано', meta.daysProcessed]);
  summary.addRow(['Всего записей', rows.length]);
  summary.addRow(['Опозданий', rows.filter((r) => r.statusCode === 'late').length]);
  summary.addRow(['Отсутствий', rows.filter((r) => r.statusCode === 'absent').length]);
  summary.addRow(['API', meta.base]);
  summary.getColumn(1).width = 22;
  summary.getColumn(2).width = 40;

  return wb;
}

async function main() {
  const opts = parseArgs(process.argv);
  assertIsoDate(opts.from, '--from');
  assertIsoDate(opts.to, '--to');

  if (!opts.token) {
    console.error('Ошибка: не задан AUTH_TOKEN.');
    console.error('Скопируйте access_token из DevTools → Application → Local Storage после входа в приложение.');
    console.error('PowerShell: $env:AUTH_TOKEN="..."; node scripts/export-attendance-late-absent.mjs');
    process.exit(1);
  }

  const days = [...eachDay(opts.from, opts.to)];
  console.log(`Запрос посещаемости: ${opts.from} — ${opts.to} (${days.length} дн.), API: ${opts.base}`);

  const reports = await mapPool(
    days,
    async (day) => {
      process.stdout.write(`  ${day}... `);
      try {
        const report = await fetchDailyReport(opts.base, opts.token, day);
        const n = (report?.items || []).filter((i) => i.status === 'late' || i.status === 'absent').length;
        console.log(`${n} записей`);
        return { day, report, error: null };
      }
      catch (e) {
        console.log('ошибка');
        return { day, report: null, error: e instanceof Error ? e.message : String(e) };
      }
    },
    opts.concurrency,
  );

  const errors = reports.filter((r) => r.error);
  if (errors.length === days.length) {
    console.error('\nНе удалось загрузить ни один день:');
    for (const e of errors)
      console.error(`  ${e.day}: ${e.error}`);
    process.exit(1);
  }
  if (errors.length) {
    console.warn(`\nПредупреждение: ошибки за ${errors.length} дн.:`);
    for (const e of errors)
      console.warn(`  ${e.day}: ${e.error}`);
  }

  const rows = reports
    .filter((r) => r.report)
    .flatMap((r) => collectLateAbsentRows(r.day, r.report));

  const wb = await buildWorkbook(rows, {
    from: opts.from,
    to: opts.to,
    daysProcessed: days.length - errors.length,
    base: opts.base,
  });

  const outPath = resolve(process.cwd(), opts.out);
  const buffer = await wb.xlsx.writeBuffer();
  await writeFile(outPath, buffer);

  console.log(`\nГотово: ${outPath}`);
  console.log(`Записей: ${rows.length} (опозданий: ${rows.filter((r) => r.statusCode === 'late').length}, отсутствий: ${rows.filter((r) => r.statusCode === 'absent').length})`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
