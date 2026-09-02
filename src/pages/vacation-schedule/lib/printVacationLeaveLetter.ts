import letterCss from '../ui/VacationLeaveApplicationLetter.css?raw';

/** Prints only the leave letter, without the app page title or URL in browser headers. */
export function printVacationLeaveLetter(letter: HTMLElement): void {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.setAttribute('title', '');
    iframe.style.cssText = [
        'position:fixed',
        'left:-10000px',
        'top:0',
        'width:210mm',
        'height:297mm',
        'border:0',
        'background:#fff',
    ].join(';');
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument;
    const win = iframe.contentWindow;
    if (!doc || !win) {
        iframe.remove();
        return;
    }

    doc.open();
    doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title></title>
<style>
${letterCss}
@page { size: A4; margin: 0; }
html, body {
  margin: 0;
  padding: 0;
  background: #fff;
  color: #000;
}
.vac-leave-letter {
  border: none !important;
  width: 100% !important;
  min-height: auto !important;
}
</style></head><body>${letter.outerHTML}</body></html>`);
    doc.close();

    let cleaned = false;
    const cleanup = () => {
        if (cleaned)
            return;
        cleaned = true;
        iframe.remove();
    };
    win.addEventListener('afterprint', () => {
        window.setTimeout(cleanup, 300);
    });
    window.setTimeout(() => {
        win.focus();
        win.print();
    }, 200);
}
