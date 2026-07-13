import { useLocation } from 'react-router-dom';
import { routes } from '@shared/config';
import { HomePageHub } from './HomePageHub';
import { KostaLegalAiPage } from './KostaLegalAiPage';

export function HomePage() {
    const { pathname } = useLocation();
    if (pathname === routes.kostaLegalAi)
        return <KostaLegalAiPage />;
    return <HomePageHub />;
}
