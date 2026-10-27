import type { ReactNode } from 'react';
import type { JournalChannelFilter } from '../model/journalView';
import type { JournalKind } from '../model/journalDemo';

type IconName = JournalKind | 'unlock' | JournalChannelFilter | 'search' | 'download' | 'file' | 'shield' | 'users' | 'settings';

const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
};

export function JournalIcon({ name }: { name: IconName }) {
    const paths: Record<IconName, ReactNode> = {
        send: <path d="M7 17 17 7M9 7h8v8" />,
        clip: <path d="M9 4h6v3H9zM7 5H5v15h14V5h-2" />,
        copy: <path d="M9 9h10v10H9zM5 15V5h10" />,
        edit: <path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" />,
        new: <path d="M12 5v14M5 12h14" />,
        open: <path d="M3 5h18v11H3zM8 20h8M12 16v4" />,
        access: <path d="M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3" />,
        unlock: <path d="M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 6.8-1.2" />,
        all: <path d="M4 6h16M4 12h16M4 18h16" />,
        telegram: <path d="M21 4 3 11l6 2 2 6 3-4 5 3z" />,
        browser: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" />,
        net: <path d="M3 5h18v11H3zM8 20h8M12 16v4" />,
        fs: <path d="M3 6h7l2 2h9v11H3z" />,
        search: <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4" />,
        download: <path d="M12 4v11M7.5 11 12 15.5 16.5 11M5 20h14" />,
        file: <path d="M7 3h7l4 4v14H7zM14 3v4h4" />,
        shield: <path d="M12 3 5 6v6c0 4.2 2.8 7.4 7 8.5 4.2-1.1 7-4.3 7-8.5V6l-7-3zM9 12l2 2 4-4" />,
        users: <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />,
        settings: <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />,
    };
    return (
        <svg {...common}>
            {paths[name]}
        </svg>
    );
}

export function StatusGlyph({ status }: { status: 'blocked' | 'allowed' | 'logged' }) {
    if (status === 'blocked') {
        return (
            <svg {...common}>
                <circle cx="12" cy="12" r="9" />
                <path d="M6 6l12 12" />
            </svg>
        );
    }
    if (status === 'allowed') {
        return (
            <svg {...common}>
                <circle cx="12" cy="12" r="9" />
                <path d="m8.5 12.5 3 3 5-6" />
            </svg>
        );
    }
    return (
        <svg {...common}>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v4.5M12 16h.01" />
        </svg>
    );
}
