import { useEffect, useMemo, useState } from 'react';
import {
    createInvoice,
    ensureInvoiceFxRatesForBilling,
    fetchUnbilledExpenses,
    fetchUnbilledTimeEntries,
    isForbiddenError,
    listTimeTrackingUsers,
    pickUserDisplayLabel,
    type TimeManagerClientProjectRow,
    type TimeManagerClientRow,
    type TimeTrackingUserRow,
} from '@entities/time-tracking';
import { DatePicker } from '@shared/ui/DatePicker';
import { SearchableSelect } from '@shared/ui/SearchableSelect';
import { invoiceClientDescription } from '../lib/invoiceClientDescription';
import {
    buildCombinedShares,
    formatCombinedShareNote,
    loadCombinedInvoiceTemplates,
    saveCombinedInvoiceTemplates,
    type CombinedAllocation,
    type CombinedExpenseLine,
    type CombinedInvoiceTemplate,
    type CombinedTimeLine,
} from '../lib/combinedInvoice';
import { addDaysIso, firstOfMonthIso, lastOfMonthIso, todayIso } from '../lib/invoicePageShared';
import {
    assertNoApprovedUnpaidProjectExpenses,
    formatUnpaidExpenseListLines,
    isProjectUnpaidExpensesError,
} from '../lib/projectUnpaidExpenses';

type Props = {
    clients: TimeManagerClientRow[];
    projects: TimeManagerClientProjectRow[];
    onCreated: (invoiceId: string) => void;
    onError: (message: string) => void;
};

