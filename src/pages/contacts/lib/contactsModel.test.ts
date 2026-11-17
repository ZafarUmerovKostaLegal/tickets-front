import { describe, expect, it } from 'vitest';
import type { TimeManagerClientRow, TimeTrackingUserRow } from '@entities/time-tracking';
import type { User } from '@entities/user';
import {
    buildVCard,
    contactAvatarColor,
    contactInitials,
    contactSearchText,
    employeesToContactCards,
    flattenClientContacts,
    mailHref,
    mergeEmployeeDirectory,
    telHref,
    type ContactCard,
} from './contactsModel';

const ttUser = (p: Partial<TimeTrackingUserRow>) => ({ id: 1, email: 'a@kostalegal.com', display_name: null, ...p } as TimeTrackingUserRow);
const authUser = (p: Partial<User>) => ({ id: 1, email: 'a@kostalegal.com', display_name: null, role: 'user', ...p } as User);

describe('contacts helpers', () => {
    it('builds initials from one or two words', () => {
        expect(contactInitials('  ')).toBe('?');
        expect(contactInitials('мадина')).toBe('МА');
        expect(contactInitials('Иван  Петров Сидоров')).toBe('ИП');
    });

    it('assigns a stable avatar colour', () => {
        expect(contactAvatarColor('Иван')).toBe(contactAvatarColor('Иван'));
        expect(contactAvatarColor('Иван')).toMatch(/^#[0-9a-f]{6}$/);
    });

    it('builds tel: and mailto: links', () => {
        expect(telHref(' +998 (90) 123-45-67 ')).toBe('tel:+998901234567');
        expect(telHref('90 123 45 67')).toBe('tel:901234567');
        expect(telHref('+')).toBeNull();
        expect(telHref('')).toBeNull();
        expect(mailHref(' a+b@x.uz ')).toBe('mailto:a%2Bb%40x.uz');
        expect(mailHref(' ')).toBeNull();
    });
});

describe('mergeEmployeeDirectory', () => {
    it('merges time tracking and auth users, skipping blocked, archived and duplicate users', () => {
        const merged = mergeEmployeeDirectory(
            [
                ttUser({ id: 1, display_name: 'Борис' }),
                ttUser({ id: 2, display_name: 'Архив', is_archived: true }),
            ],
            [
                authUser({ id: 1, display_name: 'Борис (auth)' }),
                authUser({ id: 3, display_name: 'Анна', email: 'anna@kostalegal.com' }),
                authUser({ id: 4, display_name: 'Блок', is_blocked: true }),
            ],
        );
        expect(merged.map((u) => u.display_name)).toEqual(['Анна', 'Борис']);
    });
});

describe('contact cards', () => {
    it('maps employees to colleague cards', () => {
        const [card] = employeesToContactCards([ttUser({ id: 9, email: ' x@y.z ', position: ' Юрист ' })]);
        expect(card).toEqual({
            id: 'colleague-9',
            kind: 'colleague',
            name: 'x@y.z',
            subtitle: 'Юрист',
            phone: null,
            email: 'x@y.z',
            picture: null,
        });
    });

    it('flattens primary and extra client contacts, sorted by name', () => {
        const cards = flattenClientContacts([
            {
                id: 'c1',
                name: ' ООО Альфа ',
                contact_name: 'Яков',
                contact_phone: '+998',
                extra_contacts: [{ id: 'e1', name: 'Алла', email: 'alla@a.uz' }, { id: 'e2', name: '  ' }],
            },
            { id: 'c2', name: 'Архивный', contact_name: 'Не показывать', is_archived: true },
        ] as unknown as TimeManagerClientRow[]);
        expect(cards.map((c) => [c.id, c.name, c.subtitle, c.isPrimary])).toEqual([
            ['client-c1-e1', 'Алла', 'ООО Альфа', false],
            ['client-c1-primary', 'Яков', 'ООО Альфа', true],
        ]);
    });

    it('builds search text and vCard', () => {
        const card: ContactCard = {
            id: '1', kind: 'client', name: 'Алла', subtitle: 'ООО', phone: '+998', email: 'a@b.c', picture: null,
        };
        expect(contactSearchText(card)).toBe('Алла ООО +998 a@b.c');
        expect(buildVCard(card).split('\r\n')).toEqual([
            'BEGIN:VCARD', 'VERSION:3.0', 'FN:Алла', 'N:;Алла;;;', 'ORG:ООО', 'TEL;TYPE=CELL:+998', 'EMAIL;TYPE=INTERNET:a@b.c', 'END:VCARD',
        ]);
        expect(buildVCard({ ...card, subtitle: '', phone: null, email: null })).not.toContain('ORG:');
    });
});
