import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { equipmentQrCodes, equipmentQrPublicUrl } from '@entities/inventory';
import { AppBackButton } from '@shared/ui';
import './InventoryQrSheet.css';

type Sticker = { code: string; src: string };

export function InventoryQrSheetPage({ embedded = false }: { embedded?: boolean }) {
    const [stickers, setStickers] = useState<Sticker[]>([]);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let live = true;
        const codes = equipmentQrCodes();
        void (async () => {
            const next: Sticker[] = [];
            try {
                for (let i = 0; i < codes.length; i += 25) {
                    const batch = await Promise.all(codes.slice(i, i + 25).map(async (code) => ({
                        code,
                        src: await QRCode.toDataURL(equipmentQrPublicUrl(code), {
                            errorCorrectionLevel: 'H',
                            margin: 4,
                            width: 320,
                            color: { dark: '#0f172a', light: '#ffffff' },
                        }),
                    })));
                    next.push(...batch);
                    if (live)
                        setStickers([...next]);
                }
            }
            catch {
                if (live)
                    setFailed(true);
            }
        })();
        return () => {
            live = false;
        };
    }, []);

    return (
        <div className="inv-qr">
            <div className="inv-qr__toolbar">
                {embedded ? null : <AppBackButton className="app-back-btn" />}
                <div>
                    <h1>QR для техники</h1>
                    <p>500 кодов KL-EQ-0001 — KL-EQ-0500, наклейка 4×4 см. Печатайте со масштабом 100%.</p>
                </div>
                <button type="button" onClick={() => window.print()} disabled={stickers.length < 500}>
                    {stickers.length < 500 ? `Готово ${stickers.length} из 500` : 'Печать'}
                </button>
            </div>
            {failed ? <p className="inv-qr__error">Не удалось собрать коды.</p> : null}
            <div className="inv-qr__sheet">
                {stickers.map((sticker) => (
                    <figure key={sticker.code} className="inv-qr__sticker">
                        <img src={sticker.src} alt="" />
                        <figcaption>{sticker.code}</figcaption>
                    </figure>
                ))}
            </div>
        </div>
    );
}
