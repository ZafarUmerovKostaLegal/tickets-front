/** Sets textarea height from content; optional ceiling then vertical scroll. Width unchanged — pair with CSS `resize: none` + `overflow-x: hidden` for vertical-only growth. */
export function syncTextareaHeightToContent(el: HTMLTextAreaElement | null, maxHeightPx?: number): void {
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
