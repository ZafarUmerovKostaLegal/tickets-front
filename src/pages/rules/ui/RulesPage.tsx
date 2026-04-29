import { useState, useEffect } from 'react';
import { AppBackButton, AppPageSettings } from '@shared/ui';
import './RulesPage.css';
const IconFileText = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <line x1="10" y1="9" x2="8" y2="9"/>
  </svg>);
const IconTicket = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 9a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V9Z"/>
    <path d="M6 9V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3"/>
  </svg>);
const rulesSections = [
    {
        id: 'description',
        icon: IconFileText,
        title: 'Описание',
        color: 'blue',
        content: (<p className="rules-page__text">
        Тикет должен содержать понятное и полное описание задачи или обращения. Указывайте суть
        проблемы, контекст и желаемый результат.
      </p>),
    },
    {
        id: 'priority',
        icon: IconTicket,
        title: 'Приоритет и статус',
        color: 'violet',
        content: (<p className="rules-page__text">
        Выбирайте корректный приоритет в зависимости от срочности. Своевременно обновляйте статус
        тикета по мере выполнения работы.
      </p>),
    },
    {
        id: 'attachments',
        icon: IconTicket,
        title: 'Вложения',
        color: 'green',
        content: (<p className="rules-page__text">
        При необходимости прикрепляйте вложения: скриншоты, документы, файлы. Это помогает
        быстрее разобраться в задаче.
      </p>),
    },
];
export function RulesPage() {
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        const t = setTimeout(() => setLoading(false), 450);
        return () => clearTimeout(t);
    }, []);
    return (<div className="rules-page">
      <main className="rules-page__main">
        <header className="rules-page__header">
          <div className="rules-page__header-inner">
            <div className="rules-page__header-start">
              <AppBackButton className="app-back-btn" />
              <div>
                <h1 className="rules-page__title">Правила</h1>
                <p className="rules-page__subtitle">Правила создания тикетов</p>
              </div>
            </div>
            <AppPageSettings />
          </div>
        </header>

        <div className="rules-page__content">
          <div className="rules-page__container">
            {loading ? (<>
                <div className="rules-page__hero rules-page__hero--skeleton">
                  <div className="rules-page__skel rules-page__skel--icon"/>
                  <div className="rules-page__skel rules-page__skel--title"/>
                  <div className="rules-page__skel rules-page__skel--text"/>
                </div>
                <div className="rules-page__grid">
                  {[1, 2, 3].map((i) => (<div key={i} className="rules-page__card rules-page__card--skeleton">
                      <div className="rules-page__skel rules-page__skel--card-icon"/>
                      <div className="rules-page__skel rules-page__skel--card-title"/>
                      <div className="rules-page__skel rules-page__skel--card-line"/>
                      <div className="rules-page__skel rules-page__skel--card-line rules-page__skel--short"/>
                    </div>))}
                </div>
              </>) : (<>
                <div className="rules-page__hero">
                  <div className="rules-page__hero-icon">
                    <IconFileText />
                  </div>
                  <h2 className="rules-page__hero-title">Правила создания тикетов</h2>
                  <p className="rules-page__hero-text">
                    Следуйте этим правилам при создании и оформлении тикетов для быстрой обработки обращений.
                  </p>
                </div>

                <div className="rules-page__grid">
                  {rulesSections.map((section, i) => {
                const Icon = section.icon;
                return (<article key={section.id} className={`rules-page__card rules-page__card--${section.color}`} style={{ animationDelay: `${i * 0.05}s` }}>
                        <div className="rules-page__card-icon">
                          <Icon />
                        </div>
                        <h3 className="rules-page__card-title">{section.title}</h3>
                        <div className="rules-page__card-body">{section.content}</div>
                      </article>);
            })}
                </div>
              </>)}
          </div>
        </div>
      </main>
    </div>);
}
