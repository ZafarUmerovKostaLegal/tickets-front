import { useEffect, useState } from 'react';
import { HomeNavTiles } from './HomeNavTiles';
import { HomeHubTopBar } from './HomeHubTopBar';
import { HomeHubGreeting } from './HomeHubGreeting';
import './HomePage.css';

export function HomePageHub() {
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey)
                return;
            const target = event.target;
            if (
                target instanceof HTMLElement
                && (target.isContentEditable
                    || target.tagName === 'INPUT'
                    || target.tagName === 'TEXTAREA'
                    || target.tagName === 'SELECT')
            ) {
                return;
            }
            event.preventDefault();
            const input = document.querySelector<HTMLInputElement>('.home-hub-topbar__search-input');
            input?.focus();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    return (
        <div className="home-page home-page--tile-nav home-page--hub">
            <HomeHubTopBar searchQuery={searchQuery} onSearchChange={setSearchQuery} />
            <main className="home-page__main home-page__main--hub">
                <div className="home-page__main-inner home-page__main-inner--hub">
                    <HomeHubGreeting />
                    <HomeNavTiles searchQuery={searchQuery} />
                </div>
            </main>
        </div>
    );
}
