import { useNavigate } from 'react-router-dom';
import { routes } from '@shared/config';

export type AppBackButtonProps = {
    
    to?: string;
    className?: string;
    label?: string;
    
    ariaLabel?: string;
};

export function AppBackButton({ to = routes.home, className, label = 'Назад', ariaLabel, }: AppBackButtonProps) {
    const navigate = useNavigate();
    return (<button type="button" className={className ?? 'app-back-btn'} onClick={() => navigate(to)} aria-label={ariaLabel ?? label}>
      <svg className="app-back-btn__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="m15 18-6-6 6-6"/>
      </svg>
      <span className="app-back-btn__label">{label}</span>
    </button>);
}
