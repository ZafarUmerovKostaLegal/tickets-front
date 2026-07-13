import type { ReactNode } from 'react';
import { Link, NavLink, useNavigate, type To } from 'react-router-dom';
function useViewTransitionNavigate() {
    const navigate = useNavigate();
    return (to: To) => {
        const startVT = typeof document !== 'undefined' && (document as Document & {
            startViewTransition?: (cb: () => void) => void;
        }).startViewTransition;
        if (startVT) {
            (document as Document & {
                startViewTransition: (cb: () => void) => void;
            }).startViewTransition(() => {
                navigate(to);
            });
        }
        else {
            navigate(to);
        }
    };
}
type AnimatedLinkProps = {
    to: To;
    children: ReactNode;
    className?: string;
    onClick?: (e: React.MouseEvent) => void;
    [key: string]: unknown;
};
export function AnimatedLink({ to, children, onClick, ...props }: AnimatedLinkProps) {
    const navigate = useViewTransitionNavigate();
    const handleClick = (e: React.MouseEvent) => {
        if (onClick) {
            onClick(e);
            if (e.defaultPrevented)
                return;
        }
        if (typeof document !== 'undefined' && 'startViewTransition' in document && typeof (document as Document & {
            startViewTransition?: (cb: () => void) => void;
        }).startViewTransition === 'function') {
            e.preventDefault();
            navigate(to);
        }
    };
    return (<Link to={to} onClick={handleClick} {...props}>
      {children}
    </Link>);
}
type AnimatedNavLinkProps = {
    to: To;
    children: ReactNode;
    className?: string | ((props: {
        isActive: boolean;
    }) => string);
    end?: boolean;
    onClick?: (e: React.MouseEvent) => void;
    title?: string;
    [key: string]: unknown;
};
export function AnimatedNavLink({ to, children, className, end, onClick, ...props }: AnimatedNavLinkProps) {
    const navigate = useViewTransitionNavigate();
    const handleClick = (e: React.MouseEvent) => {
        if (onClick) {
            onClick(e);
            if (e.defaultPrevented)
                return;
        }
        if (typeof document !== 'undefined' && 'startViewTransition' in document && typeof (document as Document & {
            startViewTransition?: (cb: () => void) => void;
        }).startViewTransition === 'function') {
            e.preventDefault();
            navigate(to);
        }
    };
    return (<NavLink to={to} className={className} end={end} onClick={handleClick} {...props}>
      {children}
    </NavLink>);
}
