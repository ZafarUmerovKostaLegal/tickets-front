import { useNavigate } from 'react-router-dom';
import { routes } from '@shared/config';
import { useI18n } from '@shared/i18n';

export type AppBackButtonProps = {

    to?: string;
    onClick?: () => void;

    historyBack?: boolean;
    className?: string;
    label?: string;
    ariaLabel?: string;

    hideLabelOnMobile?: boolean;

    iconOnly?: boolean;
};

function joinClasses(...parts: (string | false | undefined)[]): string {
    return parts.filter(Boolean).join(' ');
}

export function AppBackButton({
    to,
    onClick,
    historyBack = false,
    className,
    label: labelProp,
    ariaLabel: ariaLabelProp,
    hideLabelOnMobile = false,
    iconOnly = false,
}: AppBackButtonProps) {
    const navigate = useNavigate();
    const { t } = useI18n();
    const label = labelProp ?? t('ticketsPage.back');
    const ariaLabel = ariaLabelProp ?? t('ticketsPage.backAria');

    const handleClick = () => {
        onClick?.();
        if (historyBack) {
            navigate(-1);
            return;
        }
        const dest = to ?? (onClick ? undefined : routes.home);
        if (dest != null)
            navigate(dest);
    };

    return (
      <button
        type="button"
        className={joinClasses(
            'app-back-btn',
            iconOnly && 'app-back-btn--icon-only',
            hideLabelOnMobile && 'app-back-btn--hide-label-mobile',
            className,
        )}
        onClick={handleClick}
        aria-label={ariaLabel}
      >
        <svg
          className="app-back-btn__chevron"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
        {!iconOnly ? <span className="app-back-btn__label">{label}</span> : null}
      </button>
    );
}
