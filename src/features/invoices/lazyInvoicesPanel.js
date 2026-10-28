import { lazy } from 'react';
export const LazyInvoicesPanel = lazy(() => import('@pages/time-tracking/ui/InvoicesPanel').then((m) => ({ default: m.InvoicesPanel })));
