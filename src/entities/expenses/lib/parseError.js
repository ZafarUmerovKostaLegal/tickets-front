export async function parseExpensesError(res) {
    const text = await res.text().catch(() => '');
    try {
        const j = JSON.parse(text);
        if (typeof j.detail === 'string')
            return j.detail;
        if (Array.isArray(j.detail))
            return j.detail.map(String).join(', ');
    }
    catch {
    }
    return text || `Ошибка (${res.status})`;
}
