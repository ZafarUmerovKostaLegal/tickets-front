import { HomeProvider } from '@pages/home/model/HomeContext';
import { HomePageView } from '@pages/home/ui/HomePageView';

export function TicketsPage() {
    return (<HomeProvider>
      <HomePageView />
    </HomeProvider>);
}
