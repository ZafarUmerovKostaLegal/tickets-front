import { clearAllTimesheetTimerLocalStorageKeys } from './ttTimerLocalStorage';
export function clearClientSessionSecrets(): void {
    try {
        sessionStorage.clear();
    }
    catch {
    }
    clearAllTimesheetTimerLocalStorageKeys();
}
