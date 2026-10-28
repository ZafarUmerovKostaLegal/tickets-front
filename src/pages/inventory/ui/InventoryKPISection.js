import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useInventory } from '../model';
const kpiCards = [
    {
        key: 'total',
        label: 'Всего',
        sub: 'позиций в выборке',
        color: 'blue',
        icon: (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("rect", { x: "3", y: "3", width: "18", height: "18", rx: "2" }), _jsx("path", { d: "M9 9h6v6H9z" })] })),
    },
    {
        key: 'use',
        label: 'В использовании',
        sub: 'выдано сотрудникам',
        color: 'green',
        icon: (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("circle", { cx: "12", cy: "12", r: "10" }), _jsx("polyline", { points: "9 12 11 14 15 10" })] })),
    },
    {
        key: 'stock',
        label: 'На складе',
        sub: 'готово к выдаче',
        color: 'cyan',
        icon: (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("polyline", { points: "21 8 21 21 3 21 3 8" }), _jsx("rect", { x: "1", y: "3", width: "22", height: "5" }), _jsx("line", { x1: "10", y1: "12", x2: "14", y2: "12" })] })),
    },
    {
        key: 'arch',
        label: 'Архив',
        sub: 'списано / не активно',
        color: 'gray',
        icon: (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("rect", { x: "3", y: "4", width: "18", height: "4", rx: "1" }), _jsx("path", { d: "M5 8h14v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" }), _jsx("path", { d: "M10 12h4" })] })),
    },
];
export function InventoryKPISection() {
    const { totalItems, inUseCount, inStockCount, archivedCount, loadingItems } = useInventory();
    const values = {
        total: totalItems,
        use: inUseCount,
        stock: inStockCount,
        arch: archivedCount,
    };
    return (_jsx("section", { className: "inv__kpi", children: kpiCards.map((c) => (_jsxs("div", { className: `inv__kpi-card inv__kpi-card--${c.color}`, children: [_jsx("div", { className: "inv__kpi-icon", children: c.icon }), loadingItems ? (_jsxs("div", { className: "inv__kpi-skel", children: [_jsx("span", {}), _jsx("span", {})] })) : (_jsxs(_Fragment, { children: [_jsx("span", { className: "inv__kpi-value", children: values[c.key] }), _jsx("span", { className: "inv__kpi-label", children: c.label }), _jsx("span", { className: "inv__kpi-sub", children: c.sub })] }))] }, c.key))) }));
}
