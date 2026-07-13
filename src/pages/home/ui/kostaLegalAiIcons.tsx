import type { ReactNode, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const base = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
};

function Icon({ children, ...props }: IconProps & { children: ReactNode }) {
    return (
        <svg {...base} {...props}>
            {children}
        </svg>
    );
}


export function KlAiIconSpellCheck(props: IconProps) {
    return (
        <Icon {...props}>
            <path d="M4 20h16" />
            <path d="m6 16 6-12 6 12" />
            <path d="M8 12h8" />
        </Icon>
    );
}


export function KlAiIconScale(props: IconProps) {
    return (
        <Icon {...props}>
            <path d="M12 3v18" />
            <path d="M5 21h14" />
            <path d="M3 7h18" />
            <path d="M6 7 4 14h4l2-7Z" />
            <path d="M18 7l2 7h-4l2-7Z" />
        </Icon>
    );
}


export function KlAiIconMegaphone(props: IconProps) {
    return (
        <Icon {...props}>
            <path d="m3 11 18-5v12L3 14v-3Z" />
            <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
        </Icon>
    );
}


export function KlAiIconScanText(props: IconProps) {
    return (
        <Icon {...props}>
            <path d="M3 7V5a2 2 0 0 1 2-2h2" />
            <path d="M17 3h2a2 2 0 0 1 2 2v2" />
            <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
            <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
            <path d="M7 8h8" />
            <path d="M7 12h10" />
            <path d="M7 16h6" />
        </Icon>
    );
}


export function KlAiIconMessageReply(props: IconProps) {
    return (
        <Icon {...props}>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            <path d="m10 7-3 3 3 3" />
            <path d="M7 10h7" />
        </Icon>
    );
}


export function KlAiIconFileSearch(props: IconProps) {
    return (
        <Icon {...props}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
            <circle cx="11.5" cy="14.5" r="2.5" />
            <path d="m13.5 16.5 2 2" />
        </Icon>
    );
}


export function KlAiIconPenLine(props: IconProps) {
    return (
        <Icon {...props}>
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </Icon>
    );
}


export function KlAiIconLayoutTemplate(props: IconProps) {
    return (
        <Icon {...props}>
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18" />
            <path d="M9 21V9" />
        </Icon>
    );
}

export function KlAiIconGrid(props: IconProps) {
    return (
        <Icon {...props}>
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </Icon>
    );
}

export function KlAiIconMore(props: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
            <circle cx="12" cy="5" r="1.75" />
            <circle cx="12" cy="12" r="1.75" />
            <circle cx="12" cy="19" r="1.75" />
        </svg>
    );
}

export function KlAiIconSeal(props: IconProps) {
    return (
        <Icon strokeWidth={1.6} {...props}>
            <path d="M12 2 4 6v6c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V6l-8-4z" />
            <path d="m9 12 2 2 4-4" />
        </Icon>
    );
}

export function KlAiIconHelp(props: IconProps) {
    return (
        <Icon {...props}>
            <circle cx="12" cy="12" r="9" />
            <path d="M9.5 9a2.5 2.5 0 0 1 4.9.8c0 1.7-2.4 1.7-2.4 3.4" />
            <path d="M12 17h.01" />
        </Icon>
    );
}
