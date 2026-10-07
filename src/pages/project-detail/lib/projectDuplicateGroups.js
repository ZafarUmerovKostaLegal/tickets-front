export function duplicateEntryKey(row) {
    return `${row.auth_user_id}:${row.entry_id}`;
}
function sortEntriesForKeeper(a, b) {
    return (a.created_at ?? '').localeCompare(b.created_at ?? '') || a.entry_id.localeCompare(b.entry_id);
}
export function pickKeeperEntry(group) {
    return [...group.entries].sort(sortEntriesForKeeper)[0];
}
export function pickKeeperEntryKey(group) {
    return duplicateEntryKey(pickKeeperEntry(group));
}
/** Split backend groups when entries span different work dates (defensive UI). */
export function splitDuplicateGroupsByWorkDate(groups) {
    const out = [];
    for (const group of groups) {
        const buckets = new Map();
        for (const entry of group.entries) {
            const workDate = (entry.work_date || group.work_date || '').slice(0, 10) || '__unknown__';
            const list = buckets.get(workDate) ?? [];
            list.push(entry);
            buckets.set(workDate, list);
        }
        if (buckets.size <= 1) {
            if (group.entries.length >= 2)
                out.push(group);
            continue;
        }
        let part = 0;
        for (const [workDate, entries] of buckets) {
            if (entries.length < 2)
                continue;
            part += 1;
            out.push({
                ...group,
                group_id: `${group.group_id}__${workDate}`,
                group_label: `${group.group_label}.${part}`,
                work_date: workDate === '__unknown__' ? group.work_date : workDate,
                entries,
                entries_in_group: entries.length,
            });
        }
    }
    return out;
}
export function buildDefaultArchiveSelection(groups) {
    const selected = new Set();
    for (const group of groups) {
        const sorted = [...group.entries].sort(sortEntriesForKeeper);
        sorted.slice(1).forEach((entry) => selected.add(duplicateEntryKey(entry)));
    }
    return selected;
}
export function summarizeDuplicateGroups(groups) {
    const users = new Set();
    let entryCount = 0;
    for (const group of groups) {
        entryCount += group.entries.length;
        for (const entry of group.entries)
            users.add(entry.auth_user_id);
    }
    return {
        group_count: groups.length,
        entry_count: entryCount,
        user_count: users.size,
    };
}
