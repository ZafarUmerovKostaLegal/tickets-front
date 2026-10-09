import { useState, type ChangeEvent } from 'react';
import { KOSTA_LEGAL_LETTERHEAD_LINES } from '../lib/invoiceCoverLetterModel';
import { coverLetterheadLogoUrl } from '../lib/invoiceCoverLogoRaster';
import { planCombinedReportPreviewPages } from '../lib/combinedReportPreviewPages';
import { formatTimeReportAmount, formatTimeReportHours } from '../lib/invoiceTimeReportModel';
import type { CombinedReportLine, CombinedReportSnapshot } from '@pages/time-tracking/lib/combinedInvoice';
import './InvoiceTimeReportPage.css';

type Props = {
    report: CombinedReportSnapshot;
    pageNumber: number;
    /** Which A4 sheet of the combined report to paint. */
    pageIndex?: number;
    editable?: boolean;
    onChange?: (next: CombinedReportSnapshot) => void;
};

function money(n: number): string {
    const [whole, frac] = n.toFixed(2).split('.');
    return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}.${frac}`;
}

function hours(n: number): string {
    return n.toFixed(2);
}

function shareExpenseText(n: number | undefined): string {
    if (n == null || Math.abs(n) < 0.005)
        return '-';
    return money(n);
}

function dateRu(iso: string): string {
    const day = iso.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day))
        return iso;
    const [y, m, d] = day.split('-');
    return `${d}.${m}.${y}`;
}

function commitDate(raw: string): string {
    const match = raw.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (!match)
        return raw;
    return `${match[3]}-${match[2]}-${match[1]}`;
}

function parseNum(raw: string): number | null {
    const n = Number(raw.replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
}

function TextCell({
    value,
    editable,
    onChange,
    className,
    ariaLabel,
}: {
    value: string;
    editable?: boolean;
    onChange: (next: string) => void;
    className?: string;
    ariaLabel: string;
}) {
    if (!editable)
        return <td className={className}>{value || '\u00a0'}</td>;
    return (
        <td className={className}>
            <input
                type="text"
                className="tt-inv-tr__cell-input"
                value={value}
                aria-label={ariaLabel}
                onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
            />
        </td>
    );
}

function NumInput({
    value,
    onChange,
    ariaLabel,
    format,
    foot = false,
}: {
    value: number;
    onChange: (next: number) => void;
    ariaLabel: string;
    format: (n: number) => string;
    foot?: boolean;
}) {
    const [draft, setDraft] = useState<string | null>(null);
    return (
        <input
            type="text"
            className={`tt-inv-tr__cell-input${foot ? ' tt-inv-tr__cell-input--foot' : ''}`}
            value={draft ?? format(value)}
            aria-label={ariaLabel}
            onFocus={() => setDraft(format(value))}
            onChange={(e) => {
                const raw = e.target.value;
                setDraft(raw);
                const n = parseNum(raw);
                if (n != null)
                    onChange(n);
            }}
            onBlur={() => setDraft(null)}
        />
    );
}

function NumCell({
    value,
    editable,
    onChange,
    className,
    ariaLabel,
    format,
    foot = false,
}: {
    value: number;
    editable?: boolean;
    onChange: (next: number) => void;
    className?: string;
    ariaLabel: string;
    format: (n: number) => string;
    foot?: boolean;
}) {
    if (!editable)
        return <td className={className}>{format(value)}</td>;
    return (
        <td className={className}>
            <NumInput value={value} onChange={onChange} ariaLabel={ariaLabel} format={format} foot={foot} />
        </td>
    );
}

type DetailRef = { key: string; line: CombinedReportLine; projectIndex: number; lineIndex: number };

function detailRefs(report: CombinedReportSnapshot): DetailRef[] {
    return report.projects
        .flatMap((project, projectIndex) => project.lines.map((line, lineIndex) => ({
            key: `${projectIndex}-${lineIndex}`,
            line,
            projectIndex,
            lineIndex,
        })))
        .sort((a, b) => a.line.date.localeCompare(b.line.date)
            || (a.line.initials || a.line.user).localeCompare(b.line.initials || b.line.user));
}

export function CombinedReportPage({ report, pageNumber, pageIndex = 0, editable = false, onChange }: Props) {
    const cur = report.currency || 'USD';
    const invoiced = report.totalFees + report.totalExpenses;
    const slices = planCombinedReportPreviewPages(report);
    const slice = slices[Math.max(0, Math.min(pageIndex, slices.length - 1))] ?? slices[0]!;
    const emit = (next: CombinedReportSnapshot) => onChange?.(next);
    const patchLine = (projectIndex: number, lineIndex: number, patch: Partial<CombinedReportLine>) => {
        emit({
            ...report,
            projects: report.projects.map((project, pi) => pi !== projectIndex
                ? project
                : {
                    ...project,
                    lines: project.lines.map((line, li) => li === lineIndex ? { ...line, ...patch } : line),
                }),
        });
    };
    const showTime = slice.showTimeTotal || slice.timeTo > slice.timeFrom;
    const showPeople = slice.showPeopleTotal || slice.peopleTo > slice.peopleFrom;
    const showExpenses = slice.showExpensesTotal || slice.expensesTo > slice.expensesFrom;
    const showShares = slice.showSharesTotal || slice.sharesTo > slice.sharesFrom;
    const timeRows = detailRefs(report).slice(slice.timeFrom, slice.timeTo);
    if (slice.projectIndex >= 0) {
        const project = report.projects[slice.projectIndex];
        const projectLines = [...(project?.lines ?? [])].sort((a, b) => a.date.localeCompare(b.date)
            || (a.initials || a.user).localeCompare(b.initials || b.user));
        const visibleLines = projectLines.slice(slice.timeFrom, slice.timeTo);
        const title = project?.pageTitle?.trim() || `${report.feeTitle} (${project?.name ?? ''})`;
        const peopleByKey = new Map<string, { initials: string; name: string; title: string; hours: number; amount: number }>();
        for (const line of projectLines) {
            const key = `${line.initials || ''}|${line.user}`;
            const prev = peopleByKey.get(key) ?? {
                initials: line.initials || line.user,
                name: line.user,
                title: report.people.find((person) => person.initials === line.initials || person.name === line.user)?.title || '—',
                hours: 0,
                amount: 0,
            };
            prev.hours += line.hours;
            prev.amount += line.amount;
            peopleByKey.set(key, prev);
        }
        const projectPeople = [...peopleByKey.values()];
        const projectHours = projectLines.reduce((sum, line) => sum + line.hours, 0);
        const projectFees = projectLines.reduce((sum, line) => sum + line.amount, 0);
        return (
            <div className={`tt-inv-tr${editable ? ' tt-inv-tr--editable' : ''}`}>
                <div className="tt-inv-tr__top">
                    <span className="tt-inv-tr__confidential">Private and confidential</span>
                </div>
                <hr className="tt-inv-tr__rule" />
                {slice.showMasthead ? (
                    editable ? (
                        <textarea
                            className="tt-inv-tr__title"
                            value={title}
                            aria-label="Fees for services"
                            rows={2}
                            onChange={(e) => emit({
                                ...report,
                                projects: report.projects.map((row, index) => index === slice.projectIndex
                                    ? { ...row, pageTitle: e.target.value }
                                    : row),
                            })}
                        />
                    ) : <h1 className="tt-inv-tr__title">{title}</h1>
                ) : null}
                {showTime ? (
                    <div className="tt-inv-tr__table-wrap">
                        <table className="tt-inv-tr__table">
                            <thead className="tt-inv-tr__thead">
                                <tr>
                                    <th>Date</th>
                                    <th>Initials</th>
                                    <th>Task</th>
                                    <th>Description</th>
                                    <th className="num">Hours</th>
                                    <th className="num">Rate</th>
                                    <th className="num">Amount ({cur})</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleLines.map((line) => {
                                    const lineIndex = project?.lines.indexOf(line) ?? -1;
                                    return (
                                        <tr key={`${line.date}-${line.initials}-${lineIndex}`}>
                                            <TextCell editable={editable} ariaLabel="Date" value={dateRu(line.date)} onChange={(v) => patchLine(slice.projectIndex, lineIndex, { date: commitDate(v) })} />
                                            <TextCell editable={editable} ariaLabel="Initials" value={line.initials || line.user} onChange={(v) => patchLine(slice.projectIndex, lineIndex, { initials: v })} />
                                            <TextCell editable={editable} ariaLabel="Task" value={line.task || ''} onChange={(v) => patchLine(slice.projectIndex, lineIndex, { task: v })} />
                                            <TextCell editable={editable} ariaLabel="Description" value={line.description} onChange={(v) => patchLine(slice.projectIndex, lineIndex, { description: v })} />
                                            <NumCell editable={editable} className="num" ariaLabel="Hours" value={line.hours} format={formatTimeReportHours} onChange={(v) => patchLine(slice.projectIndex, lineIndex, { hours: v })} />
                                            <td className="num">{formatTimeReportHours(line.rate ?? (line.hours > 0 ? line.amount / line.hours : 0))}</td>
                                            <NumCell editable={editable} className="num" ariaLabel="Amount" value={line.amount} format={(n) => formatTimeReportHours(n)} onChange={(v) => patchLine(slice.projectIndex, lineIndex, { amount: v })} />
                                        </tr>
                                    );
                                })}
                            </tbody>
                            {slice.showTimeTotal ? (
                                <tfoot>
                                    <tr>
                                        <td colSpan={4}>Total ({cur})</td>
                                        <td className="num">{formatTimeReportHours(projectHours)}</td>
                                        <td />
                                        <td className="num">{formatTimeReportAmount(projectFees, cur)}</td>
                                    </tr>
                                </tfoot>
                            ) : null}
                        </table>
                    </div>
                ) : null}
                {slice.showPeopleTotal ? (
                    <div className="tt-inv-tr__table-wrap">
                        <table className="tt-inv-tr__table">
                            <thead className="tt-inv-tr__thead">
                                <tr>
                                    <th>Initials</th>
                                    <th>Name</th>
                                    <th>Title</th>
                                    <th className="num">Hours</th>
                                    <th className="num">Rate ({cur})</th>
                                    <th className="num">Amount ({cur})</th>
                                </tr>
                            </thead>
                            <tbody>
                                {projectPeople.map((person) => (
                                    <tr key={person.initials + person.name}>
                                        <td>{person.initials}</td>
                                        <td>{person.name}</td>
                                        <td>{person.title}</td>
                                        <td className="num">{formatTimeReportHours(person.hours)}</td>
                                        <td className="num">{formatTimeReportHours(person.hours > 0 ? person.amount / person.hours : 0)}</td>
                                        <td className="num">{formatTimeReportHours(person.amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan={3}>Total ({cur})</td>
                                    <td className="num">{formatTimeReportHours(projectHours)}</td>
                                    <td />
                                    <td className="num">{formatTimeReportAmount(projectFees, cur)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                ) : null}
                <footer className="tt-inv-tr__bottom">
                    <div className="tt-inv-tr__bottom-line" aria-hidden />
                    <div className="tt-inv-tr__bottom-meta">
                        <span className="tt-inv-tr__page-box">{pageNumber}</span>
                    </div>
                </footer>
            </div>
        );
    }
    return (
        <div className={`tt-inv-tr tt-inv-creport${editable ? ' tt-inv-tr--editable' : ''}`}>
            {slice.showMasthead ? (
                <header className="tt-inv-creport__head">
                    <img className="tt-inv-creport__logo" src={coverLetterheadLogoUrl()} alt="KOSTA LEGAL" />
                    <address>
                        {KOSTA_LEGAL_LETTERHEAD_LINES.map((line) => <span key={line}>{line}</span>)}
                    </address>
                </header>
            ) : null}
            {slice.showMasthead
                ? (editable
                    ? (
                        <textarea
                            className="tt-inv-creport__lead-input"
                            value={report.feeTitle}
                            aria-label="Fees for services"
                            rows={3}
                            onChange={(e) => emit({ ...report, feeTitle: e.target.value })}
                        />
                    )
                    : <p className="tt-inv-creport__lead">{report.feeTitle}</p>)
                : null}
            {showTime ? (
            <section className="tt-inv-creport__block">
                <table className="tt-inv-creport__time">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Initials</th>
                            <th>Task</th>
                            <th>Description</th>
                            <th className="num">Hours</th>
                            <th className="num">Amount ({cur})</th>
                        </tr>
                    </thead>
                    <tbody>
                        {timeRows.map(({ key, line, projectIndex, lineIndex }) => (
                            <tr key={key}>
                                <TextCell
                                    editable={editable}
                                    className=""
                                    ariaLabel="Date"
                                    value={dateRu(line.date)}
                                    onChange={(v) => patchLine(projectIndex, lineIndex, { date: commitDate(v) })}
                                />
                                <TextCell
                                    editable={editable}
                                    ariaLabel="Initials"
                                    value={line.initials || line.user}
                                    onChange={(v) => patchLine(projectIndex, lineIndex, { initials: v })}
                                />
                                <TextCell
                                    editable={editable}
                                    ariaLabel="Task"
                                    value={line.task || ''}
                                    onChange={(v) => patchLine(projectIndex, lineIndex, { task: v })}
                                />
                                <TextCell
                                    editable={editable}
                                    ariaLabel="Description"
                                    value={line.description}
                                    onChange={(v) => patchLine(projectIndex, lineIndex, { description: v })}
                                />
                                <NumCell
                                    editable={editable}
                                    className="num"
                                    ariaLabel="Hours"
                                    value={line.hours}
                                    format={hours}
                                    onChange={(v) => patchLine(projectIndex, lineIndex, { hours: v })}
                                />
                                <NumCell
                                    editable={editable}
                                    className="num"
                                    ariaLabel="Amount"
                                    value={line.amount}
                                    format={money}
                                    onChange={(v) => patchLine(projectIndex, lineIndex, { amount: v })}
                                />
                            </tr>
                        ))}
                    </tbody>
                    {slice.showTimeTotal ? (
                    <tfoot>
                        <tr>
                            <td colSpan={4}>Total</td>
                            <NumCell
                                editable={editable}
                                foot
                                className="num"
                                ariaLabel="Total hours"
                                value={report.totalHours}
                                format={hours}
                                onChange={(v) => emit({ ...report, totalHours: v })}
                            />
                            <NumCell
                                editable={editable}
                                foot
                                className="num"
                                ariaLabel="Total amount"
                                value={report.totalFees}
                                format={money}
                                onChange={(v) => emit({ ...report, totalFees: v })}
                            />
                        </tr>
                    </tfoot>
                    ) : null}
                </table>
            </section>
            ) : null}
            {showPeople ? (
            <section className="tt-inv-creport__block">
                <h2>Summary of Services</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Initials</th>
                            <th>Name</th>
                            <th>Title</th>
                            <th className="num">Rate</th>
                            <th className="num">Hours</th>
                            <th className="num">Rate ({cur})</th>
                            <th className="num">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {report.people.slice(Math.max(0, slice.peopleFrom), Math.max(0, slice.peopleTo)).map((person, offset) => {
                            const index = Math.max(0, slice.peopleFrom) + offset;
                            return (
                            <tr key={`person-${index}`}>
                                <TextCell editable={editable} ariaLabel="Initials" value={person.initials} onChange={(v) => emit({
                                    ...report,
                                    people: report.people.map((row, i) => i === index ? { ...row, initials: v } : row),
                                })}
                                />
                                <TextCell editable={editable} ariaLabel="Name" value={person.name} onChange={(v) => emit({
                                    ...report,
                                    people: report.people.map((row, i) => i === index ? { ...row, name: v } : row),
                                })}
                                />
                                <TextCell editable={editable} ariaLabel="Title" value={person.title} onChange={(v) => emit({
                                    ...report,
                                    people: report.people.map((row, i) => i === index ? { ...row, title: v } : row),
                                })}
                                />
                                <NumCell editable={editable} className="num" ariaLabel="Rate" value={person.rate} format={money} onChange={(v) => emit({
                                    ...report,
                                    people: report.people.map((row, i) => i === index ? { ...row, rate: v } : row),
                                })}
                                />
                                <NumCell editable={editable} className="num" ariaLabel="Hours" value={person.hours} format={hours} onChange={(v) => emit({
                                    ...report,
                                    people: report.people.map((row, i) => i === index ? { ...row, hours: v } : row),
                                })}
                                />
                                <NumCell editable={editable} className="num" ariaLabel="Rate" value={person.rate} format={money} onChange={(v) => emit({
                                    ...report,
                                    people: report.people.map((row, i) => i === index ? { ...row, rate: v } : row),
                                })}
                                />
                                <NumCell editable={editable} className="num" ariaLabel="Amount" value={person.amount} format={money} onChange={(v) => emit({
                                    ...report,
                                    people: report.people.map((row, i) => i === index ? { ...row, amount: v } : row),
                                })}
                                />
                            </tr>
                            );
                        })}
                    </tbody>
                    {slice.showPeopleTotal ? (
                    <tfoot>
                        <tr>
                            <td colSpan={4}>Total</td>
                            <NumCell
                                editable={editable}
                                foot
                                className="num"
                                ariaLabel="Summary hours"
                                value={report.totalHours}
                                format={hours}
                                onChange={(v) => emit({ ...report, totalHours: v })}
                            />
                            <td />
                            <NumCell
                                editable={editable}
                                foot
                                className="num"
                                ariaLabel="Summary amount"
                                value={report.totalFees}
                                format={money}
                                onChange={(v) => emit({ ...report, totalFees: v })}
                            />
                        </tr>
                    </tfoot>
                    ) : null}
                </table>
            </section>
            ) : null}
            {showExpenses ? (
            <section className="tt-inv-creport__block">
                <h2>Reimbursable Expenses via</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Description</th>
                            <th>Email date</th>
                            <th className="num">Amount ({cur})</th>
                        </tr>
                    </thead>
                    <tbody>
                        {report.expenses.slice(Math.max(0, slice.expensesFrom), Math.max(0, slice.expensesTo)).map((line, offset) => {
                            const index = Math.max(0, slice.expensesFrom) + offset;
                            return (
                            <tr key={`expense-${index}`}>
                                <TextCell editable={editable} ariaLabel="Description" value={line.description} onChange={(v) => emit({
                                    ...report,
                                    expenses: report.expenses.map((row, i) => i === index ? { ...row, description: v } : row),
                                })}
                                />
                                <TextCell editable={editable} ariaLabel="Email date" value={dateRu(line.date)} onChange={(v) => emit({
                                    ...report,
                                    expenses: report.expenses.map((row, i) => i === index ? { ...row, date: commitDate(v) } : row),
                                })}
                                />
                                <NumCell editable={editable} className="num" ariaLabel="Amount" value={line.amount} format={money} onChange={(v) => emit({
                                    ...report,
                                    expenses: report.expenses.map((row, i) => i === index ? { ...row, amount: v } : row),
                                })}
                                />
                            </tr>
                            );
                        })}
                    </tbody>
                    {slice.showExpensesTotal ? (
                    <tfoot>
                        <tr>
                            <td colSpan={2}>Subtotal</td>
                            <NumCell
                                editable={editable}
                                foot
                                className="num"
                                ariaLabel="Expenses subtotal"
                                value={report.totalExpenses}
                                format={money}
                                onChange={(v) => emit({ ...report, totalExpenses: v })}
                            />
                        </tr>
                    </tfoot>
                    ) : null}
                </table>
            </section>
            ) : null}
            {showShares ? (
            <section className="tt-inv-creport__block">
                <p className="tt-inv-creport__cur">{cur}</p>
                <table className="tt-inv-creport__shares">
                    <colgroup>
                        <col className="name" />
                        <col className="pct" />
                        <col className="num" />
                        <col className="num" />
                    </colgroup>
                    <thead>
                        <tr>
                            <th colSpan={2}>Shared amounts</th>
                            <th className="num">Reimbursable expenses</th>
                            <th className="num">TO BE INVOICED:</th>
                        </tr>
                    </thead>
                    <tbody>
                        {report.shares.slice(Math.max(0, slice.sharesFrom), Math.max(0, slice.sharesTo)).map((share, offset) => {
                            const index = Math.max(0, slice.sharesFrom) + offset;
                            return (
                            <tr key={`share-${index}`}>
                                <td>
                                    {editable
                                        ? (
                                            <input
                                                type="text"
                                                className="tt-inv-tr__cell-input"
                                                value={share.name}
                                                aria-label="Shared amount name"
                                                onChange={(e) => emit({
                                                    ...report,
                                                    shares: report.shares.map((row, i) => i === index ? { ...row, name: e.target.value } : row),
                                                })}
                                            />
                                        )
                                        : share.name}
                                </td>
                                <td className="num">
                                    {editable
                                        ? (
                                            <NumInput
                                                value={share.percent}
                                                ariaLabel="Percent"
                                                format={(n) => n.toFixed(2)}
                                                onChange={(v) => emit({
                                                    ...report,
                                                    shares: report.shares.map((row, i) => i === index ? { ...row, percent: v } : row),
                                                })}
                                            />
                                        )
                                        : `${share.percent.toFixed(2)}%`}
                                </td>
                                {editable
                                    ? (
                                        <NumCell
                                            editable
                                            className="num"
                                            ariaLabel="Reimbursable expenses"
                                            value={share.expenses ?? 0}
                                            format={money}
                                            onChange={(v) => emit({
                                                ...report,
                                                shares: report.shares.map((row, i) => i === index ? { ...row, expenses: v } : row),
                                            })}
                                        />
                                    )
                                    : <td className="num">{shareExpenseText(share.expenses)}</td>}
                                <NumCell
                                    editable={editable}
                                    className="num"
                                    ariaLabel="To be invoiced"
                                    value={share.total}
                                    format={money}
                                    onChange={(v) => emit({
                                        ...report,
                                        shares: report.shares.map((row, i) => i === index ? { ...row, total: v } : row),
                                    })}
                                />
                            </tr>
                            );
                        })}
                    </tbody>
                    {slice.showSharesTotal ? (
                    <tfoot>
                        <tr>
                            <td>Total</td>
                            <td className="num">100%</td>
                            <td className="num">{money(invoiced)}</td>
                            <td className="num">{money(invoiced)}</td>
                        </tr>
                    </tfoot>
                    ) : null}
                </table>
            </section>
            ) : null}
            <footer className="tt-inv-tr__bottom">
                <div className="tt-inv-tr__bottom-line" aria-hidden />
                <div className="tt-inv-tr__bottom-meta">
                    <span className="tt-inv-tr__page-box">{pageNumber}</span>
                </div>
            </footer>
        </div>
    );
}
