import { jsx as _jsx } from "react/jsx-runtime";
import { HomeProvider } from '@pages/home/model/HomeContext';
import { HomePageView } from '@pages/home/ui/HomePageView';
export function TicketsPage() {
    return (_jsx(HomeProvider, { children: _jsx(HomePageView, {}) }));
}
