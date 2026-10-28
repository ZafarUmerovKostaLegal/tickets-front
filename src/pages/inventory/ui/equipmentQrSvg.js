import QRCode from 'qrcode';
const createQr = QRCode.create;
/** Vector sticker mark. Quiet zone is included so phones can scan a 4 cm print. */
export function equipmentQrSvg(text) {
    const qr = createQr(text, { errorCorrectionLevel: 'M' });
    const size = qr.modules.size;
    const quiet = 4;
    const dim = size + quiet * 2;
    let path = '';
    for (let row = 0; row < size; row += 1) {
        for (let col = 0; col < size; col += 1) {
            if (!qr.modules.get(row, col))
                continue;
            const x = col + quiet;
            const y = row + quiet;
            path += `M${x} ${y}h1v1h-1z`;
        }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges"><path fill="#0f172a" d="${path}"/></svg>`;
}
