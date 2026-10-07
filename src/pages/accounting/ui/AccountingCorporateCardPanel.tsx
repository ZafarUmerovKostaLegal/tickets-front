import { useEffect, useState } from 'react';
import { fetchExpenses } from '@entities/expenses/model/expensesApi';
import { STATUS_META } from '@entities/expenses/model/constants';
import type { ExpenseRequest, ExpenseStatus } from '@entities/expenses/model/types';
import './AccountingCorporateCardPanel.css';

function money(n: number): string {
    return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso: string | null | undefined): string {
    if (!iso)
        return '—';
    const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
    if (Number.isNaN(d.getTime()))
        return '—';
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function statusLabel(status: ExpenseStatus): string {
    return STATUS_META[status]?.label ?? status;
}

export function AccountingCorporateCardPanel() {
    const [rows, setRows] = useState<ExpenseRequest[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        void fetchExpenses({
            paymentMethod: 'card',
            limit: 200,
            sortBy: 'expenseDate',
            sortOrder: 'desc',
        })
            .then((res) => {
                if (!cancelled)
                    setRows(res.items ?? []);
            })
            .catch((e: unknown) => {
                if (!cancelled)
                    setError(e instanceof Error ? e.message : 'Не удалось загрузить операции по карте');
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const totalUzs = (rows ?? []).reduce((sum, row) => sum + (Number(row.amountUzs) || 0), 0);

    return (
        <section className="acct-card" aria-label="Корпоративная карта">
            <header className="acct-card__head">
                <div>
                    <h2 className="acct-card__title">Операции по корпоративной карте</h2>
                    <p className="acct-card__sub">Расходы со способом оплаты «Корпоративная карта офиса»</p>
                </div>
                {rows ? (
                    <p className="acct-card__total">
                        <span>Итого, UZS</span>
                        <strong>{money(totalUzs)}</strong>
                    </p>
                ) : null}
            </header>
            {error ? <p className="acct-card__error">{error}</p> : null}
            {rows == null && !error ? <p className="acct-card__empty">Загрузка…</p> : null}
            {rows && rows.length === 0 ? <p className="acct-card__empty">Операций по корпоративной карте пока нет</p> : null}
            {rows && rows.length > 0 ? (
                <div className="acct-card__table-wrap">
                    <table className="acct-card__table">
                        <thead>
                            <tr>
                                <th>Дата</th>
                                <th>Описание</th>
                                <th>Статус</th>
                                <th>Сумма, UZS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => (
                                <tr key={row.id}>
                                    <td>{formatDate(row.expenseDate)}</td>
                                    <td>{row.description?.trim() || row.businessPurpose?.trim() || '—'}</td>
                                    <td>{statusLabel(row.status)}</td>
                                    <td className="acct-card__num">{money(Number(row.amountUzs) || 0)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : null}
        </section>
    );
}
