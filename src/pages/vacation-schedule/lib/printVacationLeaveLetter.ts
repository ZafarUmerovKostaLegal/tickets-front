/** Prints only the leave letter, without the app page title or URL in browser headers. */
export function printVacationLeaveLetter(letter: HTMLElement): void {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.setAttribute('title', '');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument;
    const win = iframe.contentWindow;
    if (!doc || !win) {
        iframe.remove();
        window.print();
        return;
    }
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
        .map((node) => node.outerHTML)
        .join('\n');
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title></title>${styles}
<style>
@page { size: A4; margin: 0; }
html, body { margin: 0; padding: 0; background: #fff; }
.vac-leave-letter {
  border: none !important;
  width: 100% !important;
  min-height: auto !important;
  box-shadow: none !important;
}
</style></head><body>${letter.outerHTML}</body></html>`);
    doc.close();
    const cleanup = () => {
        iframe.remove();
    };
    win.addEventListener('afterprint', cleanup);
    window.setTimeout(() => {
        win.focus();
        win.print();
        window.setTimeout(cleanup, 60_000);
    }, 50);
}
