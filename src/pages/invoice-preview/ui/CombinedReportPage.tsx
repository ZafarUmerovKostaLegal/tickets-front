import { KOSTA_LEGAL_FIRM } from '../lib/invoiceCoverLetterModel';
import { coverLetterheadLogoUrl } from '../lib/invoiceCoverLogoRaster';
import type { CombinedReportSnapshot } from '@pages/time-tracking/lib/combinedInvoice';
import './InvoiceTimeReportPage.css';

type Props = {
    report: CombinedReportSnapshot;
    pageNumber: number;
};

function money(n: number): string {
    const [whole, frac] = n.toFixed(2).split('.');
    return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}.${frac}`;
}

function hours(n: number): string {
    return n.toFixed(2);
}

function dateRu(iso: string): string {
    const day = iso.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day))
        return iso;
    const [y, m, d] = day.split('-');
    return `${d}.${m}.${y}`;
}

export function CombinedReportPage({ report, pageNumber }: Props) {
    const cur = report.currency || 'USD';
    const invoiced = report.totalFees + report.totalExpenses;
    return (
        <div className="tt-inv-tr tt-inv-creport">
            <header className="tt-inv-creport__head">
                <img className="tt-inv-creport__logo" src={coverLetterheadLogoUrl()} alt="KOSTA LEGAL" />
                <address>
                    <span>{KOSTA_LEGAL_FIRM.addressLine}</span>
                    <span>{KOSTA_LEGAL_FIRM.phone}</span>
                    <span>{KOSTA_LEGAL_FIRM.email}</span>
                    <span>{KOSTA_LEGAL_FIRM.web}</span>
                </address>
            </header>
            <p className="tt-inv-creport__lead">{report.feeTitle}</p>
            {report.projects.map((project) => {
                const projectHours = project.lines.reduce((sum, line) => sum + line.hours, 0);
                const projectAmount = project.lines.reduce((sum, line) => sum + line.amount, 0);
                return (
                    <section key={project.name} className="tt-inv-creport__block">
                        <h2>Sub-project name: {project.name}</h2>
                        <table>
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>User</th>
                                    <th>Description</th>
                                    <th className="num">Hours</th>
                                    <th className="num">Amount ({cur})</th>
                                </tr>
                            </thead>
                            <tbody>
                                {project.lines.map((line, index) => (
                                    <tr key={`${project.name}-${index}`}>
                                        <td>{dateRu(line.date)}</td>
                                        <td>{line.user}</td>
                                        <td>{line.description}</td>
                                        <td className="num">{hours(line.hours)}</td>
                                        <td className="num">{money(line.amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan={3}>Total</td>
                                    <td className="num">{hours(projectHours)}</td>
                                    <td className="num">{money(projectAmount)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </section>
                );
            })}
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
                        {report.people.map((person) => (
                            <tr key={person.initials + person.name}>
                                <td>{person.initials}</td>
                                <td>{person.name}</td>
                                <td>{person.title}</td>
                                <td className="num">{money(person.rate)}</td>
                                <td className="num">{hours(person.hours)}</td>
                                <td className="num">{money(person.rate)}</td>
                                <td className="num">{money(person.amount)}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colSpan={4}>Total</td>
                            <td className="num">{hours(report.totalHours)}</td>
                            <td />
                            <td className="num">{money(report.totalFees)}</td>
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
                            <tr key={`${line.date}-${index}`}>
                                <td>{line.description}</td>
                                <td>{dateRu(line.date)}</td>
                                <td className="num">{money(line.amount)}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colSpan={2}>Subtotal</td>
                            <td className="num">{money(report.totalExpenses)}</td>
                        </tr>
                    </tfoot>
                </table>
            </section>
            <section className="tt-inv-creport__block">
                <p className="tt-inv-creport__cur">{cur}</p>
                <table>
                    <thead>
                        <tr>
                            <th>Shared amounts</th>
                            <th className="num">Reimbursable expenses</th>
                            <th className="num">TO BE INVOICED</th>
                        </tr>
                    </thead>
                    <tbody>
                        {report.shares.map((share) => (
                            <tr key={share.name}>
                                <td className="tt-inv-creport__share">
                                    <span>{share.name}</span>
                                    <span>{share.percent.toFixed(2)}%</span>
                                </td>
                                <td className="num">{money(share.total)}</td>
                                <td className="num">{money(share.total)}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td className="tt-inv-creport__share"><span /><span>100%</span></td>
                            <td className="num">{money(invoiced)}</td>
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
