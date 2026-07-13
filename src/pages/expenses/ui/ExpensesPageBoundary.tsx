import { Component, type ErrorInfo, type ReactNode } from 'react';
import './ExpensesPage.css';
type Props = {
    children: ReactNode;
};
type State = {
    error: Error | null;
};
export class ExpensesPageBoundary extends Component<Props, State> {
    state: State = { error: null };
    static getDerivedStateFromError(error: Error): State {
        return { error };
    }
    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error('[ExpensesPageBoundary]', error.message, info.componentStack);
    }
    private handleRetry = () => {
        this.setState({ error: null });
    };
    render() {
        if (this.state.error) {
            const msg = this.state.error.message;
            const legacyEquiv = msg.includes('equivalentAmount') && msg.includes('toFixed');
            return (<div className="expenses-page" style={{ minHeight: '100vh' }}>
          <main className="expenses-page__main">
            <div className="expenses-page__content">
              <div className="exp-service-err" role="alert">
                <h2 className="exp-service-err__title">Не удалось открыть раздел расходов</h2>
                <p className="exp-service-err__desc">
                  {legacyEquiv ? (<>
                      Ошибка формата суммы в USD в устаревшем JS. Нужна <strong>новая сборка</strong> фронта и сброс кэша
                      (Ctrl+Shift+R). В репозитории включён <strong>демо-режим без API</strong> — после деплоя страница
                      должна открываться.
                    </>) : (msg)}
                </p>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button type="button" className="exp-service-err__btn" onClick={this.handleRetry}>
                    Повторить
                  </button>
                  <button type="button" className="exp-service-err__btn" onClick={() => window.location.reload()}>
                    Перезагрузить страницу
                  </button>
                </div>
              </div>
            </div>
          </main>
        </div>);
        }
        return this.props.children;
    }
}
