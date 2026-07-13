import { useNavigate } from 'react-router-dom';
import { routes } from '@shared/config';
import { useI18n } from '@shared/i18n';

export type AppHomeLogoProps = {
    className?: string;

    withSeparator?: boolean;
};

function joinClasses(...parts: (string | false | undefined)[]): string {
    return parts.filter(Boolean).join(' ');
}


export function AppHomeLogo({ className, withSeparator = false }: AppHomeLogoProps) {
    const navigate = useNavigate();
    const { t } = useI18n();
    const label = t('brand.homeAria');

    return (
      <>
        {withSeparator ? <span className="app-home-logo__sep" aria-hidden="true" /> : null}
        <button
          type="button"
          className={joinClasses('app-home-logo', className)}
          onClick={() => navigate(routes.home)}
          aria-label={label}
          title={label}
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
