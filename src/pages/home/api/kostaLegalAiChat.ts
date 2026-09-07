import { apiFetch } from '@shared/api';

export type KostaLegalAiLawArea = 'civil' | 'labor' | 'tax' | 'corporate' | 'ip';

export type KostaLegalAiCommandId =
    | 'spellCheck'
    | 'caseLaw'
    | 'adCheck'
    | 'ocr'
    | 'claimResponse'
    | 'contractAnalysis'
    | 'styleChange'
    | 'legalDesign';

export type KostaLegalAiChatTurn = {
    role: 'user' | 'assistant';
    content: string;
};

export type KostaLegalAiChatRequest = {
    query: string;
    lawArea: KostaLegalAiLawArea;
    sourceCount: number;
    webSearch: boolean;
    commandId?: KostaLegalAiCommandId | null;
    messages?: KostaLegalAiChatTurn[];
};

export type KostaLegalAiChatResult = {
    answer: string;
    model: string;
};

function detailFromBody(body: unknown): string {
    if (!body || typeof body !== 'object')
        return '';
    const detail = (body as { detail?: unknown }).detail;
    if (typeof detail === 'string')
        return detail;
    if (Array.isArray(detail)) {
        return detail
            .map((item) => (typeof item === 'object' && item && 'msg' in item
                ? String((item as { msg: unknown }).msg)
                : String(item)))
            .filter(Boolean)
            .join('; ');
    }
    return '';
}

export async function chatKostaLegalAi(input: KostaLegalAiChatRequest): Promise<KostaLegalAiChatResult> {
    const res = await apiFetch('/api/v1/kosta-legal-ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            query: input.query,
            law_area: input.lawArea,
            source_count: input.sourceCount,
            web_search: input.webSearch,
            command_id: input.commandId ?? null,
            messages: input.messages ?? [],
        }),
    });
    const raw = await res.text();
    let parsed: unknown = {};
    if (raw) {
        try {
            parsed = JSON.parse(raw) as unknown;
        }
        catch {
            parsed = {};
        }
    }
    if (!res.ok) {
        throw new Error(detailFromBody(parsed) || `Ошибка Kosta Legal AI (${res.status})`);
    }
    const data = parsed as { answer?: unknown; model?: unknown };
    if (typeof data.answer !== 'string' || !data.answer.trim())
        throw new Error('Модель вернула пустой ответ.');
    return {
        answer: data.answer,
        model: typeof data.model === 'string' ? data.model : '',
    };
}
