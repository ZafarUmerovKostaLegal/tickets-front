const STUB_AUTH_USER_EMAIL = /^auth-user-\d+@tt\.local$/i;

export function isStubAuthUserEmail(value: string | null | undefined): boolean {
    return STUB_AUTH_USER_EMAIL.test(String(value ?? '').trim());
}

export function firstNonStubUserText(...values: Array<string | null | undefined>): string | undefined {
    for (const value of values) {
        const text = value?.trim();
        if (text && !isStubAuthUserEmail(text))
            return text;
    }
    return undefined;
}

export function pickUserDisplayLabel(
    displayName: string | null | undefined,
    email: string | null | undefined,
    fallbackId: number,
    fallbackTemplate = 'Пользователь {id}',
): string {
    return firstNonStubUserText(displayName, email)
        ?? fallbackTemplate.replace('{id}', String(fallbackId));
}

export type TimeUserLabelSource = {
    display_name?: string | null;
    email?: string | null;
};

export function resolveTimeUserDisplayName(
    sources: {
        catalog?: TimeUserLabelSource | null;
        colleague?: TimeUserLabelSource | null;
        member?: TimeUserLabelSource | null;
    },
    fallbackId: number,
    fallbackTemplate = 'Пользователь {id}',
): string {
    return pickUserDisplayLabel(
        firstNonStubUserText(
            sources.catalog?.display_name,
            sources.colleague?.display_name,
            sources.member?.display_name,
        ),
        firstNonStubUserText(
            sources.catalog?.email,
            sources.colleague?.email,
            sources.member?.email,
        ),
        fallbackId,
        fallbackTemplate,
    );
}
