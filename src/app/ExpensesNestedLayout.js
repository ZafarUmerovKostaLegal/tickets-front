import { jsx as _jsx } from "react/jsx-runtime";
import { useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import './ExpensesNestedLayout.css';
function pathSegmentDepth(pathname) {
    return pathname.replace(/\/+$/, '').split('/').filter(Boolean).length;
}
export function ExpensesNestedLayout() {
    const location = useLocation();
    const cur = location.pathname;
    const prevRef = useRef(null);
    let anim = 'none';
    const prev = prevRef.current;
    if (prev !== null && prev !== cur) {
        const dPrev = pathSegmentDepth(prev);
        const dCur = pathSegmentDepth(cur);
        if (dCur > dPrev)
            anim = 'from-right';
        else if (dCur < dPrev)
            anim = 'from-left';
        else
            anim = 'fade';
    }
    prevRef.current = cur;
    const animClass = anim === 'none'
        ? 'expenses-route-view--none'
        : anim === 'from-right'
            ? 'expenses-route-view--from-right'
            : anim === 'from-left'
                ? 'expenses-route-view--from-left'
                : 'expenses-route-view--fade';
    return (_jsx("div", { className: "expenses-nested-layout", children: _jsx("div", { className: `expenses-route-view ${animClass}`, children: _jsx(Outlet, {}) }, cur) }));
}
