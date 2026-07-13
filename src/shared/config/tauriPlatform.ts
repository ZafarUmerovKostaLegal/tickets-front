
export function isTauriAndroidBuild(): boolean {
    return import.meta.env.TAURI_ENV_PLATFORM === 'android';
}

export function isTauriIosBuild(): boolean {
    return import.meta.env.TAURI_ENV_PLATFORM === 'ios';
}

export function isTauriMobileBuild(): boolean {
    return isTauriAndroidBuild() || isTauriIosBuild();
}
