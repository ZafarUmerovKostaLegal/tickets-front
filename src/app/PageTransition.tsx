import { type ReactNode, ViewTransition } from 'react';

type PageTransitionProps = {
    children: ReactNode;
};

/**
 * Route-level View Transition boundary.
 * Enter/exit/share activate when navigation runs inside startTransition
 * (see AnimatedLink / navigateWithTransition).
 */
export function PageTransition({ children }: PageTransitionProps) {
    return (
        <ViewTransition
            name="app-page"
            default="none"
            enter="page-enter"
            exit="page-exit"
            share="page-share"
            update="none"
        >
            <div className="page-transition">{children}</div>
        </ViewTransition>
    );
}
