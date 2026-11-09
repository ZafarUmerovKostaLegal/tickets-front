export type MailSnapshot = {
  messageId: string;
  subject: string;
  fromEmail: string;
  fromName: string;
  to: string;
  cc: string;
  received: string;
  bodyHtml: string;
  bodyText: string;
};

/** Stable id for dedupe (Outlook may include or omit &lt;&gt;). */
export function normalizeMessageId(value: string): string {
  return value.trim().replace(/^<|>$/g, '').toLowerCase();
}

function getItem(): Office.MessageRead {
  const item = Office.context.mailbox.item;
  if (!item)
    throw new Error('Откройте письмо');
  return item as Office.MessageRead;
}

function readString(getter: (cb: (result: Office.AsyncResult<string>) => void) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    getter((result) => {
      if (result.status === Office.AsyncResultStatus.Succeeded)
        resolve(result.value ?? '');
      else
        reject(result.error ?? new Error('Не удалось прочитать письмо'));
    });
  });
}

export async function readCurrentMail(): Promise<MailSnapshot> {
  const item = getItem();
  const from = item.from;
  const [bodyHtml, bodyText] = await Promise.all([
    readString((cb) => item.body.getAsync(Office.CoercionType.Html, cb)),
    readString((cb) => item.body.getAsync(Office.CoercionType.Text, cb)),
  ]);

  const to = (item.to ?? []).map((r) => r.emailAddress).filter(Boolean).join(', ');
  const cc = (item.cc ?? []).map((r) => r.emailAddress).filter(Boolean).join(', ');
  const internetId = typeof item.internetMessageId === 'string' ? item.internetMessageId : '';
  const itemId = typeof item.itemId === 'string' ? item.itemId : '';
  const rawFrom = (from?.emailAddress || '').trim();
  // Some hosts put "Name <mail@x>" into emailAddress — keep bare address for rules.
  const fromEmail = (rawFrom.match(/<([^>]+)>/)?.[1] || rawFrom).trim();

  return {
    messageId: normalizeMessageId(
      internetId || itemId || `${fromEmail}|${item.subject ?? ''}|${item.dateTimeCreated?.toISOString?.() ?? ''}`,
    ),
    subject: item.subject || '(без темы)',
    fromEmail,
    fromName: from?.displayName ?? fromEmail,
    to,
    cc,
    received: item.dateTimeCreated?.toISOString?.() ?? new Date().toISOString(),
    bodyHtml,
    bodyText,
  };
}

function encodeHeader(value: string): string {
  const clean = value.replace(/\r?\n/g, ' ').trim();
  if (/^[\x20-\x7E]*$/.test(clean))
    return clean;
  const bytes = new TextEncoder().encode(clean);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return `=?UTF-8?B?${btoa(binary)}?=`;
}

/** Build a simple .eml for upload into Correspondence/Emails. */
export function buildEml(mail: MailSnapshot): File {
  const boundary = `kosta_${Date.now().toString(36)}`;
  const text = mail.bodyText || mail.bodyHtml.replace(/<[^>]+>/g, ' ');
  const html = mail.bodyHtml || `<pre>${escapeHtml(text)}</pre>`;
  const lines = [
    `From: ${encodeHeader(mail.fromName)} <${mail.fromEmail}>`,
    `To: ${mail.to || 'undisclosed-recipients:;'}`,
    mail.cc ? `Cc: ${mail.cc}` : '',
    `Subject: ${encodeHeader(mail.subject)}`,
    `Date: ${new Date(mail.received).toUTCString()}`,
    mail.messageId.includes('@') ? `Message-ID: ${mail.messageId}` : `Message-ID: <${mail.messageId}@kosta.local>`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="utf-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    text,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="utf-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    html,
    '',
    `--${boundary}--`,
    '',
  ].filter((line, index, arr) => !(line === '' && arr[index - 1] === '' && index < 8));

  const blob = new Blob([lines.join('\r\n')], { type: 'message/rfc822' });
  const safe = mail.subject.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0, 80) || 'email';
  const stamp = mail.received.slice(0, 10);
  return new File([blob], `${stamp}_${safe}.eml`, { type: 'message/rfc822' });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
