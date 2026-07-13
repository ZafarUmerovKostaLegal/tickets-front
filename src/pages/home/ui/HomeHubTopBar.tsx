import { Link } from 'react-router-dom';
import { routes } from '@shared/config';
import { useI18n } from '@shared/i18n';
import { AppPageSettings } from '@shared/ui';
import { HeaderNotifications } from '@pages/home/ui/HeaderNotifications';
import './HomeHubTopBar.css';

type HomeHubTopBarProps = {
    searchQuery: string;
    onSearchChange: (value: string) => void;
};

function IconSearch() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
        </svg>
    );
}

export function HomeHubTopBar({ searchQuery, onSearchChange }: HomeHubTopBarProps) {
    const { t } = useI18n();

    return (
        <header className="home-hub-topbar">
            <div className="home-hub-topbar__inner">
                <Link
                    to={routes.home}
                    className="home-hub-topbar__brand"
                    aria-label={t('brand.homeAria')}
                >
                    <img
                        src="/KostaLegal-logo-02-black.svg"
                        alt="Kosta Legal"
                        className="home-hub-topbar__brand-logo"
                        width={439}
                        height={219}
                        draggable={false}
                    />
                </Link>

                <label className="home-hub-topbar__search">
                    <span className="home-hub-topbar__search-icon" aria-hidden>
                        <IconSearch />
                    </span>
                    <input
                        type="search"
                        className="home-hub-topbar__search-input"
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder={t('homeHub.searchPlaceholder')}
                        aria-label={t('homeHub.searchPlaceholder')}
                        autoComplete="off"
                        spellCheck={false}
                    />
                    <kbd className="home-hub-topbar__search-kbd" aria-hidden>/</kbd>
                </label>

                <div className="home-hub-topbar__actions">
                    <AppPageSettings showUserMenu beforeUserMenu={<HeaderNotifications />} />
                </div>
            </div>
        </header>
    );
}
