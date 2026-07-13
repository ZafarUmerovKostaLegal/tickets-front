import type { ReactNode } from 'react';
import { AppBackButton } from '@shared/ui';
import { routes } from '@shared/config';
import { useI18n } from '@shared/i18n';

export type TimeTrackingHeaderProps = {
    trailing?: ReactNode;
};

export function TimeTrackingHeader({ trailing }: TimeTrackingHeaderProps) {
    const { t } = useI18n();
    const withManager = Boolean(trailing);
    return (
      <header className={`time-page__header${withManager ? ' time-page__header--with-manager' : ''}`.trim()}>
        <AppBackButton to={routes.home} hideLabelOnMobile />
        <div className="time-page__header-divider" />
        <div className="time-page__header-inner">
          <h1 className="time-page__title">{t('timeTrackingPage.page.title')}</h1>
          {trailing ? <div className="time-page__header-trailing">{trailing}</div> : null}
        </div>
      </header>
    );
}
