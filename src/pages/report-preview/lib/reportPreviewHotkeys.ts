/** Primary modifier: Ctrl on Windows/Linux, ⌘ on macOS. */
export function isPrimaryModifierPressed(e: Pick<KeyboardEvent, 'ctrlKey' | 'metaKey'>): boolean {
    return Boolean(e.metaKey || e.ctrlKey);
}

export function isApplePlatform(): boolean {
    if (typeof navigator === 'undefined')
        return false;
    const platform = String(navigator.platform || '');
    const ua = String(navigator.userAgent || '');
    return /Mac|iPhone|iPad|iPod/i.test(platform) || /Mac OS X/i.test(ua);
}

/** Label for shortcuts in UI: ⌘Z / Ctrl+Z */
export function primaryModLabel(): '⌘' | 'Ctrl' {
    return isApplePlatform() ? '⌘' : 'Ctrl';
}

export function formatPrimaryShortcut(...keys: string[]): string {
    const mod = primaryModLabel();
    const joined = keys.map((k) => k.toUpperCase()).join('+');
    return mod === '⌘' ? `⌘${joined}` : `Ctrl+${joined}`;
}

export function isEditableKeyboardTarget(target: EventTarget | null): boolean {
    if (!target || typeof target !== 'object')
        return false;
    const el = target as HTMLElement;
    const tag = typeof el.tagName === 'string' ? el.tagName.toUpperCase() : '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT')
        return true;
    if (el.isContentEditable)
        return true;
    if (typeof el.closest === 'function')
        return Boolean(el.closest('input, textarea, select, [contenteditable="true"]'));
    return false;
}

export type ReportPreviewHotkeyAction = 'undo' | 'save' | 'duplicate';

/**
 * Resolves preview hotkeys. Returns null when the event should be left to the browser.
 * Duplicate is skipped while typing in editable fields; undo/save still apply.
 */
export function resolveReportPreviewHotkey(
    e: KeyboardEvent,
    opts?: { allowWhileEditing?: boolean },
): ReportPreviewHotkeyAction | null {
    if (!isPrimaryModifierPressed(e) || e.altKey)
        return null;
    const key = e.key.toLowerCase();
    const editing = isEditableKeyboardTarget(e.target);
    if (key === 'z' && !e.shiftKey) {
        if (editing && opts?.allowWhileEditing === false)
            return null;
        return 'undo';
    }
    if (key === 's')
        return 'save';
    if (key === 'd' && !e.shiftKey) {
        if (editing)
            return null;
        return 'duplicate';
    }
    return null;
}
