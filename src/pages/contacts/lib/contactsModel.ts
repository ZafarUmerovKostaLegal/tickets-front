import type { TimeManagerClientRow, TimeTrackingUserRow } from '@entities/time-tracking';
import type { User } from '@entities/user';
import { isHiddenSystemUser } from '@shared/lib';

export type ContactCardKind = 'colleague' | 'client';

export type ContactCard = {
    id: string;
    kind: ContactCardKind;
    name: string;
    subtitle: string;
    phone: string | null;
    email: string | null;
    picture: string | null;
    clientId?: string;
    isPrimary?: boolean;
};

const AVATAR_COLORS = ['#e17076', '#7bc862', '#65aadd', '#a695e7', '#ee7aae', '#6ec9cb', '#faa774', '#5b9bd5'];

export function contactInitials(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0)
        return '?';
    if (parts.length === 1)
        return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

export function contactAvatarColor(name: string): string {
    let h = 0;
    for (let i = 0; i < name.length; i++)
        h = name.charCodeAt(i) + ((h << 5) - h);
    return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

export function telHref(raw: string): string | null {
    const t = raw.trim();
    if (!t)
        return null;
    const compact = t.startsWith('+')
        ? `+${t.slice(1).replace(/\D/g, '')}`
        : t.replace(/\D/g, '');
    if (!compact || compact === '+')
        return null;
    return `tel:${compact}`;
}

export function mailHref(raw: string): string | null {
    const e = raw.trim();
    if (!e)
        return null;
    return `mailto:${encodeURIComponent(e)}`;
}

function employeeLabel(u: TimeTrackingUserRow): string {
    const n = u.display_name?.trim();
    if (n)
        return n;
    return u.email?.trim() || `User ${u.id}`;
}

function authUserToEmployeeRow(u: User): TimeTrackingUserRow {
    return {
        id: u.id,
        email: u.email,
        display_name: u.display_name,
        picture: u.picture,
        role: u.role,
        position: u.position,
        is_blocked: u.is_blocked,
        is_archived: u.is_archived,
        created_at: u.created_at,
        updated_at: u.updated_at,
    };
}

export function mergeEmployeeDirectory(ttRows: TimeTrackingUserRow[], authRows: User[]): TimeTrackingUserRow[] {
    const byId = new Map<number, TimeTrackingUserRow>();
    for (const u of ttRows) {
        if (u.is_archived || u.is_blocked)
            continue;
        if (isHiddenSystemUser(u))
            continue;
        byId.set(u.id, u);
    }
    for (const au of authRows) {
        if (au.is_archived || au.is_blocked)
            continue;
        if (isHiddenSystemUser(au))
            continue;
        if (!byId.has(au.id))
            byId.set(au.id, authUserToEmployeeRow(au));
    }
    return [...byId.values()].sort((a, b) => employeeLabel(a).localeCompare(employeeLabel(b), 'ru', { sensitivity: 'base' }));
}

export function employeesToContactCards(employees: TimeTrackingUserRow[]): ContactCard[] {
    return employees.map((emp) => {
        const name = employeeLabel(emp);
        const subtitle = emp.position?.trim() || emp.role?.trim() || '';
        return {
            id: `colleague-${emp.id}`,
            kind: 'colleague',
            name,
            subtitle,
            phone: null,
            email: emp.email?.trim() || null,
            picture: emp.picture ?? null,
        };
    });
}

export function flattenClientContacts(clients: TimeManagerClientRow[]): ContactCard[] {
    const cards: ContactCard[] = [];
    for (const client of clients) {
        if (client.is_archived)
            continue;
        const company = client.name.trim();
        const primaryName = client.contact_name?.trim() ?? '';
        if (primaryName) {
            cards.push({
                id: `client-${client.id}-primary`,
                kind: 'client',
                name: primaryName,
                subtitle: company,
                phone: client.contact_phone?.trim() || null,
                email: client.contact_email?.trim() || null,
                picture: null,
                clientId: client.id,
                isPrimary: true,
            });
        }
        for (const extra of client.extra_contacts ?? []) {
            const name = extra.name?.trim() ?? '';
            if (!name)
                continue;
            cards.push({
                id: `client-${client.id}-${extra.id}`,
                kind: 'client',
                name,
                subtitle: company,
                phone: extra.phone?.trim() || null,
                email: extra.email?.trim() || null,
                picture: null,
                clientId: client.id,
                isPrimary: false,
            });
        }
    }
    cards.sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }));
    return cards;
}

export function contactSearchText(card: ContactCard): string {
    return [card.name, card.subtitle, card.phone, card.email].filter(Boolean).join(' ');
}

export function buildVCard(card: ContactCard): string {
    const lines = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${card.name}`, `N:;${card.name};;;`];
    if (card.subtitle)
        lines.push(`ORG:${card.subtitle}`);
    if (card.phone)
        lines.push(`TEL;TYPE=CELL:${card.phone}`);
    if (card.email)
        lines.push(`EMAIL;TYPE=INTERNET:${card.email}`);
    lines.push('END:VCARD');
    return lines.join('\r\n');
}

export function downloadVCard(card: ContactCard): void {
    const blob = new Blob([buildVCard(card)], { type: 'text/vcard;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${card.name.replace(/[^\w\s-]/g, '').trim() || 'contact'}.vcf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}
