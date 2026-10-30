import { useState } from 'react';
import { excelWorkbookBufferToBlob, loadExcelJS, writeExcelWorkbookBuffer } from '@shared/lib/exceljsLoader';
import { VACATION_MONTH_NAMES } from '../lib/vacationScheduleModel';
import type { VacationDayDetailRow } from './VacationDayDetails';

function ruCount(count: number, one: string, few: string, many: string): string {
    const mod10 = count % 10;
    const mod100 = count % 100;
    const word = mod10 === 1 && mod100 !== 11
        ? one
        : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
            ? few
            : many;
    return `${count} ${word}`;
}

function monthSummary(rows: ReadonlyArray<VacationDayDetailRow>): string {
    if (rows.length === 0)
        return 'Нет отсутствий';
    const lates = rows.filter((row) => row.kindLabel === 'Опоздание').length;
    const away = rows.length - lates;
    if (lates === 0)
        return ruCount(away, 'отсутствие', 'отсутствия', 'отсутствий');
    if (away === 0)
        return ruCount(lates, 'опоздание', 'опоздания', 'опозданий');
    return `${ruCount(away, 'отсутствие', 'отсутствия', 'отсутствий')} · ${ruCount(lates, 'опоздание', 'опоздания', 'опозданий')}`;
}

function rowWhen(row: VacationDayDetailRow): { when: string; times: string | null } {
    if (row.kindLabel !== 'Опоздание')
        return { when: row.rangeLabel, times: null };
    const [head, tail] = row.rangeLabel.split(' · ');
    if (tail && /^\d+/.test(head))
        return { when: tail, times: head.split(' ')[0] ?? null };
    return { when: head, times: tail ?? null };
}

function groupedRows(rows: ReadonlyArray<VacationDayDetailRow>): Array<{ kind: string; color: string; rows: VacationDayDetailRow[] }> {
    const order: string[] = [];
    const byKind = new Map<string, { color: string; rows: VacationDayDetailRow[] }>();
    for (const row of rows) {
        const bucket = byKind.get(row.kindLabel);
        if (bucket)
            bucket.rows.push(row);
        else {
            order.push(row.kindLabel);
            byKind.set(row.kindLabel, { color: row.color, rows: [row] });
        }
    }
    order.sort((a, b) => {
        if (a === 'Опоздание')
            return 1;
        if (b === 'Опоздание')
            return -1;
        return (byKind.get(b)?.rows.length ?? 0) - (byKind.get(a)?.rows.length ?? 0) || a.localeCompare(b, 'ru');
    });
    return order.map((kind) => {
        const bucket = byKind.get(kind)!;
        return {
            kind,
            color: bucket.color,
            rows: bucket.rows.slice().sort((a, b) => a.label.localeCompare(b.label, 'ru')),
        };
    });
}

async function downloadMonthList(title: string, rows: ReadonlyArray<VacationDayDetailRow>): Promise<void> {
    const ExcelJS = await loadExcelJS();
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Отсутствия');
    sheet.columns = [
        { header: 'Тип', key: 'kind', width: 28 },
        { header: 'Сотрудник', key: 'name', width: 32 },
        { header: 'Команда', key: 'team', width: 24 },
        { header: 'Период', key: 'when', width: 28 },
    ];
    sheet.getRow(1).font = { bold: true };
    for (const group of groupedRows(rows)) {
        for (const row of group.rows) {
            const meta = rowWhen(row);
            sheet.addRow({
                kind: group.kind,
                name: row.label,
                team: row.teamName,
                when: meta.times ? `${meta.when} (×${meta.times})` : meta.when,
            });
        }
    }
    const buffer = await writeExcelWorkbookBuffer(workbook);
    const blob = excelWorkbookBufferToBlob(buffer);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Отсутствия ${title}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
}

