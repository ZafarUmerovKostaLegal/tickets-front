/** Stable page identities for invoice preview packs (survive reordering / chunk count changes). */
export type InvoicePreviewPageKey = 'cover' | 'invoice' | `tr:${number}`;

export type InvoicePreviewPageSlot =
    | { key: 'cover'; kind: 'cover' }
    | { key: `tr:${number}`; kind: 'timeReport'; chunkIndex: number }
    | { key: 'invoice'; kind: 'invoice' };

export function timeReportPageKey(chunkIndex: number): `tr:${number}` {
    return `tr:${chunkIndex}`;
}

export function buildInvoicePreviewPageSlots(timeReportChunkCount: number): InvoicePreviewPageSlot[] {
    const chunks = Math.max(1, timeReportChunkCount);
    const slots: InvoicePreviewPageSlot[] = [{ key: 'cover', kind: 'cover' }];
    for (let i = 0; i < chunks; i += 1)
        slots.push({ key: timeReportPageKey(i), kind: 'timeReport', chunkIndex: i });
    slots.push({ key: 'invoice', kind: 'invoice' });
    return slots;
}

export function isInvoicePreviewPageKey(raw: unknown): raw is InvoicePreviewPageKey {
    if (typeof raw !== 'string' || !raw.trim())
        return false;
    if (raw === 'cover' || raw === 'invoice')
        return true;
    return /^tr:\d+$/.test(raw);
}

export function parseIncludedPageKeys(raw: unknown): InvoicePreviewPageKey[] | null {
    if (!Array.isArray(raw))
        return null;
    const out: InvoicePreviewPageKey[] = [];
    const seen = new Set<string>();
    for (const item of raw) {
        if (!isInvoicePreviewPageKey(item) || seen.has(item))
            continue;
        seen.add(item);
        out.push(item);
    }
    return out.length > 0 ? out : null;
}

export function normalizeIncludedPageKeys(
    included: Iterable<InvoicePreviewPageKey> | null | undefined,
    allSlots: readonly InvoicePreviewPageSlot[],
): Set<InvoicePreviewPageKey> {
    const allKeys = allSlots.map((s) => s.key);
    if (included == null) {
        return new Set(allKeys);
    }
    const next = new Set<InvoicePreviewPageKey>();
    for (const key of included) {
        if (allKeys.includes(key))
            next.add(key);
    }
    // Always keep at least one page.
    if (next.size === 0 && allKeys.length > 0)
        next.add(allKeys[allKeys.length - 1]!);
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
export function expandIncludedPageKeysIfCompleteSubset(
    included: Iterable<InvoicePreviewPageKey>,
    allSlots: readonly InvoicePreviewPageSlot[],
): Set<InvoicePreviewPageKey> {
    const saved = [...included].filter(isInvoicePreviewPageKey);
    const savedSet = new Set(saved);
    const allKeys = allSlots.map((s) => s.key);
    const trCount = allSlots.filter((s) => s.kind === 'timeReport').length;

    if (savedSet.size === 1 && savedSet.has('invoice'))
        return new Set<InvoicePreviewPageKey>(['invoice']);

    for (let n = 1; n < trCount; n += 1) {
        const smallerKeys = buildInvoicePreviewPageSlots(n).map((s) => s.key);
        if (smallerKeys.length === savedSet.size && smallerKeys.every((k) => savedSet.has(k)))
            return new Set(allKeys);
    }

    return normalizeIncludedPageKeys(saved, allSlots);
}

export function pageKindLabelForSlot(slot: InvoicePreviewPageSlot): string {
    if (slot.kind === 'cover')
        return 'сопроводительное письмо';
    if (slot.kind === 'invoice')
        return 'счёт';
    return slot.chunkIndex > 0 ? 'time report (продолжение)' : 'time report';
}

export function pageNumbersForIncludedKeys(
    included: Iterable<InvoicePreviewPageKey> | null | undefined,
    timeReportChunkCount: number,
): number[] | undefined {
    const slots = buildInvoicePreviewPageSlots(timeReportChunkCount);
    const set = normalizeIncludedPageKeys(included, slots);
    if (set.size === slots.length)
        return undefined;
    const nums: number[] = [];
    slots.forEach((slot, idx) => {
        if (set.has(slot.key))
            nums.push(idx + 1);
    });
    return nums;
}
