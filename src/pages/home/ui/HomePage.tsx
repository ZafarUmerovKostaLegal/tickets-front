import { HomeProvider } from '../model/HomeContext';
import { HomePageView } from './HomePageView';
import { HomePageHub } from './HomePageHub';


export const HOME_HUB_ONLY = true;

function HomePageWithTickets() {
    return (<HomeProvider>
      <HomePageView />
    </HomeProvider>);
}

export function HomePage() {
    if (HOME_HUB_ONLY) {
        return <HomePageHub />;
    }
    return <HomePageWithTickets />;
}
