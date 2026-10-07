function resolvePath(messages, path) {
    const parts = path.split('.');
    let cur = messages;
    for (const part of parts) {
        if (cur == null || typeof cur !== 'object')
            return undefined;
        cur = cur[part];
    }
    return typeof cur === 'string' ? cur : undefined;
}
export function createTranslator(messages) {
    return function t(key) {
        return resolvePath(messages, key) ?? key;
    };
}
