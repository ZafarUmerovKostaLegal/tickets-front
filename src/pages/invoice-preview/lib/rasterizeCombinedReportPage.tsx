import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import type { CombinedReportSnapshot } from '@pages/time-tracking/lib/combinedInvoice';
import { planCombinedReportPreviewPages } from './combinedReportPreviewPages';
import { CombinedReportPage } from '../ui/CombinedReportPage';

function inlineComputedStyle(source: Element, dest: HTMLElement): void {
    const computed = getComputedStyle(source);
    dest.style.cssText = computed.cssText || Array.from(computed).map((prop) => `${prop}:${computed.getPropertyValue(prop)};`).join('');
}

function cloneWithComputedStyles(source: HTMLElement): HTMLElement {
    const clone = source.cloneNode(true) as HTMLElement;
    const sources = [source, ...source.querySelectorAll('*')];
    const clones = [clone, ...clone.querySelectorAll('*')];
    sources.forEach((node, index) => {
        const dest = clones[index];
        if (dest instanceof HTMLElement)
            inlineComputedStyle(node, dest);
    });
    clone.style.transform = 'none';
    clone.style.position = 'relative';
    clone.style.left = '0';
    clone.style.top = '0';
    clone.style.margin = '0';
    return clone;
}

function rasterizeElement(el: HTMLElement): Promise<Uint8Array> {
    const width = Math.ceil(el.offsetWidth);
    const height = Math.ceil(el.offsetHeight);
    const clone = cloneWithComputedStyles(el);
    clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
    clone.style.width = `${width}px`;
    clone.style.height = `${height}px`;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    const foreign = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    foreign.setAttribute('x', '0');
    foreign.setAttribute('y', '0');
    foreign.setAttribute('width', String(width));
    foreign.setAttribute('height', String(height));
    foreign.appendChild(clone);
    svg.appendChild(foreign);
    const xml = new XMLSerializer().serializeToString(svg);
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
            const scale = 2;
            const canvas = document.createElement('canvas');
            canvas.width = width * scale;
            canvas.height = height * scale;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('canvas'));
                return;
            }
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
            const probes = [[0.86, 0.045], [0.22, 0.16], [0.55, 0.24]];
            const painted = probes.some(([px, py]) => {
                const pixel = ctx.getImageData(Math.floor(canvas.width * px!), Math.floor(canvas.height * py!), 1, 1).data;
                return pixel[0]! < 248 || pixel[1]! < 248 || pixel[2]! < 248;
            });
            if (!painted) {
                reject(new Error('blank'));
                return;
            }
            canvas.toBlob(async (blob) => {
                if (!blob) {
                    reject(new Error('png'));
                    return;
                }
                resolve(new Uint8Array(await blob.arrayBuffer()));
            }, 'image/png');
        };
        image.onerror = () => {
            reject(new Error('svg'));
        };
        image.src = url;
    });
}

/** Paint each preview sheet off-screen and return a PNG of that exact page. */
export async function rasterizeCombinedReportPages(report: CombinedReportSnapshot): Promise<Uint8Array[]> {
    const slices = planCombinedReportPreviewPages(report);
    const host = document.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText = 'position:fixed;left:0;top:0;width:210mm;height:297mm;transform:translateX(-120%);pointer-events:none;z-index:-1;background:#fff;';
    document.body.appendChild(host);
    const root = createRoot(host);
    const pngs: Uint8Array[] = [];
    try {
        if (document.fonts?.ready)
            await document.fonts.ready;
        for (let index = 0; index < slices.length; index += 1) {
            flushSync(() => {
                root.render(
                    <div className="tt-inv-preview" style={{ width: '210mm', height: '297mm', overflow: 'hidden', background: '#fff' }}>
                        <div
                            className="tt-inv-a4-page tt-inv-a4-page--timerpt tt-inv-a4-page--creport"
                            style={{
                                width: '210mm',
                                height: '297mm',
                                maxWidth: 'none',
                                minHeight: '297mm',
                                maxHeight: '297mm',
                                margin: 0,
                                border: '0',
                                boxShadow: 'none',
                                borderRadius: 0,
                            }}
                        >
                            <CombinedReportPage report={report} pageIndex={index} pageNumber={index + 2} />
                        </div>
                    </div>,
                );
            });
            await new Promise<void>((resolve) => {
                requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
            });
            const page = host.querySelector('.tt-inv-a4-page');
            if (!(page instanceof HTMLElement))
                throw new Error('sheet');
            pngs.push(await rasterizeElement(page));
        }
    }
    finally {
        root.unmount();
        host.remove();
    }
    return pngs;
}
