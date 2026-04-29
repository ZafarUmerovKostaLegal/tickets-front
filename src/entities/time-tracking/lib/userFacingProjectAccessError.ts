
export function userFacingProjectAccessError(detail: string): string {
    const t = detail.trim();
    if (!t)
        return t;
    const looksPartnerRule = /партн/i.test(t) &&
        (t.includes('По проекту «') || /среди пользователей|с доступом к списанию|должност/i.test(t));
    if (!looksPartnerRule)
        return t;
    const m = t.match(/По проекту «([^»]+)»/);
    const project = m ? m[1] : null;
    if (project) {
        return `По проекту «${project}» среди сотрудников с доступом к списанию времени должен быть минимум один с должностью партнёра. Укажите в карточке сотрудника в учёте времени поле «Должность» (например «Партнёр»).`;
    }
    return 'Среди сотрудников с доступом к проекту должен быть минимум один с должностью партнёра. Укажите «Должность» в карточке сотрудника в учёте времени (например «Партнёр»).';
}
