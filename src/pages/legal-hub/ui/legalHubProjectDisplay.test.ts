import { describe, expect, it } from 'vitest';
import { assignProjectToFolder, groupProjects, normalizeProjectDisplay, reorderProjectDisplay, type ProjectFolder } from './legalHubProjectDisplay';

const projects = [
    { id: 'a', name: 'A' },
    { id: 'b', name: 'B' },
    { id: 'c', name: 'C' },
];

function folder(partial: Partial<ProjectFolder> & Pick<ProjectFolder, 'id'>): ProjectFolder {
    return {
        name: partial.name ?? partial.id,
        color: partial.color ?? 'slate',
        projectIds: partial.projectIds ?? [],
        collapsed: partial.collapsed ?? false,
        clientOrder: partial.clientOrder ?? [],
        id: partial.id,
    };
}

describe('project folders', () => {
    it('кладёт проект только в одну папку', () => {
        const next = assignProjectToFolder([
            folder({ id: 'one', projectIds: ['a'] }),
            folder({ id: 'two' }),
        ], 'two', 'a', true);
        expect(next[0]?.projectIds).toEqual([]);
        expect(next[1]?.projectIds).toEqual(['a']);
    });

    it('группирует известные проекты и оставляет остальные снаружи', () => {
        const grouped = groupProjects(projects, [folder({ id: 'one', projectIds: ['c', 'missing', 'a'] })]);
        expect(grouped.folders[0]?.projects.map((project) => project.id)).toEqual(['c', 'a']);
        expect(grouped.loose.map((project) => project.id)).toEqual(['b']);
    });

    it('читает только свои папки и отбрасывает повтор проекта', () => {
        const settings = normalizeProjectDisplay({
            hideLocked: true,
            folders: [
                { id: 'one', name: 'Суды', color: 'nope', projectIds: ['a', 'a'], collapsed: true },
                { id: 'two', name: 'Сделки', color: 'accent', projectIds: ['a', 'b'] },
                { id: '', name: 'Пусто' },
            ],
        });
        expect(settings.hideLocked).toBe(true);
        expect(settings.folders).toEqual([
            { id: 'one', name: 'Суды', color: 'slate', projectIds: ['a'], collapsed: true, clientOrder: [] },
            { id: 'two', name: 'Сделки', color: 'accent', projectIds: ['b'], collapsed: false, clientOrder: [] },
        ]);
        expect(settings.sidebarOrder).toEqual([]);
    });

    it('меняет местами папку и клиента', () => {
        const rows = [
            { id: 'a', client: 'Kosta Legal' },
            { id: 'b', client: 'North' },
        ];
        const settings = normalizeProjectDisplay({
            folders: [folder({ id: 'one', projectIds: [] })],
            sidebarOrder: [
                { type: 'folder', id: 'one' },
                { type: 'client', name: 'Kosta Legal' },
                { type: 'client', name: 'North' },
            ],
        });
        const next = reorderProjectDisplay(settings, rows, 'root', 'client:north', 'folder:one');
        expect(next.sidebarOrder.map((token) => token.type === 'folder' ? token.id : token.name)).toEqual([
            'North',
            'one',
            'Kosta Legal',
        ]);
    });
});
