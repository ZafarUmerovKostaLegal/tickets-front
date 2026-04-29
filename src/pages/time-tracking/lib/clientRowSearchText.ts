import type { TimeManagerClientRow } from '@entities/time-tracking';

export function clientRowSearchText(c: TimeManagerClientRow): string {
    return [c.name, c.id, c.address, c.email, c.phone, c.contact_name, c.contact_email, c.contact_phone]
        .filter((x) => x != null && String(x).trim() !== '')
        .map((x) => String(x).trim())
        .join(' ');
}
