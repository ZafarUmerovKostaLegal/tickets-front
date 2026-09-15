import { type ReactNode, addTransitionType, startTransition } from 'react';
import { Link, NavLink, useNavigate, type NavigateFunction, type To } from 'react-router-dom';

/** Transition type used by page ViewTransition enter/exit class maps. */
export const NAV_TRANSITION_TYPE = 'navigation';

export function navigateWithTransition(navigate: NavigateFunction, to: To): void {
    startTransition(() => {
        addTransitionType(NAV_TRANSITION_TYPE);
        navigate(to);
    });
}

function useViewTransitionNavigate() {
    const navigate = useNavigate();
    return (to: To) => navigateWithTransition(navigate, to);
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
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)
            return;
        e.preventDefault();
        navigate(to);
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
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)
            return;
        e.preventDefault();
        navigate(to);
    };
    return (<NavLink to={to} className={className} end={end} onClick={handleClick} {...props}>
      {children}
    </NavLink>);
}
