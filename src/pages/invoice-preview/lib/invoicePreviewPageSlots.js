export function timeReportPageKey(chunkIndex) {
    return `tr:${chunkIndex}`;
}
export function buildInvoicePreviewPageSlots(timeReportChunkCount) {
    const chunks = Math.max(1, timeReportChunkCount);
    const slots = [{ key: 'cover', kind: 'cover' }];
    for (let i = 0; i < chunks; i += 1)
        slots.push({ key: timeReportPageKey(i), kind: 'timeReport', chunkIndex: i });
    slots.push({ key: 'invoice', kind: 'invoice' });
    return slots;
}
export function isInvoicePreviewPageKey(raw) {
    if (typeof raw !== 'string' || !raw.trim())
        return false;
    if (raw === 'cover' || raw === 'invoice')
        return true;
    return /^tr:\d+$/.test(raw);
}
export function parseIncludedPageKeys(raw) {
    if (!Array.isArray(raw))
        return null;
    const out = [];
    const seen = new Set();
    for (const item of raw) {
        if (!isInvoicePreviewPageKey(item) || seen.has(item))
            continue;
        seen.add(item);
        out.push(item);
    }
    return out.length > 0 ? out : null;
}
export function normalizeIncludedPageKeys(included, allSlots) {
    const allKeys = allSlots.map((s) => s.key);
    if (included == null) {
        return new Set(allKeys);
    }
    const next = new Set();
    for (const key of included) {
        if (allKeys.includes(key))
            next.add(key);
    }
    // Always keep at least one page.
    if (next.size === 0 && allKeys.length > 0)
        next.add(allKeys[allKeys.length - 1]);
    // Prefer keeping invoice page if everything else was pruned oddly.
    if (next.size === 0 && allKeys.includes('invoice'))
        next.add('invoice');
    return next;
}
/**
 * If saved keys are exactly a full pack for fewer TR chunks (typical race: keys frozen
 * against the empty 1-chunk placeholder before the real pack loaded), expand to the
 * current full pack. Keeps intentional invoice-only and other deliberate subsets.
 */
export function expandIncludedPageKeysIfCompleteSubset(included, allSlots) {
    const saved = [...included].filter(isInvoicePreviewPageKey);
    const savedSet = new Set(saved);
    const allKeys = allSlots.map((s) => s.key);
    const trCount = allSlots.filter((s) => s.kind === 'timeReport').length;
    if (savedSet.size === 1 && savedSet.has('invoice'))
        return new Set(['invoice']);
    for (let n = 1; n < trCount; n += 1) {
        const smallerKeys = buildInvoicePreviewPageSlots(n).map((s) => s.key);
        if (smallerKeys.length === savedSet.size && smallerKeys.every((k) => savedSet.has(k)))
            return new Set(allKeys);
    }
    return normalizeIncludedPageKeys(saved, allSlots);
}
export function pageKindLabelForSlot(slot) {
    if (slot.kind === 'cover')
        return 'сопроводительное письмо';
    if (slot.kind === 'invoice')
        return 'счёт';
    return slot.chunkIndex > 0 ? 'time report (продолжение)' : 'time report';
}
export function pageNumbersForIncludedKeys(included, timeReportChunkCount) {
    const slots = buildInvoicePreviewPageSlots(timeReportChunkCount);
    const set = normalizeIncludedPageKeys(included, slots);
    if (set.size === slots.length)
        return undefined;
    const nums = [];
    slots.forEach((slot, idx) => {
        if (set.has(slot.key))
            nums.push(idx + 1);
    });
    return nums;
}
