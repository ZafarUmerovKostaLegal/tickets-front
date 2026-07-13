export async function parseApiError(res: Response, fallback: string): Promise<string> {
    const err = await res.json().catch(() => ({}));
    return (err as {
        detail?: string;
    })?.detail ?? res.statusText ?? fallback;
}
