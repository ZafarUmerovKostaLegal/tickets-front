/**
 * Заводит ноутбуки из отчёта автоинвентаризации в модуль «Инвентарь» через API.
 *
 * Год выпуска берём из BIOS-даты отчёта: скрипт на машинах отдаёт её как
 * /Date(1762387200000)/ и при неудачном разборе подставляет 2000, из-за чего
 * новая техника получала класс C. Здесь дата уже разобрана вручную.
 *
 * Usage: node scripts/import-inventory-laptops.mjs --token <access_token> [--dry-run]
 * Env: AUTH_TOKEN | API_TOKEN, API_BASE_URL | VITE_API_BASE_URL
 */

const LAPTOPS = [
    {
        name: 'HP ProBook 450 15.6 inch G9',
        serial_number: '5CD2507RZL',
        inventory_number: 'NB-5CD2507RZL',
        // BIOS /Date(1762387200000)/ → 2025-11-06
        purchase_date: '2025-11-06',
        equipment_class: 'A',
        status: 'in_use',
        description: [
            'CPU: 12th Gen Intel Core i5-1235U (10 ядер)',
            'ОЗУ: 16 ГБ',
            'Диск: SSD SAMSUNG MZVLQ512HBLU-00BH1, 512 ГБ',
            'GPU: Intel Iris Xe Graphics',
            'ПК: AbduazizovPC, пользователь toki',
            'ОС: Windows 10 Pro 10.0.19045',
            'Автоинвентаризация 2026-08-24, BIOS 2025-11-06',
        ].join('\n'),
    },
    {
        name: 'Acer Aspire A515-57',
        serial_number: 'NXKN4EY0013491042C3400',
        inventory_number: 'NB-NXKN4EY0013491042C3400',
        // BIOS /Date(1780963200000)/ → 2026-06-09
        purchase_date: '2026-06-09',
        equipment_class: 'A',
        status: 'in_use',
        description: [
            'CPU: 12th Gen Intel Core i5-12450H (8 ядер)',
            'ОЗУ: 8 ГБ',
            'Диск: SSD NVMe Micron_2450_MTFDKBA256TFK, 256 ГБ',
            'GPU: Intel UHD Graphics',
            'ПК: LenneshmidtPC2, пользователь sadk',
            'ОС: Windows 11 Pro 10.0.26200',
            'Автоинвентаризация 2026-08-24, BIOS 2026-06-09',
        ].join('\n'),
    },
];

function parseArgs(argv) {
    const opts = {
        base: (process.env.API_BASE_URL || process.env.VITE_API_BASE_URL || 'https://ticketsback.kostalegal.com').replace(/\/+$/, ''),
        token: process.env.AUTH_TOKEN || process.env.API_TOKEN || '',
        categoryId: process.env.CATEGORY_ID ? Number(process.env.CATEGORY_ID) : null,
        dryRun: false,
    };
    for (let i = 2; i < argv.length; i++) {
        const a = argv[i];
        const next = argv[i + 1];
        if (a === '--token' && next) {
            opts.token = next;
            i++;
        }
        else if (a === '--base' && next) {
            opts.base = next.replace(/\/+$/, '');
            i++;
        }
        else if (a === '--category-id' && next) {
            opts.categoryId = Number(next);
            i++;
        }
        else if (a === '--dry-run') {
            opts.dryRun = true;
        }
        else if (a === '--help' || a === '-h') {
            console.log(`Usage: node scripts/import-inventory-laptops.mjs [options]

Options:
  --token TOKEN       Bearer access_token (localStorage.access_token в браузере)
  --base URL          API base URL
  --category-id ID    Категория инвентаря; по умолчанию ищется по названию «Ноутбуки»
  --dry-run           Только показать, что будет создано

Env: AUTH_TOKEN, API_BASE_URL, CATEGORY_ID
`);
            process.exit(0);
        }
    }
    return opts;
}

async function api(opts, path, init = {}) {
    const res = await fetch(`${opts.base}${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${opts.token}`, ...(init.headers || {}) },
    });
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`${init.method || 'GET'} ${path} → ${res.status} ${res.statusText}${body ? `: ${body.slice(0, 400)}` : ''}`);
    }
    return res.json();
}

async function resolveCategoryId(opts) {
    if (opts.categoryId)
        return opts.categoryId;
    const categories = await api(opts, '/api/v1/inventory/categories');
    const match = categories.find((c) => /ноут|laptop/i.test(c.name));
    if (!match) {
        const names = categories.map((c) => `${c.id} — ${c.name}`).join('\n  ');
        throw new Error(`Категория для ноутбуков не найдена. Укажите --category-id. Доступные:\n  ${names}`);
    }
    return match.id;
}

async function findExistingBySerial(opts, serial) {
    const page = await api(opts, '/api/v1/inventory/items?limit=1000&include_archived=true');
    const items = Array.isArray(page) ? page : (page.items ?? []);
    return items.find((i) => (i.serial_number || '').trim().toUpperCase() === serial.toUpperCase()) ?? null;
}

async function createLaptop(opts, categoryId, laptop) {
    const form = new FormData();
    form.append('name', laptop.name);
    form.append('category_id', String(categoryId));
    form.append('inventory_number', laptop.inventory_number);
    form.append('description', laptop.description);
    form.append('serial_number', laptop.serial_number);
    form.append('equipment_class', laptop.equipment_class);
    form.append('status', laptop.status);
    form.append('purchase_date', new Date(`${laptop.purchase_date}T00:00:00.000Z`).toISOString());
    return api(opts, '/api/v1/inventory/items', { method: 'POST', body: form });
}

async function main() {
    const opts = parseArgs(process.argv);
    if (!opts.token) {
        console.error('Нужен токен: --token <access_token> или AUTH_TOKEN. Взять можно в браузере: localStorage.getItem("access_token")');
        process.exit(1);
    }
    const categoryId = await resolveCategoryId(opts);
    console.log(`API: ${opts.base}`);
    console.log(`Категория: ${categoryId}`);
    for (const laptop of LAPTOPS) {
        const existing = await findExistingBySerial(opts, laptop.serial_number);
        if (existing) {
            console.log(`= уже есть: ${laptop.name} (${laptop.serial_number}) → ${existing.inventory_number}, uuid ${existing.uuid}`);
            continue;
        }
        if (opts.dryRun) {
            console.log(`+ создать: ${laptop.name} / ${laptop.inventory_number} / класс ${laptop.equipment_class} / покупка ${laptop.purchase_date}`);
            continue;
        }
        const created = await createLaptop(opts, categoryId, laptop);
        console.log(`+ создан: ${created.name} → ${created.inventory_number}, uuid ${created.uuid}, класс ${created.equipment_class ?? '—'}`);
    }
}

main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
});
