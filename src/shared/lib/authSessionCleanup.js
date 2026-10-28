import { clearAllTimesheetTimerLocalStorageKeys } from './ttTimerLocalStorage';
export function clearClientSessionSecrets() {
    try {
        sessionStorage.clear();
    }
    catch {
    }
    clearAllTimesheetTimerLocalStorageKeys();
}
