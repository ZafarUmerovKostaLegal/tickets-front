import { lazy } from 'react';

export type { InvoicesPanelProps } from '@pages/time-tracking/ui/InvoicesPanel';

export const LazyInvoicesPanel = lazy(() =>
    import('@pages/time-tracking/ui/InvoicesPanel').then((m) => ({ default: m.InvoicesPanel })),
);
