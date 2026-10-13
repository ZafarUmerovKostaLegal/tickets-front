import { useEffect, useMemo, useState } from 'react';
import { equipmentQrCodes, equipmentQrPublicUrl } from '@entities/inventory';
import { AppBackButton } from '@shared/ui';
import { equipmentQrSvg } from './equipmentQrSvg';
import './InventoryQrSheet.css';

const CODES = equipmentQrCodes();
const PER_PAGE = 24;

export function InventoryQrSheetPage({ embedded = false }: { embedded?: boolean }) {
    const [readyCount, setReadyCount] = useState(0);
    const [svgs, setSvgs] = useState<Record<string, string>>({});
    const [failed, setFailed] = useState(false);
    const pages = useMemo(() => {
        const chunks: string[][] = [];
        for (let i = 0; i < CODES.length; i += PER_PAGE)
            chunks.push(CODES.slice(i, i + PER_PAGE));
        return chunks;
    }, []);

    useEffect(() => {
        let live = true;
        let index = 0;
        let timer = 0;
        const next: Record<string, string> = {};
        const step = () => {
            if (!live)
                return;
            const end = Math.min(index + PER_PAGE, CODES.length);
            try {
                for (; index < end; index += 1)
                    next[CODES[index]] = equipmentQrSvg(equipmentQrPublicUrl(CODES[index]));
            }
            catch {
                setFailed(true);
                return;
            }
            setSvgs({ ...next });
            setReadyCount(index);
            if (index < CODES.length)
                timer = window.setTimeout(step, 0);
        };
        const frame = window.requestAnimationFrame(step);
        return () => {
            live = false;
            window.cancelAnimationFrame(frame);
            window.clearTimeout(timer);
        };
    }, []);

    return (
        <div className="inv-qr">
            <div className="inv-qr__toolbar">
                {embedded ? null : <AppBackButton className="app-back-btn" />}
                <div>
                    <h1>QR для техники</h1>
                    <p>24 наклейки 4×4 см на лист A4. В окне печати: масштаб 100%, поля «Нет».</p>
                </div>
                <button type="button" onClick={() => window.print()} disabled={readyCount < CODES.length}>
                    {readyCount < CODES.length ? `Готово ${readyCount} из ${CODES.length}` : 'Печать'}
                </button>
            </div>
            {failed ? <p className="inv-qr__error">Не удалось собрать коды.</p> : null}
            <div className="inv-qr__pages">
                {pages.map((page) => (
                    <section key={page[0]} className="inv-qr__page">
                        {page.map((code) => (
                            <figure key={code} className="inv-qr__sticker">
                                {svgs[code]
                                    ? <div className="inv-qr__mark" dangerouslySetInnerHTML={{ __html: svgs[code] }} />
                                    : <div className="inv-qr__mark inv-qr__mark--wait" />}
                                <figcaption>{code}</figcaption>
                            </figure>
                        ))}
                    </section>
                ))}
            </div>
        </div>
    );
}
