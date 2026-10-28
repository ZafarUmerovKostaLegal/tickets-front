import { jsx as _jsx } from "react/jsx-runtime";
import { ViewTransition } from 'react';
/**
 * Route-level View Transition boundary.
 * Enter/exit/share activate when navigation runs inside startTransition
 * (see AnimatedLink / navigateWithTransition).
 */
export function PageTransition({ children }) {
    return (_jsx(ViewTransition, { name: "app-page", default: "none", enter: "page-enter", exit: "page-exit", share: "page-share", update: "none", children: _jsx("div", { className: "page-transition", children: children }) }));
}
