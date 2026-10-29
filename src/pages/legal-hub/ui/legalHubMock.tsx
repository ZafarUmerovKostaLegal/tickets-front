import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export const UTIL_KEYS = ['progress', 'associate', 'partner', 'wait', 'changes', 'todo'] as const;
export type UtilKey = (typeof UTIL_KEYS)[number];

export type UtilSlice = { key: UtilKey; count: number };

export type MemberLoad = {
    tasks: number;
    hoursUsed: number;
    hoursCap: number;
    percent: number;
    statuses: {
        progress: number;
        wait: number;
        review: number;
        changes: number;
        reviewing: number;
    };
    util: Record<UtilKey, number>;
};

export type MockMemberRow = {
    id: number;
    name: string;
    load: MemberLoad;
};

const FALLBACK_UTIL: Record<UtilKey, number> = {
    progress: 12,
    associate: 8,
    partner: 6,
    wait: 5,
    changes: 1,
    todo: 3,
};

export const MOCK_PROJECTS = 6;
export const MOCK_DUE = 4;

function rng(seed: number): () => number {
    let x = (seed >>> 0) || 1;
    return () => {
        x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
        return x / 4294967296;
    };
}

function splitInt(total: number, parts: number, rand: () => number): number[] {
    const weights = Array.from({ length: parts }, () => 0.35 + rand());
    const sum = weights.reduce((acc, value) => acc + value, 0);
    const out = weights.map((weight) => Math.floor((total * weight) / sum));
    let left = total - out.reduce((acc, value) => acc + value, 0);
    let index = 0;
    while (left > 0) {
        out[index % parts] += 1;
        left -= 1;
        index += 1;
    }
    return out;
}

export function mockMemberLoad(id: number, capacityRaw?: string): MemberLoad {
    const rand = rng(id * 97 + 13);
    const tasks = 6 + Math.floor(rand() * 10);
    const parts = splitInt(tasks, UTIL_KEYS.length, rand);
    const util = {
        progress: parts[0] ?? 0,
        associate: parts[1] ?? 0,
        partner: parts[2] ?? 0,
        wait: parts[3] ?? 0,
        changes: parts[4] ?? 0,
        todo: parts[5] ?? 0,
    };
    const parsedCap = Number(capacityRaw);
    const hoursCap = Number.isFinite(parsedCap) && parsedCap > 0 ? parsedCap : 40;
    const percent = 42 + Math.floor(rand() * 48);
    const hoursUsed = Math.round(hoursCap * percent) / 100;
    return {
        tasks,
        hoursUsed: Math.round(hoursUsed * 10) / 10,
        hoursCap,
        percent,
        statuses: {
            progress: util.progress,
            wait: util.wait,
            review: util.associate + util.partner,
            changes: util.changes,
            reviewing: util.todo,
        },
        util,
    };
}

export function slicesFromUtil(util: Record<UtilKey, number>): UtilSlice[] {
    return UTIL_KEYS.map((key) => ({ key, count: util[key] }));
}

export function fallbackSlices(): UtilSlice[] {
    return slicesFromUtil(FALLBACK_UTIL);
}

export function sumUtil(loads: MemberLoad[]): UtilSlice[] {
    const totals: Record<UtilKey, number> = {
        progress: 0,
        associate: 0,
        partner: 0,
        wait: 0,
        changes: 0,
        todo: 0,
    };
    for (const load of loads) {
        for (const key of UTIL_KEYS)
            totals[key] += load.util[key];
    }
    return slicesFromUtil(totals);
}

export type TeamStats = {
    tasks: number;
    projects: number;
    wait: number;
    review: number;
    changes: number;
    due: number;
};

export function teamStats(loads: MemberLoad[]): TeamStats {
    if (loads.length === 0) {
        return {
            tasks: Object.values(FALLBACK_UTIL).reduce((acc, value) => acc + value, 0),
            projects: MOCK_PROJECTS,
            wait: FALLBACK_UTIL.wait,
            review: FALLBACK_UTIL.associate + FALLBACK_UTIL.partner,
            changes: FALLBACK_UTIL.changes,
            due: MOCK_DUE,
        };
    }
    return {
        tasks: loads.reduce((acc, load) => acc + load.tasks, 0),
        projects: MOCK_PROJECTS,
        wait: loads.reduce((acc, load) => acc + load.util.wait, 0),
        review: loads.reduce((acc, load) => acc + load.util.associate + load.util.partner, 0),
        changes: loads.reduce((acc, load) => acc + load.util.changes, 0),
        due: MOCK_DUE,
    };
}

type MockContextValue = {
    rows: MockMemberRow[];
    selectedId: number | null;
    publish: (rows: MockMemberRow[]) => void;
    select: (id: number | null) => void;
};

const MockContext = createContext<MockContextValue | null>(null);

export function LegalHubMockProvider({ children }: { children: ReactNode }) {
    const [rows, setRows] = useState<MockMemberRow[]>([]);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const publish = useCallback((next: MockMemberRow[]) => {
        setRows(next);
        setSelectedId((current) => (current != null && next.some((row) => row.id === current) ? current : null));
    }, []);
    const select = useCallback((id: number | null) => {
        setSelectedId(id);
    }, []);
    const value = useMemo(() => ({ rows, selectedId, publish, select }), [rows, selectedId, publish, select]);
    return <MockContext.Provider value={value}>{children}</MockContext.Provider>;
}

export function useLegalHubMock(): MockContextValue {
    const value = useContext(MockContext);
    if (value == null)
        throw new Error('Legal Hub mock data is only available inside LegalHubMockProvider');
    return value;
}
