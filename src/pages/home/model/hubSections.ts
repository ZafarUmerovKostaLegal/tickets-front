import type { HubTileId } from '../lib/hubTileOrder';

export type HubSectionId = 'daily' | 'finance' | 'team';

export type HubSectionDef = {
    id: HubSectionId;
    tileIds: HubTileId[];
    accent: string;
    accentSoft: string;
    accentBorder: string;
};

export const HUB_SECTIONS: HubSectionDef[] = [
    {
        id: 'daily',
        tileIds: [
            'kostaLegalAi',
            'timeTracking',
            'kostaDaily',
            'todo',
            'tickets',
            'attendance',
            'callSchedule',
        ],
        accent: '#B85C5C',
        accentSoft: '#F8F3F3',
        accentBorder: '#E8D8D8',
    },
    {
        id: 'finance',
        tileIds: ['expenses', 'accounting', 'correspondence', 'admin'],
        accent: '#9A8548',
        accentSoft: '#F8F6EF',
        accentBorder: '#E8E2D0',
    },
    {
        id: 'team',
        tileIds: [
            'vacationSchedule',
            'inventory',
            'contacts',
            'rules',
            'help',
            'networkDrive',
        ],
        accent: '#5E8575',
        accentSoft: '#F0F5F3',
        accentBorder: '#D6E4DE',
    },
];

const TILE_SECTION_MAP = new Map<HubTileId, HubSectionId>(
    HUB_SECTIONS.flatMap((section) =>
        section.tileIds.map((tileId) => [tileId, section.id] as const),
    ),
);

export function getHubSectionForTile(tileId: HubTileId): HubSectionId | null {
    return TILE_SECTION_MAP.get(tileId) ?? null;
}

export function getHubSectionDef(sectionId: HubSectionId): HubSectionDef {
    return HUB_SECTIONS.find((section) => section.id === sectionId)!;
}
