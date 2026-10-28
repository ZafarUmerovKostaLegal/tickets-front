export const EQUIPMENT_QR_COUNT = 500;
export const EQUIPMENT_QR_PREFIX = 'KL-EQ-';
export const EQUIPMENT_QR_SITE_ORIGIN = 'https://tickets.kostalegal.com';
const CODE_RE = /^KL-EQ-(\d{4})$/;
export function equipmentQrCode(index) {
    const n = Math.trunc(index);
    if (n < 1 || n > EQUIPMENT_QR_COUNT)
        throw new Error(`QR index must be 1..${EQUIPMENT_QR_COUNT}`);
    return `${EQUIPMENT_QR_PREFIX}${String(n).padStart(4, '0')}`;
}
export function equipmentQrCodes() {
    return Array.from({ length: EQUIPMENT_QR_COUNT }, (_, i) => equipmentQrCode(i + 1));
}
export function parseEquipmentQrCode(raw) {
    const code = raw.trim().toUpperCase();
    const match = CODE_RE.exec(code);
    if (!match)
        return null;
    const n = Number(match[1]);
    if (n < 1 || n > EQUIPMENT_QR_COUNT)
        return null;
    return `${EQUIPMENT_QR_PREFIX}${String(n).padStart(4, '0')}`;
}
export function equipmentQrPagePath(code) {
    return `/inventory/tag/${encodeURIComponent(code)}`;
}
export function equipmentQrPublicUrl(code) {
    return `${EQUIPMENT_QR_SITE_ORIGIN}${equipmentQrPagePath(code)}`;
}
