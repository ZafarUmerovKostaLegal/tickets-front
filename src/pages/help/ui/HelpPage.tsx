import { useState, useEffect } from 'react';
import { AppBackButton, AppPageSettings } from '@shared/ui';
import './HelpPage.css';
const IconHelp = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
    <path d="M12 17h.01"/>
  </svg>);
const IconPrinter = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 6 2 18 2 18 9"/>
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
    <rect x="6" y="14" width="12" height="8"/>
  </svg>);
const IconWifi = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 13a10 10 0 0 1 14 0"/>
    <path d="M8.5 16.429a5 5 0 0 1 7 0"/>
    <path d="M2 8.82a15 15 0 0 1 20 0"/>
    <line x1="12" y1="20" x2="12.01" y2="20"/>
  </svg>);
const IconMonitor = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2"/>
    <line x1="8" y1="21" x2="16" y2="21"/>
    <line x1="12" y1="17" x2="12" y2="21"/>
  </svg>);
const IconKey = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
  </svg>);
const IconBox = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
    <line x1="12" y1="22.08" x2="12" y2="12"/>
  </svg>);
const IconMail = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
    <polyline points="22,6 12,13 2,6"/>
  </svg>);
const faqItems = [
    {
        id: 'printer',
        icon: IconPrinter,
        question: 'Как подключить принтер?',
        color: 'blue',
        answer: 'Создайте тикет с темой «Подключение принтера». Укажите модель принтера, кабинет и способ подключения (USB или сеть). IT-специалист установит драйверы и настроит печать.',
    },
    {
        id: 'wifi',
        icon: IconWifi,
        question: 'Не подключается Wi‑Fi. Что делать?',
        color: 'violet',
        answer: 'Проверьте, что выбран правильный SSID офисной сети. Если пароль не подходит или сеть не отображается — создайте тикет «Проблема с Wi‑Fi» с указанием устройства и кабинета.',
    },
    {
        id: 'monitor',
        icon: IconMonitor,
        question: 'Как подключить второй монитор к ноутбуку?',
        color: 'green',
        answer: 'Подключите кабель HDMI или DisplayPort к разъёмам ноутбука и монитора. В Windows нажмите Win+P и выберите «Дублировать» или «Расширить». Если монитор не определяется — проверьте кабель и драйверы видеокарты, при необходимости создайте тикет.',
    },
    {
        id: 'access',
        icon: IconKey,
        question: 'Как получить доступ к системе или папке?',
        color: 'orange',
        answer: 'Создайте тикет «Выдача доступа» с указанием системы или пути к папке и обоснованием. Запрос согласуется с руководителем, после чего доступ выдаётся IT-отделом.',
    },
    {
        id: 'supplies',
        icon: IconBox,
        question: 'Как заказать канцтовары или картриджи?',
        color: 'blue',
        answer: 'Оформите тикет «Заявка на канцтовары» или «Замена картриджа». Укажите наименование, количество и кабинет. Заявки обрабатываются в порядке поступления.',
    },
    {
        id: 'support',
        icon: IconMail,
        question: 'Куда обращаться при других проблемах?',
        color: 'violet',
        mailto: 'zumerov@kostalegal.com',
    },
];
export function HelpPage() {
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        const t = setTimeout(() => setLoading(false), 450);
        return () => clearTimeout(t);
    }, []);
    return (<div className="help-page">
      <main className="help-page__main">
        <header className="help-page__header">
          <div className="help-page__header-inner">
            <div className="help-page__header-start">
              <AppBackButton className="app-back-btn" />
              <div>
                <h1 className="help-page__title">Помощь</h1>
              </div>
            </div>
            <AppPageSettings />
          </div>
        </header>

        <div className="help-page__content">
          <div className="help-page__container">
            {loading ? (<>
                <div className="help-page__hero help-page__hero--skeleton">
                  <div className="help-page__skel help-page__skel--icon"/>
                  <div className="help-page__skel help-page__skel--title"/>
                  <div className="help-page__skel help-page__skel--text"/>
                </div>
                <div className="help-page__grid">
                  {[1, 2, 3, 4, 5, 6].map((i) => (<div key={i} className="help-page__card help-page__card--skeleton">
                      <div className="help-page__skel help-page__skel--card-icon"/>
                      <div className="help-page__skel help-page__skel--card-title"/>
                      <div className="help-page__skel help-page__skel--card-line"/>
                      <div className="help-page__skel help-page__skel--card-line help-page__skel--short"/>
                    </div>))}
                </div>
              </>) : (<>
                <div className="help-page__hero">
                  <div className="help-page__hero-icon">
                    <IconHelp />
                  </div>
                  <h2 className="help-page__hero-title">Как мы можем помочь?</h2>
                  <p className="help-page__hero-text">
                    Ответы на частые вопросы по офисным задачам: подключение принтера, Wi‑Fi, второго монитора и другое. Не нашли ответ — создайте тикет.
                  </p>
                </div>

                <section className="help-page__faq" aria-label="Часто задаваемые вопросы">
                  <h2 className="help-page__faq-heading">Офисные задачи</h2>
                  <div className="help-page__grid">
                    {faqItems.map((item, i) => {
                const Icon = item.icon;
                return (<article key={item.id} className={`help-page__card help-page__card--${item.color}`} style={{ animationDelay: `${i * 0.05}s` }}>
                          <div className="help-page__card-icon">
                            <Icon />
                          </div>
                          <div className="help-page__card-q">Вопрос</div>
                          <h3 className="help-page__card-title">{item.question}</h3>
                          <div className="help-page__card-a">Ответ</div>
                          {item.mailto ? (<a href={`mailto:${item.mailto}`} className="help-page__card-email">
                              {item.mailto}
                            </a>) : (<p className="help-page__card-text">{item.answer}</p>)}
                        </article>);
            })}
                  </div>
                </section>
              </>)}
          </div>
        </div>
      </main>
    </div>);
}
