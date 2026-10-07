/** First calendar day in an issue/payment cell. ISO and Excel d.m.yyyy both count. */
export function parseRegistryDay(raw) {
    const head = String(raw ?? '').split(/[\n/]/)[0]?.trim() ?? '';
    if (!head)
        return null;
    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(head);
    if (iso)
        return dayOrNull(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    const dmy = /^(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(head);
    if (dmy)
        return dayOrNull(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]));
    return null;
}
function dayOrNull(year, month, day) {
    if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1990 || year > 2100)
        return null;
    return { year, month, day };
}
function dayStamp(day) {
    return day.year * 10000 + day.month * 100 + day.day;
}
export function filterInvoiceRegistryRows(rows, filter) {
    const search = (filter.search ?? '').trim().toLowerCase();
    const searchKeys = filter.searchKeys ?? [];
    const partners = filter.partners ?? new Set();
    const numberQuery = (filter.numberQuery ?? '').trim().toLowerCase();
    const from = parseRegistryDay(filter.dateFrom ?? '');
    const to = parseRegistryDay(filter.dateTo ?? '');
    const months = filter.months ?? new Set();
    const partnerNeedles = new Set([...partners].map((code) => code.trim().toUpperCase()).filter(Boolean));
    return rows.filter((row) => {
        if (search && !searchKeys.some((key) => String(row[key] ?? '').toLowerCase().includes(search)))
            return false;
        if (partnerNeedles.size > 0) {
            const code = String(row.partner ?? '').trim().toUpperCase();
            if (!partnerNeedles.has(code))
                return false;
        }
        if (numberQuery) {
            const seq = String(row.seqNo ?? '').toLowerCase();
            const clientNo = String(row.clientNumber ?? '').toLowerCase();
            if (!seq.includes(numberQuery) && !clientNo.includes(numberQuery))
                return false;
        }
        const issued = parseRegistryDay(String(row.issueDate ?? ''));
        if (from || to || months.size > 0) {
            if (!issued)
                return false;
            const stamp = dayStamp(issued);
            if (from && stamp < dayStamp(from))
                return false;
            if (to && stamp > dayStamp(to))
                return false;
            if (months.size > 0 && !months.has(issued.month))
                return false;
        }
        return true;
    });
}
