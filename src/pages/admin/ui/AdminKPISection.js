import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
const KPI_CARDS = [
    { key: 'active', label: 'Активные', sub: 'из пользователей', color: 'blue', icon: _jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" }), _jsx("circle", { cx: "9", cy: "7", r: "4" }), _jsx("path", { d: "M22 21v-2a4 4 0 0 0-3-3.87" }), _jsx("path", { d: "M16 3.13a4 4 0 0 1 0 7.75" })] }) },
    { key: 'blocked', label: 'Заблокированные', sub: 'флаг блокировки', color: 'orange', icon: _jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("circle", { cx: "12", cy: "12", r: "10" }), _jsx("line", { x1: "4.93", y1: "4.93", x2: "19.07", y2: "19.07" })] }) },
    { key: 'archived', label: 'Архив', sub: 'в архиве', color: 'green', icon: _jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("polyline", { points: "21 8 21 21 3 21 3 8" }), _jsx("rect", { x: "1", y: "3", width: "22", height: "5" }), _jsx("line", { x1: "10", y1: "12", x2: "14", y2: "12" })] }) },
    { key: 'roles', label: 'Ролей', sub: 'уникальных', color: 'violet', icon: _jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: _jsx("path", { d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" }) }) },
];
export function AdminKPISection({ metrics, loading, usersCount }) {
    const values = {
        active: metrics.activeUsers,
        blocked: metrics.blockedUsers,
        archived: metrics.archivedUsers,
        roles: metrics.roles.length,
    };
    const subs = {
        active: `из ${metrics.totalUsers} пользователей`,
        blocked: 'флаг блокировки',
        archived: 'в архиве',
        roles: 'уникальных',
    };
    return (_jsx("section", { className: "ap__kpi", style: { gap: 'var(--ap-kpi-gap)' }, children: KPI_CARDS.map((card) => (_jsxs("div", { className: `ap__kpi-card ap__kpi-card--${card.color}`, style: { borderRadius: 'var(--ap-kpi-card-border-radius)', padding: 'var(--ap-kpi-card-padding)', gap: 'var(--ap-kpi-card-gap)', background: 'var(--ap-kpi-card-bg)', border: 'var(--ap-kpi-card-border)' }, children: [_jsx("div", { className: "ap__kpi-icon", children: card.icon }), loading && usersCount === 0 ? (_jsxs("div", { className: "ap__kpi-skel", style: { gap: 'var(--ap-kpi-skel-gap)' }, children: [_jsx("span", { style: { height: 'var(--ap-skel-md-height)', width: 'var(--ap-skel-md-width)', borderRadius: 'var(--ap-skel-border-radius)' } }), _jsx("span", { style: { height: 'var(--ap-skel-sm-height)', width: 'var(--ap-skel-sm-width)', borderRadius: 'var(--ap-skel-border-radius)' } })] })) : (_jsxs(_Fragment, { children: [_jsx("span", { className: "ap__kpi-value", style: { fontSize: 'var(--ap-kpi-value-font-size)', fontWeight: 'var(--ap-kpi-value-font-weight)' }, children: values[card.key] }), _jsx("span", { className: "ap__kpi-label", style: { fontSize: 'var(--ap-kpi-label-font-size)', color: 'var(--ap-kpi-label-color)', fontWeight: 'var(--ap-kpi-label-font-weight)' }, children: card.label }), _jsx("span", { className: "ap__kpi-sub", style: { fontSize: 'var(--ap-kpi-sub-font-size)', color: 'var(--ap-kpi-sub-color)' }, children: subs[card.key] })] }))] }, card.key))) }));
}
