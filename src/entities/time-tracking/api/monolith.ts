/** Thin barrel — implementations live under ./domains. */
export * from './domains/httpShared';
export * from './domains/usersAndRates';
export * from './domains/timeEntries';
export * from './domains/clients';
export * from './domains/teamsAndLabor';
export * from './domains/projects';
export * from './domains/projectAccess';
export * from './domains/reports';
export * from './domains/partnerConfirmations';
export * from './domains/invoices';
export * from './domains/invoiceRegistry';

export { invalidateTimeTrackingListCache } from '../lib/timeTrackingListCache';
export { reportCacheInvalidateAll as invalidateReportApiCache } from '../lib/reportApiCache';
