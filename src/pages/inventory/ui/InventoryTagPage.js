import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { createItem, getCategories, getItemByInventoryNumber, getStatuses, parseEquipmentQrCode, } from '@entities/inventory';
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
    const [item, setItem] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [categories, setCategories] = useState([]);
    const [statuses, setStatuses] = useState([]);
    const [adding, setAdding] = useState(false);
    const [name, setName] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [serial, setSerial] = useState('');
    const [status, setStatus] = useState('in_stock');
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState(null);
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
            getCategories().catch(() => []),
            getStatuses().catch(() => []),
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
            .catch((err) => {
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
    async function handleCreate(event) {
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
        catch (err) {
            setFormError(err instanceof Error ? err.message : 'Не удалось сохранить технику');
        }
        finally {
            setSaving(false);
        }
    }
    const categoryName = item ? categories.find((c) => c.id === item.category_id)?.name : '';
    const statusName = item ? statuses.find((s) => s.value === item.status)?.label ?? item.status : '';
    return (_jsx("div", { className: "inv", children: _jsxs("main", { className: "inv__main", children: [_jsx("header", { className: "inv__header", children: _jsx("div", { className: "inv__header-inner", children: _jsxs("div", { className: "inv__header-start", children: [_jsx(AppBackButton, { className: "app-back-btn" }), _jsx(AppHomeLogo, { withSeparator: true }), _jsxs("div", { children: [_jsx("h1", { className: "inv__title", children: "\u0422\u0435\u0445\u043D\u0438\u043A\u0430" }), _jsx("p", { className: "inv__subtitle", children: code ?? 'Неизвестный код' })] })] }) }) }), _jsx("div", { className: "inv__content", children: !code ? (_jsxs("section", { className: "inv-tag", children: [_jsx("h2", { children: "\u041A\u043E\u0434 \u043D\u0435 \u0440\u0430\u0441\u043F\u043E\u0437\u043D\u0430\u043D" }), _jsx("p", { children: "\u042D\u0442\u0430 \u043D\u0430\u043A\u043B\u0435\u0439\u043A\u0430 \u043D\u0435 \u0438\u0437 \u043D\u0430\u0431\u043E\u0440\u0430 QR \u0434\u043B\u044F \u0442\u0435\u0445\u043D\u0438\u043A\u0438." })] })) : loading ? (_jsx("p", { className: "inv__subtitle", children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430\u2026" })) : error ? (_jsxs("section", { className: "inv-tag", children: [_jsx("h2", { children: "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u0442\u043A\u0440\u044B\u0442\u044C \u043A\u043E\u0434" }), _jsx("p", { children: error })] })) : item ? (_jsxs("section", { className: "inv-tag", children: [_jsx("p", { className: "inv-tag__code", children: code }), _jsx("h2", { children: item.name }), _jsxs("dl", { className: "inv-tag__facts", children: [_jsxs("div", { children: [_jsx("dt", { children: "\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F" }), _jsx("dd", { children: categoryName || '—' })] }), _jsxs("div", { children: [_jsx("dt", { children: "\u0421\u0442\u0430\u0442\u0443\u0441" }), _jsx("dd", { children: statusName })] }), _jsxs("div", { children: [_jsx("dt", { children: "\u0421\u0435\u0440\u0438\u0439\u043D\u044B\u0439 \u043D\u043E\u043C\u0435\u0440" }), _jsx("dd", { children: item.serial_number || '—' })] }), _jsxs("div", { children: [_jsx("dt", { children: "\u0418\u043D\u0432\u0435\u043D\u0442\u0430\u0440\u043D\u044B\u0439 \u043D\u043E\u043C\u0435\u0440" }), _jsx("dd", { children: item.inventory_number })] })] }), item.is_archived ? _jsx("p", { children: "\u041A\u0430\u0440\u0442\u043E\u0447\u043A\u0430 \u0432 \u0430\u0440\u0445\u0438\u0432\u0435." }) : null, item.description ? _jsx("p", { children: item.description }) : null, _jsx(Link, { className: "inv__btn inv__btn--primary", to: routes.inventory, children: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0438\u043D\u0432\u0435\u043D\u0442\u0430\u0440\u0438\u0437\u0430\u0446\u0438\u044E" })] })) : (_jsxs("section", { className: "inv-tag", children: [_jsx("p", { className: "inv-tag__code", children: code }), _jsx("h2", { children: "\u0422\u0435\u0445\u043D\u0438\u043A\u0430 \u043F\u043E\u043A\u0430 \u043D\u0435 \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0430" }), _jsx("p", { children: "\u041D\u0430 \u044D\u0442\u043E\u0442 QR \u0435\u0449\u0451 \u043D\u0435 \u0437\u0430\u0432\u0435\u0434\u0435\u043D\u0430 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0430. \u041D\u0430\u043A\u043B\u0435\u0439\u0442\u0435 \u043A\u043E\u0434 \u043D\u0430 \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E, \u0437\u0430\u0442\u0435\u043C \u0434\u043E\u0431\u0430\u0432\u044C\u0442\u0435 \u0434\u0430\u043D\u043D\u044B\u0435 \u0432 \u0441\u0438\u0441\u0442\u0435\u043C\u0435." }), canAdd && !adding ? (_jsx("button", { type: "button", className: "inv__btn inv__btn--primary", onClick: () => setAdding(true), children: "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0442\u0435\u0445\u043D\u0438\u043A\u0443" })) : null, canAdd && adding && categories.length === 0 ? (_jsx("p", { children: "\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0441\u043E\u0437\u0434\u0430\u0439\u0442\u0435 \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044E \u0432 \u0438\u043D\u0432\u0435\u043D\u0442\u0430\u0440\u0438\u0437\u0430\u0446\u0438\u0438, \u0437\u0430\u0442\u0435\u043C \u0432\u0435\u0440\u043D\u0438\u0442\u0435\u0441\u044C \u043A \u044D\u0442\u043E\u043C\u0443 \u043A\u043E\u0434\u0443." })) : null, canAdd && adding && categories.length > 0 ? (_jsxs("form", { className: "inv-tag__form", onSubmit: (event) => void handleCreate(event), children: [_jsxs("label", { children: ["\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435", _jsx("input", { className: "inv__input", value: name, onChange: (event) => setName(event.target.value), required: true })] }), _jsxs("label", { children: ["\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F", _jsx("select", { className: "inv__input", value: categoryId, onChange: (event) => setCategoryId(event.target.value), required: true, children: categories.map((category) => (_jsx("option", { value: category.id, children: category.name }, category.id))) })] }), _jsxs("label", { children: ["\u0421\u0435\u0440\u0438\u0439\u043D\u044B\u0439 \u043D\u043E\u043C\u0435\u0440", _jsx("input", { className: "inv__input", value: serial, onChange: (event) => setSerial(event.target.value) })] }), _jsxs("label", { children: ["\u0421\u0442\u0430\u0442\u0443\u0441", _jsx("select", { className: "inv__input", value: status, onChange: (event) => setStatus(event.target.value), children: (statuses.length ? statuses : [
                                                    { value: 'in_stock', label: 'На складе' },
                                                    { value: 'in_use', label: 'В использовании' },
                                                ]).map((row) => (_jsx("option", { value: row.value, children: row.label }, row.value))) })] }), formError ? _jsx("p", { className: "inv-tag__error", children: formError }) : null, _jsxs("div", { className: "inv-tag__actions", children: [_jsx("button", { type: "submit", className: "inv__btn inv__btn--primary", disabled: saving, children: saving ? 'Сохранение…' : 'Сохранить' }), _jsx("button", { type: "button", className: "inv__btn inv__btn--ghost", onClick: () => setAdding(false), disabled: saving, children: "\u041E\u0442\u043C\u0435\u043D\u0430" })] })] })) : null, !canAdd ? _jsx("p", { children: "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0442\u0435\u0445\u043D\u0438\u043A\u0443 \u043C\u043E\u0433\u0443\u0442 IT, \u043E\u0444\u0438\u0441-\u043C\u0435\u043D\u0435\u0434\u0436\u0435\u0440, \u043F\u0430\u0440\u0442\u043D\u0451\u0440 \u0438\u043B\u0438 \u0430\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440." }) : null] })) })] }) }));
}
