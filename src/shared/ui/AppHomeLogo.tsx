import { useNavigate } from 'react-router-dom';
import { routes } from '@shared/config';
import { useI18n } from '@shared/i18n';

export type AppHomeLogoProps = {
    className?: string;

    withSeparator?: boolean;
    to?: string;
    ariaLabel?: string;
    title?: string;
};

function joinClasses(...parts: (string | false | undefined)[]): string {
    return parts.filter(Boolean).join(' ');
}

export function AppHomeLogo({ className, withSeparator = false, to, ariaLabel, title }: AppHomeLogoProps) {
    const navigate = useNavigate();
    const { t } = useI18n();
    const label = ariaLabel ?? t('brand.homeAria');
    const tip = title ?? label;

    return (
      <>
        {withSeparator ? <span className="app-home-logo__sep" aria-hidden="true" /> : null}
        <button
          type="button"
          className={joinClasses('app-home-logo', className)}
          onClick={() => navigate(to ?? routes.home)}
          aria-label={label}
          title={tip}
        >
          <img
            src="/logo.svg"
            alt=""
            className="app-home-logo__img"
            width={24}
            height={34}
            draggable={false}
          />
        </button>
      </>
    );
}
