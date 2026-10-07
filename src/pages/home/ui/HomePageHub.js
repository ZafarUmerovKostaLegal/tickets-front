import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { HomeNavTiles } from './HomeNavTiles';
import { HomeHubTopBar } from './HomeHubTopBar';
import { HomeHubGreeting } from './HomeHubGreeting';
import './HomePage.css';
export function HomePageHub() {
    const [searchQuery, setSearchQuery] = useState('');
    useEffect(() => {
        // Modals elsewhere may leave body overflow locked; hub must always scroll.
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
    }, []);
    useEffect(() => {
        const onKeyDown = (event) => {
            if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey)
                return;
            const target = event.target;
            if (target instanceof HTMLElement
                && (target.isContentEditable
                    || target.tagName === 'INPUT'
                    || target.tagName === 'TEXTAREA'
                    || target.tagName === 'SELECT')) {
                return;
            }
            event.preventDefault();
            const input = document.querySelector('.home-hub-topbar__search-input');
            input?.focus();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);
    return (_jsxs("div", { className: "home-page home-page--tile-nav home-page--hub", children: [_jsx(HomeHubTopBar, { searchQuery: searchQuery, onSearchChange: setSearchQuery }), _jsx("main", { className: "home-page__main home-page__main--hub", children: _jsxs("div", { className: "home-page__main-inner home-page__main-inner--hub", children: [_jsx(HomeHubGreeting, {}), _jsx(HomeNavTiles, { searchQuery: searchQuery })] }) })] }));
}
