import { useMemo, useState, useEffect } from 'react';
import { AppBackButton, AppHomeLogo, AppPageSettings } from '@shared/ui';
import { useI18n } from '@shared/i18n';
import type { TranslationKey } from '@shared/i18n/translate';
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

type HelpFaqId = 'printer' | 'wifi' | 'monitor' | 'access' | 'supplies' | 'support';

type HelpFaqMeta = {
    id: HelpFaqId;
    icon: typeof IconPrinter;
    color: 'blue' | 'violet' | 'green' | 'orange';
    mailto?: string;
};

const FAQ_META: HelpFaqMeta[] = [
    { id: 'printer', icon: IconPrinter, color: 'blue' },
    { id: 'wifi', icon: IconWifi, color: 'violet' },
    { id: 'monitor', icon: IconMonitor, color: 'green' },
    { id: 'access', icon: IconKey, color: 'orange' },
    { id: 'supplies', icon: IconBox, color: 'blue' },
    { id: 'support', icon: IconMail, color: 'violet', mailto: 'zumerov@kostalegal.com' },
];

function faqKey(id: HelpFaqId, field: 'question' | 'answer'): TranslationKey {
    return `helpPage.faq.${id}.${field}` as TranslationKey;
}

export function HelpPage() {
    const { t } = useI18n();
    const [loading, setLoading] = useState(true);

    const faqItems = useMemo(
        () =>
            FAQ_META.map((item) => ({
                ...item,
                question: t(faqKey(item.id, 'question')),
                answer: t(faqKey(item.id, 'answer')),
            })),
        [t],
    );

    useEffect(() => {
        const timer = setTimeout(() => setLoading(false), 450);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="help-page">
            <main className="help-page__main">
                <header className="help-page__header">
                    <div className="help-page__header-inner">
                        <div className="help-page__header-start">
                            <AppBackButton className="app-back-btn" />
                            <AppHomeLogo withSeparator />
                            <div>
                                <h1 className="help-page__title">{t('helpPage.title')}</h1>
                            </div>
                        </div>
                        <AppPageSettings />
                    </div>
                </header>

                <div className="help-page__content">
                    <div className="help-page__container">
                        {loading ? (
                            <>
                                <div className="help-page__hero help-page__hero--skeleton">
                                    <div className="help-page__skel help-page__skel--icon" />
                                    <div className="help-page__skel help-page__skel--title" />
                                    <div className="help-page__skel help-page__skel--text" />
                                </div>
                                <div className="help-page__grid">
                                    {[1, 2, 3, 4, 5, 6].map((i) => (
                                        <div key={i} className="help-page__card help-page__card--skeleton">
                                            <div className="help-page__skel help-page__skel--card-icon" />
                                            <div className="help-page__skel help-page__skel--card-title" />
                                            <div className="help-page__skel help-page__skel--card-line" />
                                            <div className="help-page__skel help-page__skel--card-line help-page__skel--short" />
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="help-page__hero">
                                    <div className="help-page__hero-icon">
                                        <IconHelp />
                                    </div>
                                    <h2 className="help-page__hero-title">{t('helpPage.heroTitle')}</h2>
                                    <p className="help-page__hero-text">{t('helpPage.heroText')}</p>
                                </div>

                                <section className="help-page__faq" aria-label={t('helpPage.faqAria')}>
                                    <h2 className="help-page__faq-heading">{t('helpPage.faqHeading')}</h2>
                                    <div className="help-page__grid">
                                        {faqItems.map((item, i) => {
                                            const Icon = item.icon;
                                            return (
                                                <article
                                                    key={item.id}
                                                    className={`help-page__card help-page__card--${item.color}`}
                                                    style={{ animationDelay: `${i * 0.05}s` }}
                                                >
                                                    <div className="help-page__card-icon">
                                                        <Icon />
                                                    </div>
                                                    <div className="help-page__card-q">{t('helpPage.questionLabel')}</div>
                                                    <h3 className="help-page__card-title">{item.question}</h3>
                                                    <div className="help-page__card-a">{t('helpPage.answerLabel')}</div>
                                                    {item.mailto ? (
                                                        <a href={`mailto:${item.mailto}`} className="help-page__card-email">
                                                            {item.mailto}
                                                        </a>
                                                    ) : (
                                                        <p className="help-page__card-text">{item.answer}</p>
                                                    )}
                                                </article>
                                            );
                                        })}
                                    </div>
                                </section>
                            </>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
