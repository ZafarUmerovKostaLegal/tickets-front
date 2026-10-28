export function isTauriAndroidBuild() {
    return import.meta.env.TAURI_ENV_PLATFORM === 'android';
}
export function isTauriIosBuild() {
    return import.meta.env.TAURI_ENV_PLATFORM === 'ios';
}
export function isTauriMobileBuild() {
    return isTauriAndroidBuild() || isTauriIosBuild();
}
