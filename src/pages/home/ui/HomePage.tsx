import { HomeProvider } from '../model/HomeContext';
import { HomePageView } from './HomePageView';

export function HomePage() {
    return (<HomeProvider>
      <HomePageView />
    </HomeProvider>);
}
