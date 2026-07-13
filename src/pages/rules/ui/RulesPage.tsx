import { useMemo, useState, useEffect } from 'react';
import { AppBackButton, AppHomeLogo, AppPageSettings } from '@shared/ui';
import { useI18n } from '@shared/i18n';
import type { TranslationKey } from '@shared/i18n/translate';
import {
    IconCalendarCheck,
    IconFileText,
    IconTicket,
    IconWallet,
} from '@widgets/sidebar/ui/SidebarIcons';
import './RulesPage.css';

type RulesSectionId =
    | 'createTicket'
    | 'description'
    | 'priority'
    | 'attachments'
    | 'expenseRequest'
    | 'vacationRequest';

type RulesSectionColor = 'blue' | 'violet' | 'green' | 'orange';

type RulesSectionMeta = {
    id: RulesSectionId;
    icon: typeof IconFileText;
    color: RulesSectionColor;
};

const RULES_META: RulesSectionMeta[] = [
    { id: 'createTicket', icon: IconTicket, color: 'blue' },
    { id: 'description', icon: IconFileText, color: 'violet' },
    { id: 'priority', icon: IconTicket, color: 'green' },
    { id: 'attachments', icon: IconFileText, color: 'orange' },
    { id: 'expenseRequest', icon: IconWallet, color: 'blue' },
    { id: 'vacationRequest', icon: IconCalendarCheck, color: 'violet' },
];

const SKELETON_CARD_COUNT = RULES_META.length;

function sectionKey(id: RulesSectionId, field: 'title' | 'text'): TranslationKey {
    return `rulesPage.sections.${id}.${field}` as TranslationKey;
}

export function RulesPage() {
    const { t } = useI18n();
    const [loading, setLoading] = useState(true);

    const rulesSections = useMemo(
        () =>
            RULES_META.map((section) => ({
                ...section,
                title: t(sectionKey(section.id, 'title')),
                text: t(sectionKey(section.id, 'text')),
            })),
        [t],
    );

    useEffect(() => {
        const timer = setTimeout(() => setLoading(false), 450);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="rules-page">
            <main className="rules-page__main">
                <header className="rules-page__header">
                    <div className="rules-page__header-inner">
                        <div className="rules-page__header-start">
                            <AppBackButton className="app-back-btn" />
                            <AppHomeLogo withSeparator />
                            <div>
                                <h1 className="rules-page__title">{t('rulesPage.title')}</h1>
                                <p className="rules-page__subtitle">{t('rulesPage.subtitle')}</p>
                            </div>
                        </div>
                        <AppPageSettings />
                    </div>
                </header>

                <div className="rules-page__content">
                    <div className="rules-page__container">
                        {loading ? (
                            <>
                                <div className="rules-page__hero rules-page__hero--skeleton">
                                    <div className="rules-page__skel rules-page__skel--icon" />
                                    <div className="rules-page__skel rules-page__skel--title" />
                                    <div className="rules-page__skel rules-page__skel--text" />
                                </div>
                                <div className="rules-page__grid">
                                    {Array.from({ length: SKELETON_CARD_COUNT }, (_, i) => (
                                        <div key={i} className="rules-page__card rules-page__card--skeleton">
                                            <div className="rules-page__skel rules-page__skel--card-icon" />
                                            <div className="rules-page__skel rules-page__skel--card-title" />
                                            <div className="rules-page__skel rules-page__skel--card-line" />
                                            <div className="rules-page__skel rules-page__skel--card-line rules-page__skel--short" />
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="rules-page__hero">
                                    <div className="rules-page__hero-icon">
                                        <IconFileText />
                                    </div>
                                    <h2 className="rules-page__hero-title">{t('rulesPage.heroTitle')}</h2>
                                    <p className="rules-page__hero-text">{t('rulesPage.heroText')}</p>
                                </div>

                                <div className="rules-page__grid">
                                    {rulesSections.map((section, i) => {
                                        const Icon = section.icon;
                                        return (
                                            <article
                                                key={section.id}
                                                className={`rules-page__card rules-page__card--${section.color}`}
                                                style={{ animationDelay: `${i * 0.05}s` }}
                                            >
                                                <div className="rules-page__card-icon">
                                                    <Icon />
                                                </div>
                                                <h3 className="rules-page__card-title">{section.title}</h3>
                                                <div className="rules-page__card-body">
                                                    <p className="rules-page__text">{section.text}</p>
                                                </div>
                                            </article>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
