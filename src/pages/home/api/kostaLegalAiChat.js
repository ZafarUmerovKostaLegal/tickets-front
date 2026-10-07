import { apiFetch } from '@shared/api';
function detailFromBody(body) {
    if (!body || typeof body !== 'object')
        return '';
    const detail = body.detail;
    if (typeof detail === 'string')
        return detail;
    if (Array.isArray(detail)) {
        return detail
            .map((item) => (typeof item === 'object' && item && 'msg' in item
            ? String(item.msg)
            : String(item)))
            .filter(Boolean)
            .join('; ');
    }
    return '';
}
export async function chatKostaLegalAi(input) {
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
    let parsed = {};
    if (raw) {
        try {
            parsed = JSON.parse(raw);
        }
        catch {
            parsed = {};
        }
    }
    if (!res.ok) {
        throw new Error(detailFromBody(parsed) || `Ошибка Kosta Legal AI (${res.status})`);
    }
    const data = parsed;
    if (typeof data.answer !== 'string' || !data.answer.trim())
        throw new Error('Модель вернула пустой ответ.');
    return {
        answer: data.answer,
        model: typeof data.model === 'string' ? data.model : '',
    };
}
