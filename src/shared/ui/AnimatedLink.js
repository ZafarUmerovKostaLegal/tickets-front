import { jsx as _jsx } from "react/jsx-runtime";
import { addTransitionType, startTransition } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
/** Transition type used by page ViewTransition enter/exit class maps. */
export const NAV_TRANSITION_TYPE = 'navigation';
export function navigateWithTransition(navigate, to) {
    startTransition(() => {
        addTransitionType(NAV_TRANSITION_TYPE);
        navigate(to);
    });
}
function useViewTransitionNavigate() {
    const navigate = useNavigate();
    return (to) => navigateWithTransition(navigate, to);
}
export function AnimatedLink({ to, children, onClick, ...props }) {
    const navigate = useViewTransitionNavigate();
    const handleClick = (e) => {
        if (onClick) {
            onClick(e);
            if (e.defaultPrevented)
                return;
        }
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)
            return;
        e.preventDefault();
        navigate(to);
    };
    return (_jsx(Link, { to: to, onClick: handleClick, ...props, children: children }));
}
export function AnimatedNavLink({ to, children, className, end, onClick, ...props }) {
    const navigate = useViewTransitionNavigate();
    const handleClick = (e) => {
        if (onClick) {
            onClick(e);
            if (e.defaultPrevented)
                return;
        }
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)
            return;
        e.preventDefault();
        navigate(to);
    };
    return (_jsx(NavLink, { to: to, className: className, end: end, onClick: handleClick, ...props, children: children }));
}
