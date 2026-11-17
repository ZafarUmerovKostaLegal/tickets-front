import { type ReactNode, ViewTransition } from 'react';

type PageTransitionProps = {
    children: ReactNode;
};

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