export function CombinedInvoicePanel({ clients, projects, onCreated, onError }: Props) {
    const [payerId, setPayerId] = useState('');
    const [projectIds, setProjectIds] = useState<string[]>([]);
    const [query, setQuery] = useState('');
    const [allocation, setAllocation] = useState<CombinedAllocation>('hours');
    const [from, setFrom] = useState(firstOfMonthIso());
    const [to, setTo] = useState(lastOfMonthIso());
    const [issueDate, setIssueDate] = useState(todayIso());
    const [dueDate, setDueDate] = useState(addDaysIso(30));
    const [number, setNumber] = useState('');
    const [feeTitle, setFeeTitle] = useState('');
    const [time, setTime] = useState<CombinedTimeLine[]>([]);
    const [expenses, setExpenses] = useState<CombinedExpenseLine[]>([]);
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [preview, setPreview] = useState(false);
    const [users, setUsers] = useState<TimeTrackingUserRow[]>([]);
    const [templates, setTemplates] = useState<CombinedInvoiceTemplate[]>(() => loadCombinedInvoiceTemplates());
    const [templateId, setTemplateId] = useState('');
    const [templateName, setTemplateName] = useState('');
    const [loadNote, setLoadNote] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        void listTimeTrackingUsers()
            .then((rows) => {
                if (!cancelled)
                    setUsers(rows);
            })
            .catch(() => {
                if (!cancelled)
                    setUsers([]);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const clientName = useMemo(() => new Map(clients.map((client) => [client.id, client.name])), [clients]);
    const userName = useMemo(() => {
        const map = new Map<number, string>();
        for (const user of users)
            map.set(user.id, pickUserDisplayLabel(user.display_name, user.email, user.id));
        return map;
    }, [users]);
    const selectedProjects = useMemo(
        () => projectIds
            .map((id) => projects.find((project) => project.id === id))
            .filter((project): project is TimeManagerClientProjectRow => Boolean(project)),
        [projectIds, projects],
    );
    const visibleProjects = projects.filter((project) => {
        const q = query.trim().toLocaleLowerCase('ru');
        if (!q)
            return true;
        const client = clientName.get(project.client_id) ?? '';
        return `${project.name} ${project.code ?? ''} ${client}`.toLocaleLowerCase('ru').includes(q);
    });
    const shares = useMemo(
        () => buildCombinedShares(selectedProjects, clientName, time, expenses, allocation),
        [allocation, clientName, expenses, selectedProjects, time],
    );
    const totalHours = time.reduce((sum, line) => sum + (line.billableHours ?? line.hours), 0);
    const totalFees = time.reduce((sum, line) => sum + line.billableAmount, 0);
    const totalExp = expenses.reduce((sum, line) => sum + line.equivalentAmount, 0);
    const currency = time.find((line) => line.currency)?.currency ?? 'USD';

    useEffect(() => {
        if (payerId)
            return;
        const ids = [...new Set(selectedProjects.map((project) => project.client_id).filter(Boolean))];
        if (ids.length === 1)
            setPayerId(ids[0]!);
    }, [payerId, selectedProjects]);

    const toggleProject = (id: string) => {
        setProjectIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
    };

    const loadLines = async () => {
        if (projectIds.length === 0) {
            onError('Выберите хотя бы один проект.');
            return;
        }
        setLoading(true);
        setLoadNote(null);
        try {
            const packs = await Promise.all(projectIds.map(async (projectId) => {
                const label = projects.find((project) => project.id === projectId)?.name ?? projectId;
                try {
                    const [timeRows, expenseRows] = await Promise.all([
                        fetchUnbilledTimeEntries({ projectId, dateFrom: from, dateTo: to }),
                        fetchUnbilledExpenses({ projectId, dateFrom: from, dateTo: to }),
                    ]);
                    return {
                        ok: true as const,
                        label,
                        time: timeRows.map((row) => ({ ...row, projectId })),
                        expenses: expenseRows.map((row) => ({ ...row, projectId })),
                    };
                }
                catch (error: unknown) {
                    const message = error instanceof Error ? error.message : 'ошибка загрузки';
                    return { ok: false as const, label, message };
                }
            }));
            const nextTime: CombinedTimeLine[] = [];
            const nextExpenses: CombinedExpenseLine[] = [];
            const failed: string[] = [];
            for (const pack of packs) {
                if (pack.ok) {
                    nextTime.push(...pack.time);
                    nextExpenses.push(...pack.expenses);
                }
                else {
                    failed.push(`${pack.label}: ${pack.message}`);
                }
            }
            setTime(nextTime);
            setExpenses(nextExpenses);
            if (nextTime.length === 0 && nextExpenses.length === 0) {
                const extra = failed.length > 0 ? `\n${failed.join('\n')}` : '';
                onError(`За период нет незакрытых часов и расходов.${extra}`);
                setLoadNote(null);
                return;
            }
            const hours = nextTime.reduce((sum, line) => sum + (line.billableHours ?? line.hours), 0);
            setLoadNote(`Загружено: ${nextTime.length} записей времени (${hours.toFixed(2)} ч), расходов: ${nextExpenses.length}.${failed.length ? ` Не удалось загрузить ${failed.length} проект(а).` : ''}`);
            if (failed.length > 0)
                onError(`Часть проектов не загрузилась:\n${failed.join('\n')}`);
        }
        catch (error: unknown) {
            onError(error instanceof Error ? error.message : 'Не удалось загрузить строки.');
        }
        finally {
            setLoading(false);
        }
    };

    const persistTemplate = () => {
        const name = templateName.trim();
        if (!name) {
            onError('Назовите шаблон.');
            return;
        }
        if (!payerId || projectIds.length === 0) {
            onError('Сначала выберите плательщика и проекты.');
            return;
        }
        const id = templates.find((item) => item.name === name)?.id ?? `${Date.now()}`;
        const next = [...templates.filter((item) => item.name !== name), {
            id,
            name,
            payerClientId: payerId,
            projectIds,
            allocation,
            feeTitle,
        }];
        setTemplates(next);
        saveCombinedInvoiceTemplates(next);
        setTemplateId(id);
        setTemplateName('');
    };

    const applyTemplate = (id: string) => {
        setTemplateId(id);
        const template = templates.find((item) => item.id === id);
        if (!template)
            return;
        setPayerId(template.payerClientId);
        setProjectIds(template.projectIds.filter((projectId) => projects.some((project) => project.id === projectId)));
        setAllocation(template.allocation);
        setFeeTitle(template.feeTitle);
    };

    const removeTemplate = () => {
        if (!templateId)
            return;
        const next = templates.filter((item) => item.id !== templateId);
        setTemplates(next);
        saveCombinedInvoiceTemplates(next);
        setTemplateId('');
    };

    const createDraft = async () => {
        if (!payerId) {
            onError('Выберите плательщика — поле вверху формы.');
            return;
        }
        if (time.length === 0 && expenses.length === 0) {
            onError('Сначала нажмите «Загрузить часы».');
            return;
        }
        setBusy(true);
        try {
            for (const project of selectedProjects) {
                try {
                    await assertNoApprovedUnpaidProjectExpenses(project.id);
                }
                catch (error) {
                    if (isProjectUnpaidExpensesError(error)) {
                        onError(`${project.name}: нельзя сформировать счёт, есть неоплаченные возмещаемые расходы (${error.expenses.length}).\n${formatUnpaidExpenseListLines(error.expenses)}`);
                        return;
                    }
                    throw error;
                }
            }
            const billedTotal = Math.round((totalFees + totalExp) * 100) / 100;
            const shareNote = formatCombinedShareNote(shares);
            const expenseDates = expenses
                .map((line) => String(line.expenseDate ?? '').trim().slice(0, 10))
                .filter(Boolean);
            await ensureInvoiceFxRatesForBilling({
                dateFrom: from,
                dateTo: to,
                issueDate,
                expenseDates,
                currency,
            });
            const created = await createInvoice({
                clientId: payerId,
                issueDate,
                dueDate,
                invoiceNumber: number.trim() || null,
                currency,
                skipPartnerInvoiceConfirmation: true,
                deferPartnerConfirmation: true,
                partnerBillingPeriodFrom: from,
                partnerBillingPeriodTo: to,
                timeEntryIds: time.map((line) => line.id),
                expenseIds: expenses.map((line) => line.id),
                billedAmount: billedTotal,
                serviceDescription: feeTitle.trim() || 'Fees for services under several projects',
                clientNote: shareNote,
                internalNote: `${allocation === 'equal' ? 'Equal split' : 'Hours split'}\n${shareNote}`,
                taxPercent: 0,
                tax2Percent: 0,
                discountPercent: 0,
            });
            onCreated(created.id);
        }
        catch (error: unknown) {
            const raw = error instanceof Error ? error.message : 'Не удалось создать черновик.';
            const hint = isForbiddenError(error)
                ? ' Нет полного подтверждения партнёров или строки принадлежат другому клиенту — сводный счёт уходит как исключение без ожидания всех подписей. Если ошибка повторяется, нужен донастрой API.'
                : '';
            onError(`${raw}${hint}`);
        }
        finally {
            setBusy(false);
        }
    };

    return (
        <section className="tt-inv-page__section tt-inv-combined">
            <div className="tt-inv-page__section-head">
                <h2 className="tt-inv-page__section-title">Сводный счёт</h2>
                <p className="tt-inv-page__section-desc">Один счёт плательщику за несколько проектов, в том числе чужих. По умолчанию доля считается по часам табеля; можно разделить сумму поровну.</p>
            </div>
            <div className="tt-inv-dialog__grid tt-inv-dialog__grid--2">
                <div className="tt-inv-dialog__field">
                    <label id="tt-inv-combined-payer-lbl" className="tt-inv-dialog__label" htmlFor="tt-inv-combined-payer-btn">Плательщик</label>
                    <SearchableSelect<TimeManagerClientRow>
                        className="tsp-srch tt-inv-dialog-searchable"
                        buttonClassName="tsp-srch__btn tt-inv-dialog-searchable__btn"
                        buttonId="tt-inv-combined-payer-btn"
                        portalDropdown
                        portalZIndex={12050}
                        portalMinWidth={400}
                        placeholder={clients.length === 0 ? 'Клиенты загружаются…' : 'Выберите клиента'}
                        emptyListText="Нет клиентов"
                        noMatchText="Клиент не найден"
                        value={payerId}
                        items={clients}
                        getOptionValue={(client) => client.id}
                        getOptionLabel={(client) => client.name}
                        getSearchText={(client) => `${client.name} ${client.id}`.trim()}
                        onSelect={(client) => setPayerId(client.id)}
                        disabled={clients.length === 0}
                        aria-labelledby="tt-inv-combined-payer-lbl"
                    />
                </div>
                <label className="tt-inv-dialog__field">
                    <span className="tt-inv-dialog__label">Шаблон</span>
                    <select className="tt-inv-dialog__control" value={templateId} onChange={(event) => applyTemplate(event.target.value)}>
                        <option value="">Без шаблона</option>
                        {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
                    </select>
                    {templateId ? (
                        <button type="button" className="tt-inv-combined__link" onClick={removeTemplate}>Удалить шаблон</button>
                    ) : null}
                </label>
            </div>
            <label className="tt-inv-dialog__field" style={{ marginTop: '0.75rem' }}>
                <span className="tt-inv-dialog__label">Заголовок услуг</span>
                <textarea className="tt-inv-dialog__control" rows={3} value={feeTitle} onChange={(event) => setFeeTitle(event.target.value)} placeholder="Fees for services in the period… under the engagement agreement with…" />
            </label>
            <div className="tt-inv-combined__alloc" role="group" aria-label="Как распределить сумму">
                <button type="button" className={allocation === 'hours' ? 'is-on' : ''} onClick={() => setAllocation('hours')}>По наработанным часам</button>
                <button type="button" className={allocation === 'equal' ? 'is-on' : ''} onClick={() => setAllocation('equal')}>Поровну по проектам</button>
            </div>
            <label className="tt-inv-dialog__field">
                <span className="tt-inv-dialog__label">Проекты, в том числе чужие</span>
                <input className="tt-inv-dialog__control" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти проект или клиента" />
            </label>
            <div className="tt-inv-combined__actions" style={{ marginTop: '0.35rem' }}>
                <button type="button" className="tt-reports__btn tt-reports__btn--outline" onClick={() => setProjectIds(visibleProjects.map((project) => project.id))} disabled={visibleProjects.length === 0}>Выбрать найденные</button>
                <button type="button" className="tt-reports__btn tt-reports__btn--outline" onClick={() => setProjectIds([])} disabled={projectIds.length === 0}>Снять все</button>
            </div>
            <ul className="tt-inv-combined__projects">
                {visibleProjects.length === 0 ? (
                    <li className="tt-inv-combined__empty">{projects.length === 0 ? 'Проекты загружаются…' : 'Ничего не найдено'}</li>
                ) : visibleProjects.map((project) => (
                    <li key={project.id}>
                        <label>
                            <input type="checkbox" checked={projectIds.includes(project.id)} onChange={() => toggleProject(project.id)} />
                            <span>{project.code ? `${project.name} (${project.code})` : project.name}</span>
                            <em>{clientName.get(project.client_id) ?? 'Без клиента'}</em>
                        </label>
                    </li>
                ))}
            </ul>
            <div className="tt-inv-dialog__grid tt-inv-dialog__grid--2">
                <div className="tt-inv-dialog__field">
                    <span className="tt-inv-dialog__label">С</span>
                    <DatePicker value={from} max={to || undefined} onChange={setFrom} portal portalZIndex={12100} showChevron />
                </div>
                <div className="tt-inv-dialog__field">
                    <span className="tt-inv-dialog__label">По</span>
                    <DatePicker value={to} min={from || undefined} onChange={setTo} portal portalZIndex={12100} showChevron />
                </div>
                <div className="tt-inv-dialog__field">
                    <span className="tt-inv-dialog__label">Дата счёта</span>
                    <DatePicker value={issueDate} max={dueDate || undefined} onChange={setIssueDate} portal portalZIndex={12100} showChevron />
                </div>
                <div className="tt-inv-dialog__field">
                    <span className="tt-inv-dialog__label">Срок оплаты</span>
                    <DatePicker value={dueDate} min={issueDate || undefined} onChange={setDueDate} portal portalZIndex={12100} showChevron />
                </div>
            </div>
            <label className="tt-inv-dialog__field">
                <span className="tt-inv-dialog__label">Номер</span>
                <input className="tt-inv-dialog__control" value={number} onChange={(event) => setNumber(event.target.value)} placeholder="Пусто — номер назначит система" />
            </label>
            {loadNote ? <p className="tt-inv-page__section-desc" role="status">{loadNote}</p> : null}
            {!payerId ? <p className="tt-inv-page__section-desc">Сначала выберите плательщика вверху формы.</p> : null}
            {shares.length > 0 && time.length + expenses.length > 0 ? (
                <table className="tt-inv-combined__table">
                    <caption>Распределение: {allocation === 'equal' ? 'поровну' : 'по часам проекта'} · {currency}</caption>
                    <thead>
                        <tr>
                            <th>Проект</th>
                            <th>%</th>
                            <th>Услуги</th>
                            <th>Расходы</th>
                            <th>К счёту</th>
                        </tr>
                    </thead>
                    <tbody>
                        {shares.map((share) => (
                            <tr key={share.projectId}>
                                <td>{share.projectName}<br /><small>{share.clientName}</small></td>
                                <td>{share.percent.toFixed(2)}%</td>
                                <td>{share.fees.toFixed(2)}</td>
                                <td>{share.expenses.toFixed(2)}</td>
                                <td>{share.total.toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td>Итого · {totalHours.toFixed(2)} ч</td>
                            <td>100%</td>
                            <td>{totalFees.toFixed(2)}</td>
                            <td>{totalExp.toFixed(2)}</td>
                            <td>{(totalFees + totalExp).toFixed(2)}</td>
                        </tr>
                    </tfoot>
                </table>
            ) : null}
            <div className="tt-inv-combined__actions">
                <button type="button" className="tt-reports__btn tt-reports__btn--outline" onClick={() => void loadLines()} disabled={loading}>{loading ? 'Загрузка…' : 'Загрузить часы'}</button>
                <button type="button" className="tt-reports__btn tt-reports__btn--outline" onClick={() => setPreview(true)} disabled={time.length + expenses.length === 0}>Предпросмотр</button>
                <button type="button" className="tt-reports__btn tt-reports__btn--accent" onClick={() => void createDraft()} disabled={busy || !payerId || time.length + expenses.length === 0}>{busy ? 'Создание…' : 'Создать черновик'}</button>
            </div>
            <div className="tt-inv-combined__template">
                <input className="tt-inv-dialog__control" value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="Имя шаблона для следующих клиентов" />
                <button type="button" className="tt-reports__btn tt-reports__btn--outline" onClick={persistTemplate}>Сохранить шаблон</button>
            </div>
            {preview ? (
                <div className="tt-inv-combined__preview" role="dialog" aria-modal="true">
                    <article>
                        <header>
                            <h2>KOSTA LEGAL</h2>
                            <button type="button" onClick={() => setPreview(false)}>Закрыть</button>
                        </header>
                        <p>{feeTitle || 'Fees for services'}</p>
                        <p>Payer: {clientName.get(payerId) ?? '—'}. Period: {from} — {to}</p>
                        {selectedProjects.map((project) => {
                            const rows = time.filter((line) => line.projectId === project.id);
                            if (rows.length === 0)
                                return null;
                            return (
                                <div key={project.id} className="tt-inv-combined__sub">
                                    <h3>Sub-project: {project.name}</h3>
                                    <table>
                                        <thead><tr><th>Date</th><th>User</th><th>Description</th><th>Hours</th><th>Amount</th></tr></thead>
                                        <tbody>
                                            {rows.map((line) => (
                                                <tr key={line.id}>
                                                    <td>{line.workDate.slice(0, 10)}</td>
                                                    <td>{userName.get(line.authUserId) ?? line.authUserId}</td>
                                                    <td>{invoiceClientDescription(line.description) || '—'}</td>
                                                    <td>{(line.billableHours ?? line.hours).toFixed(2)}</td>
                                                    <td>{line.billableAmount.toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            );
                        })}
                        <h3>Summary of Services</h3>
                        <p>{totalHours.toFixed(2)} h · {totalFees.toFixed(2)} {currency}</p>
                        <h3>Reimbursable Expenses</h3>
                        {expenses.length === 0 ? <p>None</p> : (
                            <table>
                                <thead><tr><th>Date</th><th>Description</th><th>Amount</th></tr></thead>
                                <tbody>
                                    {expenses.map((line) => (
                                        <tr key={line.id}>
                                            <td>{line.expenseDate.slice(0, 10)}</td>
                                            <td>{line.description || '—'}</td>
                                            <td>{line.equivalentAmount.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                        <h3>Shared amounts</h3>
                        <table>
                            <thead><tr><th></th><th>%</th><th>Services</th><th>Expenses</th><th>To be invoiced</th></tr></thead>
                            <tbody>
                                {shares.map((share) => (
                                    <tr key={share.projectId}>
                                        <td>{share.projectName}</td>
                                        <td>{share.percent.toFixed(2)}%</td>
                                        <td>{share.fees.toFixed(2)}</td>
                                        <td>{share.expenses.toFixed(2)}</td>
                                        <td>{share.total.toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </article>
                </div>
            ) : null}
        </section>
    );
}