type Props = {
    year: number;
    monthIndex: number;
    open: boolean;
    visible?: boolean;
    rows: ReadonlyArray<VacationDayDetailRow>;
    onToggle: () => void;
    onStepMonth?: (delta: number) => void;
    onOpenCard: (employeeId: number) => void;
    onOpenDocs: (employeeId: number, label: string) => void;
    showDocs: boolean;
};

export function VacationMonthPanel({ year, monthIndex, open, visible = true, rows, onToggle, onStepMonth, onOpenCard, onOpenDocs, showDocs }: Props) {
    const title = `${VACATION_MONTH_NAMES[monthIndex]} ${year}`;
    const [downloading, setDownloading] = useState(false);
    const download = () => {
        if (rows.length === 0 || downloading)
            return;
        setDownloading(true);
        void downloadMonthList(title, rows)
            .catch(() => undefined)
            .finally(() => setDownloading(false));
    };
    return (
        <aside className={`vac-month${open ? '' : ' vac-month--closed'}${visible ? '' : ' vac-month--away'}`} aria-hidden={!visible} aria-label={`Отсутствия за ${title}`}>
            <div className="vac-month__bar">
                {open ? (
                    <div className="vac-month__heading">
                        <div className="vac-month__nav">
                            <button type="button" className="vac-month__step" aria-label="Предыдущий месяц" title="Предыдущий месяц" onClick={() => onStepMonth?.(-1)}>‹</button>
                            <h2 className="vac-month__title">{title}</h2>
                            <button type="button" className="vac-month__step" aria-label="Следующий месяц" title="Следующий месяц" onClick={() => onStepMonth?.(1)}>›</button>
                        </div>
                        <div className="vac-month__summary">
                            <p className="vac-month__count">{monthSummary(rows)}</p>
                            <button
                                type="button"
                                className="vac-month__download"
                                disabled={rows.length === 0 || downloading}
                                onClick={download}
                            >
                                {downloading ? 'Файл…' : 'Скачать'}
                            </button>
                        </div>
                    </div>
                ) : null}
                <button
                    type="button"
                    className="vac-month__toggle"
                    aria-expanded={open}
                    aria-label={open ? 'Свернуть детали месяца' : 'Показать детали месяца'}
                    title={open ? 'Свернуть' : title}
                    onClick={onToggle}
                >
                    {open ? '›' : '‹'}
                </button>
            </div>
            {open ? (
                rows.length === 0 ? (
                    <p className="vac-month__empty">В этом месяце отсутствий нет</p>
                ) : (
                    <div className="vac-month__list">
                        {groupedRows(rows).map((group) => (
                            <section key={group.kind} className="vac-month__group">
                                <h3 className="vac-month__group-title">
                                    <i style={{ background: group.color }} aria-hidden />
                                    <span>{group.kind}</span>
                                    <em>{group.rows.length}</em>
                                </h3>
                                <ul>
                                    {group.rows.map((row) => {
                                        const meta = rowWhen(row);
                                        const docs = showDocs && row.allowDocs !== false && row.canOpenCard;
                                        return (
                                            <li key={`${row.employeeId}-${row.kindLabel}`} className="vac-month__row">
                                                {row.canOpenCard ? (
                                                    <button type="button" className="vac-month__who" onClick={() => onOpenCard(row.employeeId)}>
                                                        {row.label}
                                                    </button>
                                                ) : <span className="vac-month__who">{row.label}</span>}
                                                <span className="vac-month__when">
                                                    {meta.times ? <em>×{meta.times}</em> : null}
                                                    {meta.when}
                                                </span>
                                                {docs ? (
                                                    <button type="button" className="vac-month__doc" title="Документы" onClick={() => onOpenDocs(row.employeeId, row.label)}>
                                                        Док.
                                                    </button>
                                                ) : null}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </section>
                        ))}
                    </div>
                )
            ) : (
                <span className="vac-month__rail">{VACATION_MONTH_NAMES[monthIndex]}</span>
            )}
        </aside>
    );
}
