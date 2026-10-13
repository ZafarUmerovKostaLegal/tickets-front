import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
    createItem,
    getCategories,
    getItemByInventoryNumber,
    getStatuses,
    parseEquipmentQrCode,
    type InventoryCategory,
    type InventoryItem,
    type InventoryStatusItem,
} from '@entities/inventory';
import { useCurrentUser } from '@shared/hooks';
import { routes } from '@shared/config';
import { AppBackButton, AppHomeLogo } from '@shared/ui';
import { canCreateInventoryItem } from '../model/constants';
import './InventoryPage.css';

export function InventoryTagPage() {
    const { code: rawCode = '' } = useParams();
    const code = parseEquipmentQrCode(decodeURIComponent(rawCode));
    const { user } = useCurrentUser();
    const canAdd = canCreateInventoryItem(user?.role);
    const [item, setItem] = useState<InventoryItem | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [categories, setCategories] = useState<InventoryCategory[]>([]);
    const [statuses, setStatuses] = useState<InventoryStatusItem[]>([]);
    const [adding, setAdding] = useState(false);
    const [name, setName] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [serial, setSerial] = useState('');
    const [status, setStatus] = useState('in_stock');
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    useEffect(() => {
        if (!code) {
            setLoading(false);
            return;
        }
        let live = true;
        setLoading(true);
        setError(null);
        Promise.all([
            getItemByInventoryNumber(code),
            getCategories().catch(() => [] as InventoryCategory[]),
            getStatuses().catch(() => [] as InventoryStatusItem[]),
        ])
            .then(([found, cats, sts]) => {
                if (!live)
                    return;
                setItem(found);
                setCategories(cats);
                setStatuses(sts);
                if (cats[0])
                    setCategoryId(String(cats[0].id));
            })
            .catch((err: unknown) => {
                if (!live)
                    return;
                setError(err instanceof Error ? err.message : 'Не удалось открыть код');
            })
            .finally(() => {
                if (live)
                    setLoading(false);
            });
        return () => {
            live = false;
        };
    }, [code]);

    async function handleCreate(event: FormEvent) {
        event.preventDefault();
        if (!code)
            return;
        const trimmed = name.trim();
        if (!trimmed) {
            setFormError('Укажите название техники');
            return;
        }
        if (!categoryId) {
            setFormError('Выберите категорию');
            return;
        }
        setSaving(true);
        setFormError(null);
        try {
            const form = new FormData();
            form.append('name', trimmed);
            form.append('category_id', categoryId);
            form.append('inventory_number', code);
            form.append('status', status);
            if (serial.trim())
                form.append('serial_number', serial.trim());
            const created = await createItem(form);
            setItem(created);
            setAdding(false);
        }
        catch (err: unknown) {
            setFormError(err instanceof Error ? err.message : 'Не удалось сохранить технику');
        }
        finally {
            setSaving(false);
        }
    }

    const categoryName = item ? categories.find((c) => c.id === item.category_id)?.name : '';
    const statusName = item ? statuses.find((s) => s.value === item.status)?.label ?? item.status : '';

    return (
        <div className="inv">
            <main className="inv__main">
                <header className="inv__header">
                    <div className="inv__header-inner">
                        <div className="inv__header-start">
                            <AppBackButton className="app-back-btn" />
                            <AppHomeLogo withSeparator />
                            <div>
                                <h1 className="inv__title">Техника</h1>
                                <p className="inv__subtitle">{code ?? 'Неизвестный код'}</p>
                            </div>
                        </div>
                    </div>
                </header>
                <div className="inv__content">
                    {!code ? (
                        <section className="inv-tag">
                            <h2>Код не распознан</h2>
                            <p>Эта наклейка не из набора QR для техники.</p>
                        </section>
                    ) : loading ? (
                        <p className="inv__subtitle">Загрузка…</p>
                    ) : error ? (
                        <section className="inv-tag">
                            <h2>Не удалось открыть код</h2>
                            <p>{error}</p>
                        </section>
                    ) : item ? (
                        <section className="inv-tag">
                            <p className="inv-tag__code">{code}</p>
                            <h2>{item.name}</h2>
                            <dl className="inv-tag__facts">
                                <div><dt>Категория</dt><dd>{categoryName || '—'}</dd></div>
                                <div><dt>Статус</dt><dd>{statusName}</dd></div>
                                <div><dt>Серийный номер</dt><dd>{item.serial_number || '—'}</dd></div>
                                <div><dt>Инвентарный номер</dt><dd>{item.inventory_number}</dd></div>
                            </dl>
                            {item.is_archived ? <p>Карточка в архиве.</p> : null}
                            {item.description ? <p>{item.description}</p> : null}
                            <Link className="inv__btn inv__btn--primary" to={routes.inventory}>Открыть инвентаризацию</Link>
                        </section>
                    ) : (
                        <section className="inv-tag">
                            <p className="inv-tag__code">{code}</p>
                            <h2>Техника пока не определена</h2>
                            <p>На этот QR ещё не заведена карточка. Наклейте код на устройство, затем добавьте данные в системе.</p>
                            {canAdd && !adding ? (
                                <button type="button" className="inv__btn inv__btn--primary" onClick={() => setAdding(true)}>
                                    Добавить технику
                                </button>
                            ) : null}
                            {canAdd && adding && categories.length === 0 ? (
                                <p>Сначала создайте категорию в инвентаризации, затем вернитесь к этому коду.</p>
                            ) : null}
                            {canAdd && adding && categories.length > 0 ? (
                                <form className="inv-tag__form" onSubmit={(event) => void handleCreate(event)}>
                                    <label>
                                        Название
                                        <input className="inv__input" value={name} onChange={(event) => setName(event.target.value)} required />
                                    </label>
                                    <label>
                                        Категория
                                        <select className="inv__input" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required>
                                            {categories.map((category) => (
                                                <option key={category.id} value={category.id}>{category.name}</option>
                                            ))}
                                        </select>
                                    </label>
                                    <label>
                                        Серийный номер
                                        <input className="inv__input" value={serial} onChange={(event) => setSerial(event.target.value)} />
                                    </label>
                                    <label>
                                        Статус
                                        <select className="inv__input" value={status} onChange={(event) => setStatus(event.target.value)}>
                                            {(statuses.length ? statuses : [
                                                { value: 'in_stock', label: 'На складе' },
                                                { value: 'in_use', label: 'В использовании' },
                                            ]).map((row) => (
                                                <option key={row.value} value={row.value}>{row.label}</option>
                                            ))}
                                        </select>
                                    </label>
                                    {formError ? <p className="inv-tag__error">{formError}</p> : null}
                                    <div className="inv-tag__actions">
                                        <button type="submit" className="inv__btn inv__btn--primary" disabled={saving}>
                                            {saving ? 'Сохранение…' : 'Сохранить'}
                                        </button>
                                        <button type="button" className="inv__btn inv__btn--ghost" onClick={() => setAdding(false)} disabled={saving}>
                                            Отмена
                                        </button>
                                    </div>
                                </form>
                            ) : null}
                            {!canAdd ? <p>Добавить технику могут IT, офис-менеджер, партнёр или администратор.</p> : null}
                        </section>
                    )}
                </div>
            </main>
        </div>
    );
}
