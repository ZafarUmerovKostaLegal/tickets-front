export function syncTextareaHeightToContent(el, maxHeightPx) {
    if (!el)
        return;
    el.style.height = 'auto';
    const sh = el.scrollHeight;
    if (maxHeightPx != null && sh > maxHeightPx) {
        el.style.height = `${maxHeightPx}px`;
        el.style.overflowY = 'auto';
    }
    else {
        el.style.height = `${sh}px`;
        el.style.overflowY = 'hidden';
    }
}
