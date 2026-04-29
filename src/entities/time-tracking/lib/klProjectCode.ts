const CYR_TO_LAT: Record<string, string> = {
    А: 'A',
    Б: 'B',
    В: 'V',
    Г: 'G',
    Д: 'D',
    Е: 'E',
    Ё: 'E',
    Ж: 'Z',
    З: 'Z',
    И: 'I',
    Й: 'J',
    К: 'K',
    Л: 'L',
    М: 'M',
    Н: 'N',
    О: 'O',
    П: 'P',
    Р: 'R',
    С: 'S',
    Т: 'T',
    У: 'U',
    Ф: 'F',
    Х: 'H',
    Ц: 'C',
    Ч: 'C',
    Ш: 'S',
    Щ: 'S',
    Ъ: 'E',
    Ы: 'Y',
    Ь: '',
    Э: 'E',
    Ю: 'U',
    Я: 'A',
};


const NEW_KL_RE = /^KL-([A-Z0-9]{4})-(\d{2})\/(\d{2})$/i;


export function deriveClientToken4(clientName: string): string {
    const s = clientName.normalize('NFC').trim();
    const out: string[] = [];
    for (const ch of s) {
        if (out.length >= 4)
            break;
        if (/[0-9]/.test(ch)) {
            out.push(ch);
            continue;
        }
        if (/[A-Za-z]/.test(ch)) {
            out.push(ch.toUpperCase());
            continue;
        }
        const u = ch.toLocaleUpperCase('ru-RU');
        const mapped = CYR_TO_LAT[u];
        if (mapped) {
            for (const mc of mapped) {
                if (out.length >= 4)
                    break;
                if (/[A-Z0-9]/i.test(mc))
                    out.push(String(mc).toUpperCase());
            }
        }
    }
    while (out.length < 4)
        out.push('X');
    return out.slice(0, 4).join('');
}

export function deriveLatinLetterFromClientName(clientName: string): string {
    return deriveClientToken4(clientName).charAt(0) || 'X';
}

function parseKlCode(raw: string | null | undefined): { token: string; clientSeq: number; projSeq: number } | null {
    const c = (raw ?? '').trim().toUpperCase();
    const m = c.match(NEW_KL_RE);
    if (!m)
        return null;
    return {
        token: m[1]!,
        clientSeq: parseInt(m[2]!, 10),
        projSeq: parseInt(m[3]!, 10),
    };
}


function clientSequenceNumber(clientId: string, allClients: readonly { id: string; created_at: string }[]): number {
    if (!clientId || allClients.length === 0)
        return 1;
    const sorted = [...allClients].sort((a, b) => {
        const ta = a.created_at || '';
        const tb = b.created_at || '';
        if (ta !== tb)
            return ta.localeCompare(tb);
        return a.id.localeCompare(b.id);
    });
    const idx = sorted.findIndex((c) => c.id === clientId);
    const n = idx >= 0 ? idx + 1 : 1;
    return Math.min(Math.max(n, 1), 99);
}

export type SuggestedKlProjectCodeContext = {
    clientId: string;
    allClients: readonly { id: string; created_at: string }[];
};


export function suggestedNextKlProjectCode(clientName: string, existingCodes: (string | null | undefined)[], context?: SuggestedKlProjectCodeContext): string {
    const token4 = deriveClientToken4(clientName);
    const clientSeq = context?.clientId && context.allClients && context.allClients.length > 0
        ? clientSequenceNumber(context.clientId, context.allClients)
        : 1;
    let maxProj = 0;
    for (const raw of existingCodes) {
        const p = parseKlCode(raw);
        if (!p || p.token !== token4 || p.clientSeq !== clientSeq)
            continue;
        if (Number.isFinite(p.projSeq))
            maxProj = Math.max(maxProj, p.projSeq);
    }
    const baseCount = existingCodes.filter((c) => String(c ?? '').trim().length > 0).length;
    const nextProj = Math.min(Math.max(maxProj, baseCount) + 1, 99);
    return `KL-${token4}-${String(clientSeq).padStart(2, '0')}/${String(nextProj).padStart(2, '0')}`;
}
