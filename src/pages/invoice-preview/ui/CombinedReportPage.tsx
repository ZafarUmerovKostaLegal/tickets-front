import { useState, type ChangeEvent } from 'react';
import { KOSTA_LEGAL_LETTERHEAD_LINES } from '../lib/invoiceCoverLetterModel';
import { coverLetterheadLogoUrl } from '../lib/invoiceCoverLogoRaster';
import type { CombinedReportLine, CombinedReportSnapshot } from '@pages/time-tracking/lib/combinedInvoice';
import './InvoiceTimeReportPage.css';

type Props = {
    report: CombinedReportSnapshot;
    pageNumber: number;
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

export function CombinedReportPage({ report, pageNumber, editable = false, onChange }: Props) {
    const cur = report.currency || 'USD';
    const invoiced = report.totalFees + report.totalExpenses;
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
    return (
        <div className={`tt-inv-tr tt-inv-creport${editable ? ' tt-inv-tr--editable' : ''}`}>
            <header className="tt-inv-creport__head">
                <img className="tt-inv-creport__logo" src={coverLetterheadLogoUrl()} alt="KOSTA LEGAL" />
                <address>
                    {KOSTA_LEGAL_LETTERHEAD_LINES.map((line) => <span key={line}>{line}</span>)}
                </address>
            </header>
            {editable
                ? (
                    <textarea
                        className="tt-inv-creport__lead-input"
                        value={report.feeTitle}
                        aria-label="Fees for services"
                        rows={3}
                        onChange={(e) => emit({ ...report, feeTitle: e.target.value })}
                    />
                )
                : <p className="tt-inv-creport__lead">{report.feeTitle}</p>}
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
                        {detailRefs(report).map(({ key, line, projectIndex, lineIndex }) => (
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
                </table>
            </section>
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
                        {report.people.map((person, index) => (
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
                        ))}
                    </tbody>
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
                </table>
            </section>
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
                        {report.expenses.map((line, index) => (
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
                        ))}
                    </tbody>
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
                </table>
            </section>
            <section className="tt-inv-creport__block">
                <p className="tt-inv-creport__cur">{cur}</p>
                <table className="tt-inv-creport__shares">
                    <colgroup>
                        <col className="name" />
                        <col className="num" />
                        <col className="num" />
                    </colgroup>
                    <thead>
                        <tr>
                            <th>Shared amounts</th>
                            <th className="num">Reimbursable expenses</th>
                            <th className="num">TO BE INVOICED</th>
                        </tr>
                    </thead>
                    <tbody>
                        {report.shares.map((share, index) => (
                            <tr key={`share-${index}`}>
                                <td className="tt-inv-creport__share">
                                    {editable
                                        ? (
                                            <>
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
                                                <NumInput
                                                    value={share.percent}
                                                    ariaLabel="Percent"
                                                    format={(n) => n.toFixed(2)}
                                                    onChange={(v) => emit({
                                                        ...report,
                                                        shares: report.shares.map((row, i) => i === index ? { ...row, percent: v } : row),
                                                    })}
                                                />
                                            </>
                                        )
                                        : (
                                            <>
                                                <span>{share.name}</span>
                                                <span className="tt-inv-creport__share-pct">{share.percent.toFixed(2)}%</span>
                                            </>
                                        )}
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
                        ))}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td className="tt-inv-creport__share"><span>Total</span><span className="tt-inv-creport__share-pct">100%</span></td>
                            <td className="num">{cur} {money(invoiced)}</td>
                            <td className="num">{money(invoiced)}</td>
                        </tr>
                    </tfoot>
                </table>
            </section>
            <footer className="tt-inv-tr__bottom">
                <div className="tt-inv-tr__bottom-line" aria-hidden />
                <div className="tt-inv-tr__bottom-meta">
                    <span className="tt-inv-tr__page-box">{pageNumber}</span>
                </div>
            </footer>
        </div>
    );
}
