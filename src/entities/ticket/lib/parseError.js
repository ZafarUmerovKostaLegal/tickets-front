export async function parseApiError(res, fallback) {
    const err = await res.json().catch(() => ({}));
    return err?.detail ?? res.statusText ?? fallback;
}
