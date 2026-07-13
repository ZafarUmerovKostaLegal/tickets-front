import { formatDateOnly, formatTime } from '@shared/lib/formatDate';
import { getMessages } from '@shared/i18n/messages';
import { getInitialLocale } from '@shared/i18n/localeStorage';
import type { GroupedRow } from '../types';
import { defaultFrom, defaultTo } from '../constants';

export function exportAttendanceToCsv(rows: GroupedRow[], dateFrom: string, dateTo: string): void {
    if (!rows.length)
        return;
    const labels = getMessages(getInitialLocale()).attendancePage;
    const from = dateFrom || defaultFrom();
    const to = dateTo || defaultTo();
    const hasStatus = rows.some((r) => r.status);
    const header = hasStatus
        ? [labels.table.date, labels.table.employee, labels.export.statusColumn, labels.table.arrival, labels.table.departure, labels.table.checkpoint]
        : [labels.table.date, labels.table.employee, labels.table.arrival, labels.table.departure, labels.table.checkpoint];
    const statusLabel = (s: GroupedRow['status']) => {
        if (s === 'present_on_time')
            return labels.export.statusOnTime;
        if (s === 'late')
            return labels.export.statusLate;
        if (s === 'absent')
            return labels.export.statusAbsent;
        return '';
    };
    const dataRows = rows.map((r) => {
        const base = [
            r.date ? formatDateOnly(r.date) : '—',
            r.name || '—',
            r.firstTime ? formatTime(r.firstTime) : '—',
            r.lastTime ? formatTime(r.lastTime) : '—',
            r.firstCheckpoint === r.lastCheckpoint
                ? r.firstCheckpoint
                : `${r.firstCheckpoint} -> ${r.lastCheckpoint}`,
        ];
        if (!hasStatus)
            return base;
        return [base[0], base[1], statusLabel(r.status), base[2], base[3], base[4]];
    });
    const csvLines = [header, ...dataRows].map((cols) => cols.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(';'));
    const csvContent = '\uFEFF' + csvLines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `attendance_${from}_${to}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
