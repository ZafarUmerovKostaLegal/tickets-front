import { useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import './ExpensesNestedLayout.css';
function pathSegmentDepth(pathname: string): number {
    return pathname.replace(/\/+$/, '').split('/').filter(Boolean).length;
}
export function ExpensesNestedLayout() {
    const location = useLocation();
    const cur = location.pathname;
    const prevRef = useRef<string | null>(null);
    let anim: 'from-right' | 'from-left' | 'fade' | 'none' = 'none';
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
    return (<div className="expenses-nested-layout">
      <div key={cur} className={`expenses-route-view ${animClass}`}>
        <Outlet />
      </div>
    </div>);
}
