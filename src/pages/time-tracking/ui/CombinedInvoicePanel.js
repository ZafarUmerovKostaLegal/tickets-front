import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { createInvoice, patchInvoice, ensureInvoiceFxRatesForBilling, fetchUnbilledExpenses, fetchUnbilledTimeEntries, isForbiddenError, listPartnerReportConfirmationsConfirmed, listTimeTrackingUsers, } from '@entities/time-tracking';
import { DatePicker } from '@shared/ui/DatePicker';
import { SearchableSelect } from '@shared/ui/SearchableSelect';
import { CombinedInvoiceDocument } from './CombinedInvoiceDocument';
import { buildCombinedReportSnapshot, buildCombinedShares, formatCombinedShareNote, loadCombinedInvoiceTemplates, saveCombinedInvoiceTemplates, } from '../lib/combinedInvoice';
import { addDaysIso, firstOfMonthIso, lastOfMonthIso, todayIso } from '../lib/invoicePageShared';
import { assertNoApprovedUnpaidProjectExpenses, formatUnpaidExpenseListLines, isProjectUnpaidExpensesError, } from '../lib/projectUnpaidExpenses';
export function CombinedInvoicePanel({ clients, projects, onCreated, onError }) {
    const [payerId, setPayerId] = useState('');
    const [projectIds, setProjectIds] = useState([]);
    const [query, setQuery] = useState('');
    const [suggestOpen, setSuggestOpen] = useState(false);
    const [suggestIndex, setSuggestIndex] = useState(0);
    const [projectSource, setProjectSource] = useState('all');
    const [confirmedRows, setConfirmedRows] = useState([]);
    const [confirmedLoading, setConfirmedLoading] = useState(true);
    const [allocation, setAllocation] = useState('hours');
    const [from, setFrom] = useState(firstOfMonthIso());
    const [to, setTo] = useState(lastOfMonthIso());
    const [issueDate, setIssueDate] = useState(todayIso());
    const [dueDate, setDueDate] = useState(addDaysIso(30));
    const [number, setNumber] = useState('');
    const [feeTitle, setFeeTitle] = useState('');
    const [time, setTime] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [preview, setPreview] = useState(false);
    const [users, setUsers] = useState([]);
    const [templates, setTemplates] = useState(() => loadCombinedInvoiceTemplates());
    const [templateId, setTemplateId] = useState('');
    const [templateName, setTemplateName] = useState('');
    const [loadNote, setLoadNote] = useState(null);
    useEffect(() => {
        let cancelled = false;
        void listPartnerReportConfirmationsConfirmed()
            .then((rows) => {
            if (!cancelled)
                setConfirmedRows(rows.filter((row) => String(row.status ?? '').trim().toLowerCase() === 'fully_confirmed'));
        })
            .catch(() => {
            if (!cancelled)
                setConfirmedRows([]);
        })
            .finally(() => {
            if (!cancelled)
                setConfirmedLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, []);
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
    const templateChoices = useMemo(() => [{ id: '', name: 'Без шаблона' }, ...templates.map((item) => ({ id: item.id, name: item.name }))], [templates]);
    const clientName = useMemo(() => {
        const map = new Map();
        for (const client of clients)
            map.set(client.id, client.name);
        return map;
    }, [clients]);
    const selectedProjects = useMemo(() => projectIds
        .map((id) => projects.find((project) => project.id === id))
        .filter((project) => Boolean(project)), [projectIds, projects]);
    const confirmedPeriodByProject = useMemo(() => {
        const map = new Map();
        for (const row of confirmedRows) {
            const projectId = String(row.projectId ?? '').trim();
            const dateFrom = String(row.dateFrom ?? '').slice(0, 10);
            const dateTo = String(row.dateTo ?? '').slice(0, 10);
            if (!projectId || !/^\d{4}-\d{2}-\d{2}$/.test(dateFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(dateTo))
                continue;
            const overlaps = Boolean(from && to) && dateFrom <= to && dateTo >= from;
            const prev = map.get(projectId);
            if (!prev) {
                map.set(projectId, { dateFrom, dateTo });
                continue;
            }
            const prevOverlaps = Boolean(from && to) && prev.dateFrom <= to && prev.dateTo >= from;
            if (overlaps && !prevOverlaps)
                map.set(projectId, { dateFrom, dateTo });
            else if (overlaps === prevOverlaps && dateTo > prev.dateTo)
                map.set(projectId, { dateFrom, dateTo });
        }
        return map;
    }, [confirmedRows, from, to]);
    const confirmedProjects = useMemo(() => projects
        .filter((project) => confirmedPeriodByProject.has(project.id))
        .sort((a, b) => a.name.localeCompare(b.name, 'ru')), [confirmedPeriodByProject, projects]);
    const suggestions = useMemo(() => {
        const q = query.trim().toLocaleLowerCase('ru');
        if (!q)
            return [];
        return projects
            .filter((project) => {
            if (projectIds.includes(project.id))
                return false;
            const client = clientName.get(project.client_id) ?? '';
            return `${project.name} ${project.code ?? ''} ${client}`.toLocaleLowerCase('ru').includes(q);
        })
            .slice(0, 8);
    }, [clientName, projectIds, projects, query]);
    const shares = useMemo(() => buildCombinedShares(selectedProjects, clientName, time, expenses, allocation), [allocation, clientName, expenses, selectedProjects, time]);
    const totalHours = time.reduce((sum, line) => sum + (line.billableHours ?? line.hours), 0);
    const totalFees = time.reduce((sum, line) => sum + line.billableAmount, 0);
    const totalExp = expenses.reduce((sum, line) => sum + line.equivalentAmount, 0);
    const currency = time.find((line) => line.currency)?.currency ?? 'USD';
    useEffect(() => {
        if (payerId)
            return;
        const ids = [...new Set(selectedProjects.map((project) => project.client_id).filter(Boolean))];
        if (ids.length === 1)
            setPayerId(ids[0]);
    }, [payerId, selectedProjects]);
    const projectTitle = (project) => (project.code ? `${project.name} (${project.code})` : project.name);
    const periodLabel = (isoFrom, isoTo) => {
        const fmt = (iso) => {
            const [year, month, day] = iso.slice(0, 10).split('-');
            return day && month && year ? `${day}.${month}.${year}` : iso;
        };
        return `${fmt(isoFrom)}–${fmt(isoTo)}`;
    };
    const addProject = (id) => {
        setProjectIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
        setQuery('');
        setSuggestOpen(false);
        setSuggestIndex(0);
    };
    const applyConfirmedIds = (ids) => {
        setProjectIds(ids);
        const periods = ids.flatMap((id) => {
            const period = confirmedPeriodByProject.get(id);
            return period ? [period] : [];
        });
        if (periods.length === 0)
            return;
        setFrom(periods.reduce((min, period) => period.dateFrom < min ? period.dateFrom : min, periods[0].dateFrom));
        setTo(periods.reduce((max, period) => period.dateTo > max ? period.dateTo : max, periods[0].dateTo));
    };
    const toggleConfirmed = (id) => {
        applyConfirmedIds(projectIds.includes(id) ? projectIds.filter((item) => item !== id) : [...projectIds, id]);
    };
    const removeProject = (id) => {
        setProjectIds((prev) => prev.filter((item) => item !== id));
    };
    const onSuggestKeyDown = (event) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (suggestions.length === 0)
                return;
            setSuggestOpen(true);
            setSuggestIndex((index) => Math.min(suggestions.length - 1, index + 1));
            return;
        }
        if (event.key === 'ArrowUp') {
            event.preventDefault();
            setSuggestIndex((index) => Math.max(0, index - 1));
            return;
        }
        if (event.key === 'Escape') {
            setSuggestOpen(false);
            return;
        }
        if (event.key === 'Enter' && suggestOpen && suggestions[suggestIndex]) {
            event.preventDefault();
            addProject(suggestions[suggestIndex].id);
        }
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
                        ok: true,
                        label,
                        time: timeRows.map((row) => ({ ...row, projectId })),
                        expenses: expenseRows.map((row) => ({ ...row, projectId })),
                    };
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : 'ошибка загрузки';
                    return { ok: false, label, message };
                }
            }));
            const nextTime = [];
            const nextExpenses = [];
            const failed = [];
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
        catch (error) {
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
    const applyTemplate = (id) => {
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
            const snapshot = buildCombinedReportSnapshot({
                feeTitle,
                currency,
                projects: selectedProjects,
                time,
                expenses,
                shares,
                users,
                totalHours,
                totalFees,
                totalExpenses: totalExp,
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
            await patchInvoice(created.id, {
                documentOverrides: {
                    v: 1,
                    reportLayout: 'combined',
                    combinedReport: snapshot,
                },
            });
            onCreated(created.id);
        }
        catch (error) {
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
    return (_jsxs("section", { className: "tt-inv-page__section tt-inv-combined", children: [_jsxs("div", { className: "tt-inv-page__section-head", children: [_jsx("h2", { className: "tt-inv-page__section-title", children: "\u0421\u0432\u043E\u0434\u043D\u044B\u0439 \u0441\u0447\u0451\u0442" }), _jsx("p", { className: "tt-inv-page__section-desc", children: "\u041E\u0434\u0438\u043D \u0441\u0447\u0451\u0442 \u043F\u043B\u0430\u0442\u0435\u043B\u044C\u0449\u0438\u043A\u0443 \u0437\u0430 \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u043F\u0440\u043E\u0435\u043A\u0442\u043E\u0432, \u0432 \u0442\u043E\u043C \u0447\u0438\u0441\u043B\u0435 \u0447\u0443\u0436\u0438\u0445. \u0414\u043E\u043B\u044F \u0441\u0447\u0438\u0442\u0430\u0435\u0442\u0441\u044F \u043F\u043E \u0447\u0430\u0441\u0430\u043C \u0442\u0430\u0431\u0435\u043B\u044F \u0438\u043B\u0438 \u0434\u0435\u043B\u0438\u0442\u0441\u044F \u043F\u043E\u0440\u043E\u0432\u043D\u0443." })] }), _jsxs("div", { className: "tt-inv-dialog__grid tt-inv-dialog__grid--2", children: [_jsxs("div", { className: "tt-inv-dialog__field", children: [_jsx("label", { id: "tt-inv-combined-payer-lbl", className: "tt-inv-dialog__label", htmlFor: "tt-inv-combined-payer-btn", children: "\u041F\u043B\u0430\u0442\u0435\u043B\u044C\u0449\u0438\u043A" }), _jsx(SearchableSelect, { className: "tsp-srch tt-inv-dialog-searchable", buttonClassName: "tsp-srch__btn tt-inv-dialog-searchable__btn", buttonId: "tt-inv-combined-payer-btn", portalDropdown: true, portalZIndex: 12050, portalMinWidth: 400, placeholder: clients.length === 0 ? 'Клиенты загружаются…' : 'Выберите клиента', emptyListText: "\u041D\u0435\u0442 \u043A\u043B\u0438\u0435\u043D\u0442\u043E\u0432", noMatchText: "\u041A\u043B\u0438\u0435\u043D\u0442 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D", value: payerId, items: clients, getOptionValue: (client) => client.id, getOptionLabel: (client) => client.name, getSearchText: (client) => `${client.name} ${client.id}`.trim(), onSelect: (client) => setPayerId(client.id), disabled: clients.length === 0, "aria-labelledby": "tt-inv-combined-payer-lbl" })] }), _jsxs("div", { className: "tt-inv-dialog__field", children: [_jsxs("div", { className: "tt-inv-combined__label-row", children: [_jsx("label", { id: "tt-inv-combined-template-lbl", className: "tt-inv-dialog__label", htmlFor: "tt-inv-combined-template-btn", children: "\u0428\u0430\u0431\u043B\u043E\u043D" }), templateId ? (_jsx("button", { type: "button", className: "tt-inv-combined__link", onClick: removeTemplate, children: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C" })) : null] }), _jsx(SearchableSelect, { className: "tsp-srch tt-inv-dialog-searchable", buttonClassName: "tsp-srch__btn tt-inv-dialog-searchable__btn", buttonId: "tt-inv-combined-template-btn", portalDropdown: true, portalZIndex: 12050, portalMinWidth: 320, placeholder: "\u0411\u0435\u0437 \u0448\u0430\u0431\u043B\u043E\u043D\u0430", emptyListText: "\u041D\u0435\u0442 \u0448\u0430\u0431\u043B\u043E\u043D\u043E\u0432", noMatchText: "\u0428\u0430\u0431\u043B\u043E\u043D \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D", value: templateId, items: templateChoices, getOptionValue: (item) => item.id, getOptionLabel: (item) => item.name, getSearchText: (item) => item.name, onSelect: (item) => applyTemplate(item.id), "aria-labelledby": "tt-inv-combined-template-lbl" })] })] }), _jsxs("label", { className: "tt-inv-dialog__field tt-inv-combined__block", children: [_jsx("span", { className: "tt-inv-dialog__label", children: "\u0417\u0430\u0433\u043E\u043B\u043E\u0432\u043E\u043A \u0443\u0441\u043B\u0443\u0433" }), _jsx("textarea", { className: "tt-inv-dialog__control tt-inv-combined__textarea", rows: 3, value: feeTitle, onChange: (event) => setFeeTitle(event.target.value), placeholder: "Fees for services in the period\u2026 under the engagement agreement with\u2026" })] }), _jsxs("div", { className: "tt-inv-combined__alloc", role: "group", "aria-label": "\u041A\u0430\u043A \u0440\u0430\u0441\u043F\u0440\u0435\u0434\u0435\u043B\u0438\u0442\u044C \u0441\u0443\u043C\u043C\u0443", children: [_jsx("button", { type: "button", className: allocation === 'hours' ? 'is-on' : '', onClick: () => setAllocation('hours'), children: "\u041F\u043E \u043D\u0430\u0440\u0430\u0431\u043E\u0442\u0430\u043D\u043D\u044B\u043C \u0447\u0430\u0441\u0430\u043C" }), _jsx("button", { type: "button", className: allocation === 'equal' ? 'is-on' : '', onClick: () => setAllocation('equal'), children: "\u041F\u043E\u0440\u043E\u0432\u043D\u0443 \u043F\u043E \u043F\u0440\u043E\u0435\u043A\u0442\u0430\u043C" })] }), _jsxs("div", { className: "tt-inv-combined__pick", children: [_jsxs("div", { className: "tt-inv-combined__pick-label", children: [_jsx("label", { className: "tt-inv-dialog__label", htmlFor: projectSource === 'all' ? 'tt-inv-combined-project-search' : undefined, children: "\u041F\u0440\u043E\u0435\u043A\u0442\u044B, \u0432 \u0442\u043E\u043C \u0447\u0438\u0441\u043B\u0435 \u0447\u0443\u0436\u0438\u0435" }), projectIds.length > 0 ? (_jsx("button", { type: "button", className: "tt-inv-combined__link", onClick: () => setProjectIds([]), children: "\u0421\u043D\u044F\u0442\u044C \u0432\u0441\u0435" })) : null] }), _jsxs("div", { className: "tt-inv-combined__alloc tt-inv-combined__source", role: "tablist", "aria-label": "\u041E\u0442\u043A\u0443\u0434\u0430 \u0431\u0440\u0430\u0442\u044C \u043F\u0440\u043E\u0435\u043A\u0442\u044B", children: [_jsx("button", { type: "button", role: "tab", "aria-selected": projectSource === 'all', className: projectSource === 'all' ? 'is-on' : '', onClick: () => { setProjectSource('all'); setSuggestIndex(0); if (!query.trim())
                                    setSuggestOpen(false); }, children: "\u0412\u0441\u0435" }), _jsx("button", { type: "button", role: "tab", "aria-selected": projectSource === 'confirmed', className: projectSource === 'confirmed' ? 'is-on' : '', onClick: () => { setProjectSource('confirmed'); setSuggestOpen(false); }, children: "\u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D\u043D\u044B\u0435" })] }), projectSource === 'confirmed' ? (_jsxs(_Fragment, { children: [_jsxs("div", { className: "tt-inv-combined__confirmed-tools", children: [_jsxs("span", { children: [confirmedProjects.filter((project) => projectIds.includes(project.id)).length, " \u0438\u0437 ", confirmedProjects.length] }), _jsx("button", { type: "button", className: "tt-inv-combined__link", onClick: () => applyConfirmedIds([...new Set([...projectIds, ...confirmedProjects.map((project) => project.id)])]), disabled: confirmedProjects.length === 0, children: "\u0412\u044B\u0431\u0440\u0430\u0442\u044C \u0432\u0441\u0435" }), _jsx("button", { type: "button", className: "tt-inv-combined__link", onClick: () => applyConfirmedIds(projectIds.filter((id) => !confirmedPeriodByProject.has(id))), disabled: !confirmedProjects.some((project) => projectIds.includes(project.id)), children: "\u0421\u043D\u044F\u0442\u044C \u0432\u044B\u0431\u043E\u0440" })] }), _jsx("ul", { className: "tt-inv-combined__confirmed", children: confirmedLoading || projects.length === 0 ? (_jsx("li", { className: "tt-inv-combined__suggest-empty", children: "\u041F\u0440\u043E\u0435\u043A\u0442\u044B \u0437\u0430\u0433\u0440\u0443\u0436\u0430\u044E\u0442\u0441\u044F\u2026" })) : confirmedProjects.length === 0 ? (_jsx("li", { className: "tt-inv-combined__suggest-empty", children: "\u041D\u0435\u0442 \u043F\u0440\u043E\u0435\u043A\u0442\u043E\u0432 \u0441 \u043F\u043E\u043B\u043D\u044B\u043C \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u0435\u043C \u043F\u0430\u0440\u0442\u043D\u0451\u0440\u043E\u0432" })) : confirmedProjects.map((project) => {
                                    const checked = projectIds.includes(project.id);
                                    const period = confirmedPeriodByProject.get(project.id);
                                    return (_jsx("li", { className: checked ? 'is-on' : '', children: _jsxs("label", { children: [_jsx("input", { className: "tt-inv-combined__check", type: "checkbox", checked: checked, onChange: () => toggleConfirmed(project.id) }), _jsx("span", { children: projectTitle(project) }), _jsx("em", { children: [clientName.get(project.client_id) ?? 'Без клиента', period ? periodLabel(period.dateFrom, period.dateTo) : ''].filter(Boolean).join(' · ') })] }) }, project.id));
                                }) })] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "tt-inv-combined__suggest", children: [_jsx("input", { id: "tt-inv-combined-project-search", className: "tt-inv-dialog__control", role: "combobox", "aria-expanded": suggestOpen && query.trim().length > 0, "aria-autocomplete": "list", "aria-controls": "tt-inv-combined-project-suggest", value: query, placeholder: projects.length === 0 ? 'Проекты загружаются…' : 'Найти проект или клиента', disabled: projects.length === 0, onChange: (event) => {
                                            setQuery(event.target.value);
                                            setSuggestOpen(true);
                                            setSuggestIndex(0);
                                        }, onFocus: () => setSuggestOpen(true), onBlur: () => setSuggestOpen(false), onKeyDown: onSuggestKeyDown }), suggestOpen && query.trim() ? (_jsx("ul", { id: "tt-inv-combined-project-suggest", className: "tt-inv-combined__suggest-list", role: "listbox", children: suggestions.length === 0 ? (_jsx("li", { className: "tt-inv-combined__suggest-empty", children: "\u041D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E" })) : suggestions.map((project, index) => (_jsx("li", { role: "option", "aria-selected": index === suggestIndex, children: _jsxs("button", { type: "button", className: index === suggestIndex ? 'is-on' : '', onMouseDown: (event) => event.preventDefault(), onClick: () => addProject(project.id), onMouseEnter: () => setSuggestIndex(index), children: [_jsx("span", { children: projectTitle(project) }), _jsx("em", { children: clientName.get(project.client_id) ?? 'Без клиента' })] }) }, project.id))) })) : null] }), selectedProjects.length > 0 ? (_jsx("ul", { className: "tt-inv-combined__chips", children: selectedProjects.map((project) => (_jsxs("li", { children: [_jsx("span", { children: projectTitle(project) }), _jsx("small", { children: clientName.get(project.client_id) ?? 'Без клиента' }), _jsx("button", { type: "button", "aria-label": `Убрать ${projectTitle(project)}`, onClick: () => removeProject(project.id), children: "\u00D7" })] }, project.id))) })) : (_jsx("p", { className: "tt-inv-combined__pick-hint", children: "\u041D\u0430\u0447\u043D\u0438\u0442\u0435 \u0432\u0432\u043E\u0434\u0438\u0442\u044C \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u2014 \u043F\u0440\u043E\u0435\u043A\u0442 \u0434\u043E\u0431\u0430\u0432\u0438\u0442\u0441\u044F \u0438\u0437 \u043F\u043E\u0434\u0441\u043A\u0430\u0437\u043A\u0438." }))] }))] }), _jsxs("div", { className: "tt-inv-dialog__grid tt-inv-dialog__grid--2 tt-inv-combined__block", children: [_jsxs("div", { className: "tt-inv-dialog__field", children: [_jsx("span", { className: "tt-inv-dialog__label", children: "\u0421" }), _jsx(DatePicker, { className: "tt-inv-dialog-dp", buttonClassName: "tt-inv-dialog-dp-btn", value: from, max: to || undefined, onChange: setFrom, portal: true, portalZIndex: 12100, showChevron: true })] }), _jsxs("div", { className: "tt-inv-dialog__field", children: [_jsx("span", { className: "tt-inv-dialog__label", children: "\u041F\u043E" }), _jsx(DatePicker, { className: "tt-inv-dialog-dp", buttonClassName: "tt-inv-dialog-dp-btn", value: to, min: from || undefined, onChange: setTo, portal: true, portalZIndex: 12100, showChevron: true })] }), _jsxs("div", { className: "tt-inv-dialog__field", children: [_jsx("span", { className: "tt-inv-dialog__label", children: "\u0414\u0430\u0442\u0430 \u0441\u0447\u0451\u0442\u0430" }), _jsx(DatePicker, { className: "tt-inv-dialog-dp", buttonClassName: "tt-inv-dialog-dp-btn", value: issueDate, max: dueDate || undefined, onChange: setIssueDate, portal: true, portalZIndex: 12100, showChevron: true })] }), _jsxs("div", { className: "tt-inv-dialog__field", children: [_jsx("span", { className: "tt-inv-dialog__label", children: "\u0421\u0440\u043E\u043A \u043E\u043F\u043B\u0430\u0442\u044B" }), _jsx(DatePicker, { className: "tt-inv-dialog-dp", buttonClassName: "tt-inv-dialog-dp-btn", value: dueDate, min: issueDate || undefined, onChange: setDueDate, portal: true, portalZIndex: 12100, showChevron: true })] })] }), _jsxs("label", { className: "tt-inv-dialog__field tt-inv-combined__block", children: [_jsx("span", { className: "tt-inv-dialog__label", children: "\u041D\u043E\u043C\u0435\u0440" }), _jsx("input", { className: "tt-inv-dialog__control", value: number, onChange: (event) => setNumber(event.target.value), placeholder: "\u041F\u0443\u0441\u0442\u043E \u2014 \u043D\u043E\u043C\u0435\u0440 \u043D\u0430\u0437\u043D\u0430\u0447\u0438\u0442 \u0441\u0438\u0441\u0442\u0435\u043C\u0430" })] }), loadNote ? _jsx("p", { className: "tt-inv-page__section-desc", role: "status", children: loadNote }) : null, !payerId ? _jsx("p", { className: "tt-inv-page__section-desc", children: "\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043F\u043B\u0430\u0442\u0435\u043B\u044C\u0449\u0438\u043A\u0430 \u0432\u0432\u0435\u0440\u0445\u0443 \u0444\u043E\u0440\u043C\u044B." }) : null, shares.length > 0 && time.length + expenses.length > 0 ? (_jsxs("table", { className: "tt-inv-combined__table", children: [_jsxs("caption", { children: ["\u0420\u0430\u0441\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0438\u0435: ", allocation === 'equal' ? 'поровну' : 'по часам проекта', " \u00B7 ", currency] }), _jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "\u041F\u0440\u043E\u0435\u043A\u0442" }), _jsx("th", { children: "%" }), _jsx("th", { children: "\u0423\u0441\u043B\u0443\u0433\u0438" }), _jsx("th", { children: "\u0420\u0430\u0441\u0445\u043E\u0434\u044B" }), _jsx("th", { children: "\u041A \u0441\u0447\u0451\u0442\u0443" })] }) }), _jsx("tbody", { children: shares.map((share) => (_jsxs("tr", { children: [_jsxs("td", { children: [share.projectName, _jsx("br", {}), _jsx("small", { children: share.clientName })] }), _jsxs("td", { children: [share.percent.toFixed(2), "%"] }), _jsx("td", { children: share.fees.toFixed(2) }), _jsx("td", { children: share.expenses.toFixed(2) }), _jsx("td", { children: share.total.toFixed(2) })] }, share.projectId))) }), _jsx("tfoot", { children: _jsxs("tr", { children: [_jsxs("td", { children: ["\u0418\u0442\u043E\u0433\u043E \u00B7 ", totalHours.toFixed(2), " \u0447"] }), _jsx("td", { children: "100%" }), _jsx("td", { children: totalFees.toFixed(2) }), _jsx("td", { children: totalExp.toFixed(2) }), _jsx("td", { children: (totalFees + totalExp).toFixed(2) })] }) })] })) : null, _jsxs("div", { className: "tt-inv-combined__actions", children: [_jsx("button", { type: "button", className: "tt-reports__btn tt-reports__btn--outline", onClick: () => void loadLines(), disabled: loading, children: loading ? 'Загрузка…' : 'Загрузить часы' }), _jsx("button", { type: "button", className: "tt-reports__btn tt-reports__btn--outline", onClick: () => setPreview(true), disabled: time.length + expenses.length === 0, children: "\u041F\u0440\u0435\u0434\u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440" }), _jsx("button", { type: "button", className: "tt-reports__btn tt-reports__btn--accent", onClick: () => void createDraft(), disabled: busy || !payerId || time.length + expenses.length === 0, children: busy ? 'Создание…' : 'Создать черновик' })] }), _jsxs("div", { className: "tt-inv-combined__template", children: [_jsxs("label", { className: "tt-inv-dialog__field", children: [_jsx("span", { className: "tt-inv-dialog__label", children: "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u043A\u0430\u043A \u0448\u0430\u0431\u043B\u043E\u043D" }), _jsx("input", { className: "tt-inv-dialog__control", value: templateName, onChange: (event) => setTemplateName(event.target.value), placeholder: "\u0418\u043C\u044F \u0434\u043B\u044F \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0445 \u0441\u0447\u0435\u0442\u043E\u0432" })] }), _jsx("button", { type: "button", className: "tt-reports__btn tt-reports__btn--outline", onClick: persistTemplate, children: "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C" })] }), preview ? (_jsx(CombinedInvoiceDocument, { feeTitle: feeTitle, payerName: clientName.get(payerId) ?? '—', from: from, to: to, currency: currency, projects: selectedProjects, time: time, expenses: expenses, shares: shares, users: users, totalHours: totalHours, totalFees: totalFees, totalExp: totalExp, onClose: () => setPreview(false) })) : null] }));
}
