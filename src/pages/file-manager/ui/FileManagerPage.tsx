import { useState } from 'react';
import { AppBackButton, AppHomeLogo, AppPageSettings } from '@shared/ui';
import { useI18n } from '@shared/i18n';
import type { TranslationKey } from '@shared/i18n/translate';
import './FileManagerPage.css';

type PageId =
    | 'all'
    | 'explorer'
    | 'mine'
    | 'shared'
    | 'available'
    | 'recent'
    | 'starred'
    | 'trash'
    | 'users'
    | 'access'
    | 'matrix'
    | 'journal'
    | 'monitoring'
    | 'storages'
    | 'directory'
    | 'settings';

type NavItem = {
    id: PageId;
    label: TranslationKey;
    icon: 'home' | 'compass' | 'user' | 'share' | 'inbox' | 'clock' | 'star' | 'trash' | 'users' | 'shield' | 'grid' | 'list' | 'pulse' | 'server' | 'directory' | 'gear';
    badge?: string;
    badgeTone?: 'muted' | 'alert';
};

const FILES: NavItem[] = [
    { id: 'all', label: 'fileManager.all', icon: 'home' },
    { id: 'explorer', label: 'fileManager.explorer', icon: 'compass' },
    { id: 'mine', label: 'fileManager.mine', icon: 'user' },
    { id: 'shared', label: 'fileManager.shared', icon: 'share' },
    { id: 'available', label: 'fileManager.available', icon: 'inbox', badge: '4', badgeTone: 'muted' },
    { id: 'recent', label: 'fileManager.recent', icon: 'clock' },
    { id: 'starred', label: 'fileManager.starred', icon: 'star' },
    { id: 'trash', label: 'fileManager.trash', icon: 'trash' },
];

const ADMIN: NavItem[] = [
    { id: 'users', label: 'fileManager.users', icon: 'users' },
    { id: 'access', label: 'fileManager.access', icon: 'shield', badge: '3', badgeTone: 'alert' },
    { id: 'matrix', label: 'fileManager.matrix', icon: 'grid' },
    { id: 'journal', label: 'fileManager.journal', icon: 'list' },
    { id: 'monitoring', label: 'fileManager.monitoring', icon: 'pulse', badge: '2', badgeTone: 'alert' },
    { id: 'storages', label: 'fileManager.storages', icon: 'server' },
    { id: 'directory', label: 'fileManager.directory', icon: 'directory' },
    { id: 'settings', label: 'fileManager.settings', icon: 'gear' },
];

function NavIcon({ name }: { name: NavItem['icon'] }) {
    const common = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
    if (name === 'home')
        return <svg {...common}><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" /></svg>;
    if (name === 'compass')
        return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5z" /></svg>;
    if (name === 'user')
        return <svg {...common}><circle cx="12" cy="8" r="3" /><path d="M5 19a7 7 0 0 1 14 0" /></svg>;
    if (name === 'share')
        return <svg {...common}><path d="M4 7h10a2 2 0 0 1 2 2v2" /><path d="M14 4l4 3.5L14 11" /><path d="M20 17H10a2 2 0 0 1-2-2v-2" /><path d="M10 20l-4-3.5L10 13" /></svg>;
    if (name === 'inbox')
        return <svg {...common}><path d="M3 13h5l2 3h4l2-3h5v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" /><path d="M4 13 6 5h12l2 8" /></svg>;
    if (name === 'clock')
        return <svg {...common}><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></svg>;
    if (name === 'star')
        return <svg {...common}><path d="m12 4 2.1 4.4 4.9.6-3.6 3.3.9 4.8L12 15.8 7.7 17.1l.9-4.8L5 9l4.9-.6z" /></svg>;
    if (name === 'trash')
        return <svg {...common}><path d="M5 8h14" /><path d="M9 8V6h6v2" /><path d="M7 8l1 12h8l1-12" /></svg>;
    if (name === 'users')
        return <svg {...common}><circle cx="9" cy="9" r="2.5" /><circle cx="16" cy="10" r="2" /><path d="M4.5 18a4.5 4.5 0 0 1 9 0" /><path d="M14 18a3.5 3.5 0 0 1 6 0" /></svg>;
    if (name === 'shield')
        return <svg {...common}><path d="M12 3 5 6v6c0 4 3 6.5 7 8 4-1.5 7-4 7-8V6z" /></svg>;
    if (name === 'grid')
        return <svg {...common}><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></svg>;
    if (name === 'list')
        return <svg {...common}><path d="M8 7h12M8 12h12M8 17h12" /><path d="M4 7h.01M4 12h.01M4 17h.01" /></svg>;
    if (name === 'pulse')
        return <svg {...common}><path d="M3 12h4l2-5 4 10 2-5h6" /></svg>;
    if (name === 'server')
        return <svg {...common}><rect x="4" y="4" width="16" height="6" rx="1.5" /><rect x="4" y="14" width="16" height="6" rx="1.5" /><path d="M8 7h.01M8 17h.01" /></svg>;
    if (name === 'directory')
        return <svg {...common}><circle cx="8" cy="8" r="2" /><circle cx="16" cy="8" r="2" /><circle cx="12" cy="16" r="2" /><path d="M9.5 9.5 11 14M14.5 9.5 13 14M10 8h4" /></svg>;
    return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" /></svg>;
}

function SideLink({ item, active, onSelect }: { item: NavItem; active: boolean; onSelect: (id: PageId) => void }) {
    const { t } = useI18n();
    return (
        <button type="button" className={active ? 'is-on' : ''} aria-current={active ? 'page' : undefined} onClick={() => onSelect(item.id)}>
            <NavIcon name={item.icon} />
            <span>{t(item.label)}</span>
            {item.badge ? <em className={item.badgeTone === 'alert' ? 'is-alert' : ''}>{item.badge}</em> : null}
        </button>
    );
}

export function FileManagerPage() {
    const { t } = useI18n();
    const [page, setPage] = useState<PageId>('all');

    return (
        <div className="fm">
            <aside className="fm-side">
                <button type="button" className="fm-side__create">+ {t('fileManager.createUpload')}</button>
                <p>{t('fileManager.files')}</p>
                <nav aria-label={t('fileManager.files')}>
                    {FILES.map((item) => <SideLink key={item.id} item={item} active={page === item.id} onSelect={setPage} />)}
                </nav>
                <p>{t('fileManager.admin')}</p>
                <nav aria-label={t('fileManager.admin')}>
                    {ADMIN.map((item) => <SideLink key={item.id} item={item} active={page === item.id} onSelect={setPage} />)}
                </nav>
                <div className="fm-side__storage">
                    <div>
                        <strong>{t('fileManager.storageCount')}</strong>
                        <span>1,8 {t('fileManager.of')} 5 {t('fileManager.tb')}</span>
                    </div>
                    <i aria-hidden><b /></i>
                    <small>{t('fileManager.storageWarn')}</small>
                </div>
            </aside>
            <div className="fm__main">
                <header className="fm__head">
                    <div className="fm__head-start">
                        <AppBackButton />
                        <AppHomeLogo withSeparator />
                    </div>
                    <AppPageSettings />
                </header>
            </div>
        </div>
    );
}
