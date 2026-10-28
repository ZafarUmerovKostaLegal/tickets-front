import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { memo, useCallback } from 'react';
import { useI18n } from '@shared/i18n';
function resolveStatusValue(statuses, tile) {
    if (tile === 'in_progress') {
        const exact = statuses.find((s) => s.value === 'in_progress');
        if (exact)
            return exact.value;
        const byLabel = statuses.find((s) => /в работе|progress/i.test(s.label));
        return byLabel?.value ?? 'in_progress';
    }
    if (tile === 'closed') {
        const exact = statuses.find((s) => s.value === 'closed');
        if (exact)
            return exact.value;
        const byLabel = statuses.find((s) => /закрыт/i.test(s.label));
        return byLabel?.value ?? 'closed';
    }
    const exact = statuses.find((s) => s.value === 'impossible');
    if (exact)
        return exact.value;
    const byLabel = statuses.find((s) => /невозмож|impossible/i.test(s.label + s.value));
    return byLabel?.value ?? 'impossible';
}
export const HomeStats = memo(function HomeStats({ total, ticketStats, filterStatus, setFilterStatus, statuses, }) {
    const { t } = useI18n();
    const onTotal = useCallback(() => setFilterStatus(''), [setFilterStatus]);
    const onProgress = useCallback(() => {
        setFilterStatus(resolveStatusValue(statuses, 'in_progress'));
    }, [setFilterStatus, statuses]);
    const onClosed = useCallback(() => {
        setFilterStatus(resolveStatusValue(statuses, 'closed'));
    }, [setFilterStatus, statuses]);
    const onImpossible = useCallback(() => {
        setFilterStatus(resolveStatusValue(statuses, 'impossible'));
    }, [setFilterStatus, statuses]);
    const vInProgress = resolveStatusValue(statuses, 'in_progress');
    const vClosed = resolveStatusValue(statuses, 'closed');
    const vImpossible = resolveStatusValue(statuses, 'impossible');
    return (_jsxs("div", { className: "home-stats", children: [_jsxs("button", { type: "button", className: `home-stats__card home-stats__card--total${filterStatus === '' ? ' home-stats__card--active' : ''}`, onClick: onTotal, "aria-pressed": filterStatus === '', children: [_jsx("div", { className: "home-stats__icon-wrap home-stats__icon-wrap--total", children: _jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.75", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" }), _jsx("polyline", { points: "14 2 14 8 20 8" })] }) }), _jsxs("div", { className: "home-stats__text", children: [_jsx("span", { className: "home-stats__number", children: total }), _jsx("span", { className: "home-stats__label", children: t('ticketsPage.stats.total') })] })] }), _jsxs("button", { type: "button", className: `home-stats__card home-stats__card--progress${filterStatus === vInProgress ? ' home-stats__card--active' : ''}`, onClick: onProgress, "aria-pressed": filterStatus === vInProgress, children: [_jsx("div", { className: "home-stats__icon-wrap home-stats__icon-wrap--progress", children: _jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.75", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("circle", { cx: "12", cy: "12", r: "10" }), _jsx("polyline", { points: "12 6 12 12 16 14" })] }) }), _jsxs("div", { className: "home-stats__text", children: [_jsx("span", { className: "home-stats__number", children: ticketStats.inProgress }), _jsx("span", { className: "home-stats__label", children: t('ticketsPage.stats.inProgress') })] })] }), _jsxs("button", { type: "button", className: `home-stats__card home-stats__card--closed${filterStatus === vClosed ? ' home-stats__card--active' : ''}`, onClick: onClosed, "aria-pressed": filterStatus === vClosed, children: [_jsx("div", { className: "home-stats__icon-wrap home-stats__icon-wrap--closed", children: _jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.75", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("path", { d: "M22 11.08V12a10 10 0 1 1-5.93-9.14" }), _jsx("polyline", { points: "22 4 12 14.01 9 11.01" })] }) }), _jsxs("div", { className: "home-stats__text", children: [_jsx("span", { className: "home-stats__number", children: ticketStats.closed }), _jsx("span", { className: "home-stats__label", children: t('ticketsPage.stats.closed') })] })] }), _jsxs("button", { type: "button", className: `home-stats__card home-stats__card--impossible${filterStatus === vImpossible ? ' home-stats__card--active' : ''}`, onClick: onImpossible, "aria-pressed": filterStatus === vImpossible, children: [_jsx("div", { className: "home-stats__icon-wrap home-stats__icon-wrap--impossible", children: _jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.75", strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("circle", { cx: "12", cy: "12", r: "10" }), _jsx("line", { x1: "12", y1: "8", x2: "12", y2: "12" }), _jsx("line", { x1: "12", y1: "16", x2: "12.01", y2: "16" })] }) }), _jsxs("div", { className: "home-stats__text", children: [_jsx("span", { className: "home-stats__number", children: ticketStats.impossible }), _jsx("span", { className: "home-stats__label", children: t('ticketsPage.stats.impossible') })] })] })] }));
});
