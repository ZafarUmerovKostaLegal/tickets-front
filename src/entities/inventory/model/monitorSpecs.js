export const MONITOR_PORT_OPTIONS = ['HDMI', 'DisplayPort', 'USB-C', 'VGA', 'DVI'];
export const MONITOR_RESOLUTION_PRESETS = [
    '1920×1080',
    '2560×1440',
    '3440×1440',
    '3840×2160',
];
export const EMPTY_MONITOR_SPECS = {
    diagonalIn: '',
    resolution: '',
    refreshHz: '',
    panel: '',
    ports: [],
    vesa: '',
    curved: '',
};
const MONITOR_CATEGORY = /монитор/i;
const BLOCK_START = '--- монитор ---';
const BLOCK_END = '---';
export function isMonitorCategory(categoryName) {
    return MONITOR_CATEGORY.test(categoryName ?? '');
}
function yesNo(raw) {
    const v = raw.trim().toLowerCase();
    if (v === 'да' || v === 'yes' || v === 'true' || v === '1')
        return 'yes';
    if (v === 'нет' || v === 'no' || v === 'false' || v === '0')
        return 'no';
    return '';
}
function labelYesNo(v) {
    if (v === 'yes')
        return 'да';
    if (v === 'no')
        return 'нет';
    return '';
}
function parsePorts(raw) {
    return raw
        .split(/[,;/|]+/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => {
        const lower = p.toLowerCase();
        if (lower === 'dp' || lower.includes('display'))
            return 'DisplayPort';
        if (lower.includes('hdmi'))
            return 'HDMI';
        if (lower.includes('usb'))
            return 'USB-C';
        if (lower.includes('vga'))
            return 'VGA';
        if (lower.includes('dvi'))
            return 'DVI';
        return p;
    });
}
function normalizePanel(raw) {
    const v = raw.trim().toUpperCase().replace(/\s+/g, '-');
    if (v === 'IPS' || v === 'VA' || v === 'TN' || v === 'OLED')
        return v;
    if (v === 'MINI-LED' || v === 'MINILED')
        return 'Mini-LED';
    return '';
}
/** Разбирает блок характеристик монитора из description. */
export function parseMonitorDescription(description) {
    const text = (description ?? '').replace(/\r\n/g, '\n').trim();
    if (!text) {
        return { specs: { ...EMPTY_MONITOR_SPECS }, notes: '', hasBlock: false };
    }
    const startIdx = text.toLowerCase().indexOf(BLOCK_START);
    if (startIdx < 0) {
        // Loose legacy lines without block markers.
        const specs = { ...EMPTY_MONITOR_SPECS };
        let loose = false;
        for (const line of text.split('\n')) {
            const m = line.match(/^\s*([^:：]+)[:：]\s*(.+)\s*$/);
            if (!m)
                continue;
            const key = m[1].trim().toLowerCase();
            const val = m[2].trim();
            if (/диагонал|diagonal|inch|дюйм/.test(key)) {
                specs.diagonalIn = val.replace(/["”″]/g, '').replace(/\s*дюйм.*/i, '').trim();
                loose = true;
            }
            else if (/разреш|resolution/.test(key)) {
                specs.resolution = val.replace(/x/gi, '×');
                loose = true;
            }
            else if (/частот|refresh|гц|hz/.test(key)) {
                specs.refreshHz = val.replace(/\s*гц|\s*hz/ig, '').trim();
                loose = true;
            }
            else if (/панел|panel/.test(key)) {
                specs.panel = normalizePanel(val);
                loose = true;
            }
            else if (/разъём|разъем|порт|port|connect/.test(key)) {
                specs.ports = parsePorts(val);
                loose = true;
            }
            else if (/vesa/.test(key)) {
                specs.vesa = yesNo(val);
                loose = true;
            }
            else if (/изогнут|curved/.test(key)) {
                specs.curved = yesNo(val);
                loose = true;
            }
        }
        let notes = loose ? '' : text;
        if (loose) {
            const sep = text.match(/\n---\s*\n([\s\S]*)$/);
            if (sep)
                notes = sep[1].trim();
        }
        return { specs, notes, hasBlock: loose };
    }
    const afterStart = text.slice(startIdx + BLOCK_START.length).replace(/^\n+/, '');
    const endIdx = afterStart.indexOf(`\n${BLOCK_END}`);
    const block = endIdx >= 0 ? afterStart.slice(0, endIdx) : afterStart;
    const notes = endIdx >= 0
        ? afterStart.slice(endIdx + `\n${BLOCK_END}`.length).replace(/^\n+/, '').trim()
        : text.slice(0, startIdx).trim();
    const specs = { ...EMPTY_MONITOR_SPECS };
    for (const line of block.split('\n')) {
        const m = line.match(/^\s*([^:：]+)[:：]\s*(.+)\s*$/);
        if (!m)
            continue;
        const key = m[1].trim().toLowerCase();
        const val = m[2].trim();
        if (key.startsWith('диагонал'))
            specs.diagonalIn = val.replace(/["”″]/g, '').replace(/\s*дюйм.*/i, '').trim();
        else if (key.startsWith('разреш'))
            specs.resolution = val.replace(/x/gi, '×');
        else if (key.startsWith('частот'))
            specs.refreshHz = val.replace(/\s*гц|\s*hz/ig, '').trim();
        else if (key.startsWith('панел'))
            specs.panel = normalizePanel(val);
        else if (key.startsWith('разъём') || key.startsWith('разъем') || key.startsWith('порт'))
            specs.ports = parsePorts(val);
        else if (key === 'vesa')
            specs.vesa = yesNo(val);
        else if (key.startsWith('изогнут'))
            specs.curved = yesNo(val);
    }
    return { specs, notes, hasBlock: true };
}
export function formatMonitorDescription(specs, notes) {
    const lines = [BLOCK_START];
    if (specs.diagonalIn.trim())
        lines.push(`Диагональ: ${specs.diagonalIn.trim().replace(/["”″]/g, '')}"`);
    if (specs.resolution.trim())
        lines.push(`Разрешение: ${specs.resolution.trim().replace(/x/gi, '×')}`);
    if (specs.refreshHz.trim())
        lines.push(`Частота: ${specs.refreshHz.trim()} Гц`);
    if (specs.panel)
        lines.push(`Панель: ${specs.panel}`);
    if (specs.ports.length)
        lines.push(`Разъёмы: ${specs.ports.join(', ')}`);
    if (specs.vesa)
        lines.push(`VESA: ${labelYesNo(specs.vesa)}`);
    if (specs.curved)
        lines.push(`Изогнутый: ${labelYesNo(specs.curved)}`);
    lines.push(BLOCK_END);
    const block = lines.join('\n');
    const free = notes.trim();
    return free ? `${block}\n${free}` : block;
}
export function monitorSpecsSummary(specs) {
    const out = [];
    if (specs.diagonalIn.trim())
        out.push(`${specs.diagonalIn.trim()}"`);
    if (specs.resolution.trim())
        out.push(specs.resolution.trim());
    if (specs.refreshHz.trim())
        out.push(`${specs.refreshHz.trim()} Гц`);
    if (specs.panel)
        out.push(specs.panel);
    if (specs.ports.length)
        out.push(specs.ports.join(', '));
    if (specs.vesa === 'yes')
        out.push('VESA');
    if (specs.curved === 'yes')
        out.push('изогнутый');
    return out;
}
export function hasMonitorSpecs(specs) {
    return Boolean(specs.diagonalIn.trim()
        || specs.resolution.trim()
        || specs.refreshHz.trim()
        || specs.panel
        || specs.ports.length
        || specs.vesa
        || specs.curved);
}
