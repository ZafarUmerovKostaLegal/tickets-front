export function downloadBlob(blob: Blob, filename: string): void {
    const safeName = filename.trim() || 'download.bin';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = safeName;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    window.setTimeout(() => {
        a.remove();
        URL.revokeObjectURL(url);
    }, 250);
}
