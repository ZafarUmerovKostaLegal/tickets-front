function esc(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

const ADDRESS_RU = 'Узбекистан, г. Ташкент, 100011, улица Анхор буйи, 18';
const ADDRESS_EN = '18 Anhor Buyi Street, 100011, Tashkent, Uzbekistan';
const PHONES = 'Tel.: (998 71) 209 0240\u00a0\u00a0\u00a0Fax.: (998 71) 209 0241';
const SITE = 'https://www.kostalegal.com';

const DISCLAIMER_EN = 'This e-mail and any attached documents hereto are intended solely for the named addressee(s), are strictly confidential, and may also be legally privileged. If you are not the intended addressee(s) of this e-mail, please notify the sender immediately by reply e-mail and then delete this message completely from your system. Please do not read, copy, print, forward, or store this e-mail or any of its attached documents. Any unauthorized disclosure or other use of the information contained in this e-mail for any purposes is strictly forbidden and is subject to legal prosecution. Thank you for your cooperation.';

const DISCLAIMER_RU = 'Данное электронное сообщение и любые приложения к нему предназначены только указанному(ым) получателю(ям), строго конфиденциальны и являются предметом адвокатской тайны. Если Вы не являетесь адресатом этого электронного сообщения, пожалуйста, незамедлительно уведомите об этом отправителя ответным электронным сообщением, а затем полностью удалите настоящее сообщение из системы. Пожалуйста, не читайте, не копируйте, не распечатывайте, не переправляйте и не сохраняйте настоящее сообщение или любые его приложения. Любое несанкционированное раскрытие или иное использование информации, содержащейся в настоящем сообщении в любых целях строго запрещено и преследуется по закону. Спасибо за Ваше сотрудничество.';

export function invoiceClientMailSignature(input: {
    name: string;
    position?: string | null;
    logoUrl?: string | null;
    /** When true, the PNG is attached to the Outlook draft as cid:kosta-legal-logo. */
    embedLogo?: boolean;
}): { html: string; text: string } {
    const name = (input.name || 'Kosta Legal').trim() || 'Kosta Legal';
    const position = (input.position || '').trim();
    const logoUrl = (input.logoUrl || '').trim();
    const logo = input.embedLogo
        ? '<img src="cid:kosta-legal-logo" alt="Kosta Legal" width="210" style="display:block;border:0;outline:none;text-decoration:none;" />'
        : logoUrl
            ? `<img src="${esc(logoUrl)}" alt="Kosta Legal" width="72" style="display:block;border:0;outline:none;text-decoration:none;" />`
            : '<div style="font-family:\'Calibri Light\',Calibri,sans-serif;font-size:11pt;font-weight:300;letter-spacing:0.08em;color:#b91c1c;">KOSTA<br/>LEGAL</div>';
    const positionHtml = position
        ? `<div style="margin-top:2px;font-family:'Calibri Light',Calibri,sans-serif;font-size:11pt;font-weight:300;color:#1e293b;">${esc(position)}</div>`
        : '';
    const html = ''
        + '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:16px;border-collapse:collapse;font-family:\'Calibri Light\',Calibri,sans-serif;font-size:11pt;font-weight:300;color:#1e293b;">'
        + '<tr><td style="padding:0 0 14px;font-family:\'Calibri Light\',Calibri,sans-serif;font-size:11pt;font-weight:300;line-height:1.35;">'
        + `<div>${esc(name)}</div>`
        + positionHtml
        + '</td></tr>'
        + '<tr><td style="padding:0 0 14px;">'
        + '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">'
        + '<tr>'
        + `<td style="vertical-align:middle;width:46%;" align="left">${logo}</td>`
        + '<td style="vertical-align:middle;text-align:right;font-family:\'Calibri Light\',Calibri,sans-serif;font-size:11pt;font-weight:300;line-height:1.35;color:#1e293b;" align="right">'
        + `<div>${esc(ADDRESS_RU)} |</div>`
        + `<div>${esc(ADDRESS_EN)}</div>`
        + `<div style="margin-top:6px;">${PHONES}</div>`
        + `<div style="margin-top:2px;">Web site: <a href="${SITE}" style="color:#1d4ed8;text-decoration:underline;">www.kostalegal.com</a></div>`
        + '</td></tr></table>'
        + '</td></tr>'
        + '<tr><td style="padding:8px 0 0;border-top:1px solid #94a3b8;">'
        + '<div style="margin-top:10px;font-family:\'Calibri Light\',Calibri,sans-serif;font-size:11pt;font-weight:300;">DISCLAIMER:</div>'
        + `<div style="margin-top:4px;font-family:'Calibri Light',Calibri,sans-serif;font-size:11pt;font-weight:300;line-height:1.35;color:#1e293b;">${DISCLAIMER_EN}</div>`
        + '<div style="margin-top:12px;font-family:\'Calibri Light\',Calibri,sans-serif;font-size:11pt;font-weight:300;">ПРЕДУПРЕЖДЕНИЕ:</div>'
        + `<div style="margin-top:4px;font-family:'Calibri Light',Calibri,sans-serif;font-size:11pt;font-weight:300;line-height:1.35;color:#1e293b;">${DISCLAIMER_RU}</div>`
        + '</td></tr></table>';
    const text = [
        name,
        position,
        '',
        `${ADDRESS_RU} |`,
        ADDRESS_EN,
        'Tel.: (998 71) 209 0240    Fax.: (998 71) 209 0241',
        'Web site: www.kostalegal.com',
        '',
        `DISCLAIMER:\n${DISCLAIMER_EN}`,
        '',
        `ПРЕДУПРЕЖДЕНИЕ:\n${DISCLAIMER_RU}`,
    ].filter((line) => line !== '').join('\n');
    return { html, text };
}

/** Rasterize the public mark so Outlook can show it as an inline PNG, not an SVG link. */
export async function rasterizePublicLogoPng(): Promise<string | null> {
    try {
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
            const timer = window.setTimeout(() => reject(new Error('logo timeout')), 4000);
            img.onload = () => {
                window.clearTimeout(timer);
                resolve();
            };
            img.onerror = () => {
                window.clearTimeout(timer);
                reject(new Error('logo'));
            };
            img.src = '/KostaLegal-logo-02-black.svg';
        });
        const width = 420;
        const height = Math.max(1, Math.round(width * (img.naturalHeight / Math.max(1, img.naturalWidth))));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx)
            return null;
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/png');
        const comma = dataUrl.indexOf(',');
        return comma >= 0 ? dataUrl.slice(comma + 1) : null;
    }
    catch {
        return null;
    }
}
