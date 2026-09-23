import { type ReactNode } from 'react';
import { routes } from '@shared/config';
import { AppBackButton, AppHomeLogo, AppPageSettings } from '@shared/ui';
import './ExpensesPage.css';
type ExpensesShellProps = {
    title: string;
    backTo?: string;
    children?: ReactNode;
};
export function ExpensesShell({ title, backTo = routes.home, children }: ExpensesShellProps) {
    return (<div className="expenses-page">
      <main className="expenses-page__main">
        <header className="expenses-page__header">
          <div className="expenses-page__header-inner">
            <div className="expenses-page__header-start">
              <AppBackButton className="app-back-btn" to={backTo} />
              <AppHomeLogo withSeparator />
              <div className="expenses-page__header-titles">
                <h1 className="expenses-page__title">{title}</h1>
              </div>
            </div>
            <AppPageSettings />
          </div>
        </header>
        <div className="expenses-page__content">{children}</div>
      </main>
    </div>);
}
