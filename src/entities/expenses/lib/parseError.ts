export async function parseExpensesError(res: Response): Promise<string> {
    const text = await res.text().catch(() => '');
    try {
        const j = JSON.parse(text) as {
            detail?: unknown;
        };
        if (typeof j.detail === 'string')
            return j.detail;
        if (Array.isArray(j.detail))
            return j.detail.map(String).join(', ');
    }
    catch {
    }
    return text || `Ошибка (${res.status})`;
}
