import type { UserPersona } from '../fixtures/users';

export type RouteAccessExpectation = {
    path: string;
    persona: UserPersona;
    expectUrl: RegExp;
    tag?: string;
};

export const ROUTE_ACCESS_MATRIX: RouteAccessExpectation[] = [

    { path: '/home', persona: 'employee', expectUrl: /\/home$/ },
    { path: '/tickets', persona: 'employee', expectUrl: /\/tickets$/ },
    { path: '/todo', persona: 'employee', expectUrl: /\/todo$/ },
    { path: '/expenses', persona: 'employee', expectUrl: /\/expenses$/ },
    { path: '/time-tracking', persona: 'employee', expectUrl: /\/time-tracking/ },
    { path: '/vacation-schedule', persona: 'employee', expectUrl: /\/vacation-schedule$/ },
    { path: '/correspondence', persona: 'employee', expectUrl: /\/correspondence$/ },
    { path: '/kosta-daily', persona: 'employee', expectUrl: /\/kosta-daily$/ },
    { path: '/rules', persona: 'employee', expectUrl: /\/rules$/ },
    { path: '/help', persona: 'employee', expectUrl: /\/help$/ },
    { path: '/kosta-legal-ai', persona: 'employee', expectUrl: /\/kosta-legal-ai$/ },
    { path: '/expenses/exp-draft-1', persona: 'employee', expectUrl: /\/expenses\/exp-draft-1$/ },

    
    { path: '/admin', persona: 'employee', expectUrl: /\/home$/ },
    { path: '/attendance', persona: 'employee', expectUrl: /\/home$/ },
    { path: '/accounting', persona: 'employee', expectUrl: /\/home$/ },
    { path: '/contacts', persona: 'employee', expectUrl: /\/home$/ },
    { path: '/expenses/requests', persona: 'employee', expectUrl: /\/expenses/ },
    { path: '/expenses/report', persona: 'employee', expectUrl: /\/expenses/ },
    { path: '/admin/network-drive', persona: 'employee', expectUrl: /\/home$/ },

    
    { path: '/inventory', persona: 'employee', expectUrl: /\/inventory$/ },
    { path: '/call-schedule', persona: 'employee', expectUrl: /\/call-schedule$/ },
    { path: '/time-tracking/reports/preview', persona: 'employee', expectUrl: /\/time-tracking\/reports\/preview$/ },

    
    { path: '/time-tracking', persona: 'noTimeTracking', expectUrl: /\/home$/ },

    
    { path: '/admin', persona: 'admin', expectUrl: /\/admin$/ },
    { path: '/attendance', persona: 'admin', expectUrl: /\/attendance$/ },
    { path: '/accounting', persona: 'admin', expectUrl: /\/accounting$/ },
    { path: '/contacts', persona: 'admin', expectUrl: /\/contacts$/ },
    { path: '/inventory', persona: 'admin', expectUrl: /\/inventory$/ },
    { path: '/call-schedule', persona: 'admin', expectUrl: /\/call-schedule$/ },
    { path: '/expenses/requests', persona: 'admin', expectUrl: /\/expenses\/requests$/ },
    { path: '/expenses/report', persona: 'admin', expectUrl: /\/expenses\/report$/ },
    { path: '/admin/user/1', persona: 'admin', expectUrl: /\/admin\/user\/1$/ },

    
    { path: '/admin', persona: 'partner', expectUrl: /\/admin$/ },
    { path: '/attendance', persona: 'partner', expectUrl: /\/attendance$/ },
    { path: '/accounting', persona: 'partner', expectUrl: /\/home$/ },
    { path: '/contacts', persona: 'partner', expectUrl: /\/home$/ },

    
    { path: '/time-tracking/projects/new', persona: 'manager', expectUrl: /\/time-tracking\/projects\/new$/ },
    { path: '/time-tracking/reports/preview', persona: 'manager', expectUrl: /\/time-tracking\/reports\/preview$/ },
    { path: '/time-tracking/invoices/preview', persona: 'manager', expectUrl: /\/time-tracking\/invoices\/preview$/ },
    { path: '/time-tracking/project/demo-project?client=client-1', persona: 'manager', expectUrl: /\/time-tracking\/project\/demo-project/ },
];

export const ALL_APP_PATHS = [
    '/',
    '/auth/callback',
    '/home',
    '/tickets',
    '/ticket/test-uuid',
    '/todo',
    '/expenses',
    '/expenses/requests',
    '/expenses/report',
    '/time-tracking',
    '/time-tracking/projects/new',
    '/time-tracking/reports/preview',
    '/time-tracking/invoices/preview',
    '/time-tracking/project/demo-project',
    '/vacation-schedule',
    '/correspondence',
    '/kosta-daily',
    '/kosta-legal-ai',
    '/rules',
    '/help',
    '/admin',
    '/admin/user/1',
    '/admin/network-drive',
    '/attendance',
    '/inventory',
    '/call-schedule',
    '/accounting',
    '/contacts',
] as const;
