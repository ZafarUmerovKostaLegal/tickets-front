const SCRIPTABLE_TYPE = /^(text\/html|application\/xhtml\+xml|image\/svg\+xml|text\/xml|application\/xml|application\/[\w.+-]*\+xml|text\/xsl|application\/xslt\+xml|text\/javascript|application\/javascript|application\/x-javascript|text\/ecmascript|application\/ecmascript)\b/i;
const SCRIPTABLE_NAME = /\.(html?|xht(ml)?|shtml|svgz?|xml|xsl|xslt|js|mjs|hta|mht(ml)?)$/i;

export function isScriptableFile(type: string | null | undefined, fileName?: string | null): boolean {
    const mime = (type ?? '').trim().toLowerCase();
    if (SCRIPTABLE_TYPE.test(mime))
        return true;
    return Boolean(fileName && SCRIPTABLE_NAME.test(fileName.trim()));
}

export function inertBlob(blob: Blob, fileName?: string | null): Blob {
    if (!isScriptableFile(blob.type, fileName))
        return blob;
    return new Blob([blob], { type: 'text/plain;charset=utf-8' });
}

export function inertObjectUrl(blob: Blob, fileName?: string | null): string {
    return URL.createObjectURL(inertBlob(blob, fileName));
}

export function openBlobInNewTab(blob: Blob, fileName?: string | null): boolean {
    const url = inertObjectUrl(blob, fileName);
    const tab = window.open(url, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return Boolean(tab);
}



