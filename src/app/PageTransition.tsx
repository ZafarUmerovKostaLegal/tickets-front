import type { ReactNode } from 'react';
type PageTransitionProps = {
    children: ReactNode;
};
export function PageTransition({ children }: PageTransitionProps) {
    return <div className="page-transition">{children}</div>;
}
