const BAD_CHARS = /[<>:"/\\|?*\p{Cc}]/gu;

export function safeFilePart(value: string, max: number): string {
  return value.replace(BAD_CHARS, '_').replace(/\s+/g, ' ').trim().slice(0, max).trim();
}

export function shortHash(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).padStart(6, '0').slice(-6);
}

export function messageFileName(input: { subject: string; received: string; fromName: string; messageId: string }): string {
  const date = /^\d{4}-\d{2}-\d{2}/.test(input.received) ? input.received.slice(0, 10) : '';
  const from = safeFilePart(input.fromName, 40);
  const subject = safeFilePart(input.subject, 80) || 'email';
  const head = [date, from ? `${from} -` : ''].filter(Boolean).join(' ');
  return `${head ? `${head} ` : ''}${subject} [${shortHash(input.messageId || subject)}].eml`;
}

export function attachmentFileName(name: string): string {
  return safeFilePart(name, 180) || 'attachment';
}

export function locationLabel(location: { clientName: string; matterName: string; matterCode?: string; folderPath: Array<{ name: string }> }): string {
  const matter = location.matterCode ? `${location.matterCode} ${location.matterName}` : location.matterName;
  return [location.clientName, matter, ...location.folderPath.map((crumb) => crumb.name)].filter(Boolean).join(' › ');
}

export function hubDocumentUrl(origin: string, target: { matterId: string; folderId?: string | null; documentId?: string | null }): string {
  const qs = new URLSearchParams({ view: 'matter', matter: target.matterId });
  if (target.folderId)
    qs.set('folder', target.folderId);
  if (target.documentId)
    qs.set('doc', target.documentId);
  return `${origin.replace(/\/+$/, '')}/files?${qs.toString()}`;
}
