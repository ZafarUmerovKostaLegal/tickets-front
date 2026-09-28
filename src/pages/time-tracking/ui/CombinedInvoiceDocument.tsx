import { KOSTA_LEGAL_LETTERHEAD_LINES } from '@pages/invoice-preview/lib/invoiceCoverLetterModel';
import { coverLetterheadLogoUrl } from '@pages/invoice-preview/lib/invoiceCoverLogoRaster';
import type { TimeManagerClientProjectRow, TimeTrackingUserRow } from '@entities/time-tracking';
import { combinedTimeTaskAndNotes, type CombinedExpenseLine, type CombinedShare, type CombinedTimeLine } from '../lib/combinedInvoice';

type Props = {
    feeTitle: string;
    payerName: string;
    from: string;
    to: string;
    currency: string;
    projects: TimeManagerClientProjectRow[];
    time: CombinedTimeLine[];
    expenses: CombinedExpenseLine[];
    shares: CombinedShare[];
    users: TimeTrackingUserRow[];
    totalHours: number;
    totalFees: number;
    totalExp: number;
    onClose: () => void;
};

function money(n: number): string {
    const [whole, frac] = n.toFixed(2).split('.');
    return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}.${frac}`;
}

function fmtHours(n: number): string {
    return n.toFixed(2);
}

function initialsOf(name: string, stored: string | null | undefined): string {
    const saved = stored?.trim();
    if (saved)
        return saved;
    const letters = name.split(/\s+/).filter(Boolean).map((part) => part[0] ?? '').join('');
    return letters.toUpperCase().slice(0, 4) || '—';
}

function dateRu(iso: string): string {
    const day = iso.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day))
        return iso;
    const [y, m, d] = day.split('-');
    return `${d}.${m}.${y}`;
}

export function CombinedInvoiceDocument({
    feeTitle,
    payerName,
    from,
    to,
    currency,
    time,
    expenses,
    shares,
    users,
    totalHours,
    totalFees,
    totalExp,
    onClose,
}: Props) {
    const userById = new Map(users.map((user) => [user.id, user]));
    const summary = new Map<number, { hours: number; amount: number }>();
    for (const line of time) {
        const prev = summary.get(line.authUserId) ?? { hours: 0, amount: 0 };
        prev.hours += line.billableHours ?? line.hours;
        prev.amount += line.billableAmount;
        summary.set(line.authUserId, prev);
    }
    const people = [...summary.entries()].map(([id, totals]) => {
        const user = userById.get(id);
        const rate = totals.hours > 0 ? totals.amount / totals.hours : 0;
        return {
            id,
            initials: initialsOf(user?.display_name?.trim() || user?.email?.trim() || String(id), user?.initials),
            name: user?.display_name?.trim() || user?.email?.trim() || String(id),
            title: user?.position?.trim() || '—',
            hours: totals.hours,
            rate,
            amount: totals.amount,
        };
    });
    const lead = feeTitle.trim()
        || `Fees for services ${dateRu(from)} — ${dateRu(to)} for ${payerName}`;

    return (
        <div className="tt-inv-cdoc-overlay" role="dialog" aria-modal="true" aria-label="Сводный отчёт">
            <div className="tt-inv-cdoc-toolbar">
                <button type="button" className="tt-reports__btn tt-reports__btn--outline" onClick={() => window.print()}>Печать / PDF</button>
                <button type="button" className="tt-reports__btn tt-reports__btn--accent" onClick={onClose}>Закрыть</button>
            </div>
            <article className="tt-inv-cdoc">
                <header className="tt-inv-cdoc__head">
                    <img className="tt-inv-cdoc__logo" src={coverLetterheadLogoUrl()} alt="KOSTA LEGAL" />
                    <address>
                        {KOSTA_LEGAL_LETTERHEAD_LINES.map((line) => <span key={line}>{line}</span>)}
                    </address>
                </header>
                <p className="tt-inv-cdoc__lead">{lead}</p>
                <section className="tt-inv-cdoc__block">
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Initials</th>
                                <th>Task</th>
                                <th>Description</th>
                                <th className="num">Hours</th>
                                <th className="num">Amount ({currency})</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[...time].sort((a, b) => a.workDate.localeCompare(b.workDate)).map((line) => {
                                const user = userById.get(line.authUserId);
                                const name = user?.display_name?.trim() || user?.email?.trim() || String(line.authUserId);
                                const split = combinedTimeTaskAndNotes(line.description);
                                return (
                                    <tr key={line.id}>
                                        <td>{dateRu(line.workDate)}</td>
                                        <td>{initialsOf(name, user?.initials)}</td>
                                        <td>{split.task}</td>
                                        <td>{split.description}</td>
                                        <td className="num">{fmtHours(line.billableHours ?? line.hours)}</td>
                                        <td className="num">{money(line.billableAmount)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colSpan={4}>Total</td>
                                <td className="num">{fmtHours(totalHours)}</td>
                                <td className="num">{money(totalFees)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </section>
                <section className="tt-inv-cdoc__block">
                    <h2>Summary of Services</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>Initials</th>
                                <th>Name</th>
                                <th>Title</th>
                                <th className="num">Rate</th>
                                <th className="num">Hours</th>
                                <th className="num">Rate ({currency})</th>
                                <th className="num">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {people.map((person) => (
                                <tr key={person.id}>
                                    <td>{person.initials}</td>
                                    <td>{person.name}</td>
                                    <td>{person.title}</td>
                                    <td className="num">{money(person.rate)}</td>
                                    <td className="num">{fmtHours(person.hours)}</td>
                                    <td className="num">{money(person.rate)}</td>
                                    <td className="num">{money(person.amount)}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colSpan={4}>Total</td>
                                <td className="num">{fmtHours(totalHours)}</td>
                                <td />
                                <td className="num">{money(totalFees)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </section>
                <section className="tt-inv-cdoc__block">
                    <h2>Reimbursable Expenses via</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>Description</th>
                                <th>Email date</th>
                                <th className="num">Amount ({currency})</th>
                            </tr>
                        </thead>
                        <tbody>
                            {expenses.map((line) => (
                                <tr key={line.id}>
                                    <td>{line.description || '—'}</td>
                                    <td>{dateRu(line.expenseDate)}</td>
                                    <td className="num">{money(line.equivalentAmount)}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colSpan={2}>Subtotal</td>
                                <td className="num">{money(totalExp)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </section>
                <section className="tt-inv-cdoc__block">
                    <p className="tt-inv-cdoc__cur">{currency}</p>
                    <table className="tt-inv-cdoc__shares">
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
                            {shares.map((share) => (
                                <tr key={share.projectId}>
                                    <td className="tt-inv-cdoc__share">
                                        <span>{share.projectName}</span>
                                        <span className="tt-inv-cdoc__pct">{share.percent.toFixed(2)}%</span>
                                    </td>
                                    <td className="num">{Math.abs(share.expenses) < 0.005 ? '-' : money(share.expenses)}</td>
                                    <td className="num">{money(share.total)}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td className="tt-inv-cdoc__share"><span>Total</span><span className="tt-inv-cdoc__pct">100%</span></td>
                                <td className="num">{currency} {money(totalFees + totalExp)}</td>
                                <td className="num">{money(totalFees + totalExp)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </section>
            </article>
        </div>
    );
}
