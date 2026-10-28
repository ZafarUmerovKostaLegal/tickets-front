import type { JournalTab, JournalViewModel } from './journalView';

export type JournalReportBlock = {
    heading: string;
    lines: string[];
};

export type JournalReportDocument = {
    title: string;
    fileName: string;
    blocks: JournalReportBlock[];
};

function safeFilePart(value: string): string {
    const cleaned = value
        .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '_')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
    return cleaned.slice(0, 80);
}

export function journalReportDocument(model: JournalViewModel, view: JournalTab): JournalReportDocument {
    const who = model.report?.login || 'Все пользователи';
    const blocks: JournalReportBlock[] = [];
    const intro = [
        model.report ? `Отчёт: ${model.report.login}` : 'Все пользователи',
        model.report?.sub ?? '',
        model.periodLabel ? `Период: ${model.periodLabel}` : '',
        model.tiles.map((tile) => `${tile.label}: ${tile.value}`).join(' · '),
    ].filter(Boolean);
    blocks.push({ heading: 'Сводка', lines: intro });

    if (model.report) {
        blocks.push({
            heading: 'Блокировки по дням',
            lines: model.report.days.length > 0
                ? model.report.days.map((day) => `${day.label}: ${day.value}`)
                : ['Нет данных'],
        });
        blocks.push({
            heading: 'Куда чаще всего пытался отправить',
            lines: model.report.dests.length > 0
                ? model.report.dests.map((row) => `${row.label} — ${row.count}`)
                : ['Нет данных'],
        });
        blocks.push({
            heading: 'Чаще всего в блокировках',
            lines: model.report.files.length > 0
                ? model.report.files.map((row) => `${row.label} — ${row.count}`)
                : ['Нет данных'],
        });
    }

    if (view === 'files') {
        blocks.push({
            heading: 'Файлы',
            lines: model.fileRows.length > 0
                ? model.fileRows.map((file) => [
                    file.name,
                    model.showUserColumn ? file.userLogin : '',
                    file.lastAction,
                    file.lastWhen,
                    `блокировок ${file.blocked}`,
                    `всего ${file.total}`,
                ].filter(Boolean).join(' · '))
                : ['Нет записей'],
        });
    }
    else if (view === 'users') {
        blocks.push({
            heading: 'Пользователи',
            lines: model.userRows.length > 0
                ? model.userRows.map((user) => [
                    user.login,
                    user.host,
                    user.dept,
                    `событий ${user.events}`,
                    `блокировок ${user.blocked}`,
                    `файлов ${user.files}`,
                    user.last,
                ].filter(Boolean).join(' · '))
                : ['Нет записей'],
        });
    }
    else {
        blocks.push({
            heading: 'События',
            lines: model.rows.length > 0
                ? model.rows.map((row) => row.kind === 'head' || row.kind === 'month'
                    ? `${row.label}. ${row.summary}`
                    : [
                        row.time,
                        model.showUserColumn ? row.userLogin : '',
                        row.statusLabel,
                        row.name,
                        row.dir,
                        row.actionLabel,
                        row.res,
                        row.proc,
                    ].filter(Boolean).join(' · '))
                : ['Нет записей'],
        });
    }

    const stamp = new Date();
    const day = `${String(stamp.getDate()).padStart(2, '0')}.${String(stamp.getMonth() + 1).padStart(2, '0')}.${stamp.getFullYear()}`;
    return {
        title: 'Журнал защиты файлов',
        fileName: `Отчет_${safeFilePart(who) || 'все'}_${day}.pdf`,
        blocks,
    };
}
