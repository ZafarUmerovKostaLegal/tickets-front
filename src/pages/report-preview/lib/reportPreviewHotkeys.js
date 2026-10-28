export function isPrimaryModifierPressed(e) {
    return Boolean(e.metaKey || e.ctrlKey);
}
export function isApplePlatform() {
    if (typeof navigator === 'undefined')
        return false;
    const platform = String(navigator.platform || '');
    const ua = String(navigator.userAgent || '');
    return /Mac|iPhone|iPad|iPod/i.test(platform) || /Mac OS X/i.test(ua);
}
/** Label for shortcuts in UI: ⌘Z / Ctrl+Z */
export function primaryModLabel() {
    return isApplePlatform() ? '⌘' : 'Ctrl';
}
export function formatPrimaryShortcut(...keys) {
    const mod = primaryModLabel();
    const joined = keys.map((k) => k.toUpperCase()).join('+');
    return mod === '⌘' ? `⌘${joined}` : `Ctrl+${joined}`;
}
export function isEditableKeyboardTarget(target) {
    if (!target || typeof target !== 'object')
        return false;
    const el = target;
    const tag = typeof el.tagName === 'string' ? el.tagName.toUpperCase() : '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT')
        return true;
    if (el.isContentEditable)
        return true;
    if (typeof el.closest === 'function')
        return Boolean(el.closest('input, textarea, select, [contenteditable="true"]'));
    return false;
}
export function resolveReportPreviewHotkey(e, opts) {
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
