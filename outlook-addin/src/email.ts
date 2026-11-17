/** Headers of the open message — cheap to read on every ItemChanged. */
export type MailMeta = {
  messageId: string;
  subject: string;
  fromEmail: string;
  fromName: string;
  to: string;
  cc: string;
  received: string;
};

export type MailSnapshot = MailMeta & {
  bodyHtml: string;
  bodyText: string;
};

/** Stable id for dedupe (Outlook may include or omit &lt;&gt;). */
export function normalizeMessageId(value: string): string {
  return value.trim().replace(/^<|>$/g, '').toLowerCase();
}

/** Some hosts put "Name <mail@x>" into emailAddress — keep the bare address for rules. */
export function bareEmailAddress(raw: string): string {
  const value = (raw || '').trim();
  return (value.match(/<([^>]+)>/)?.[1] || value).trim();
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

function readMeta(item: Office.MessageRead): MailMeta {
  const fromEmail = bareEmailAddress(item.from?.emailAddress || '');
  const internetId = typeof item.internetMessageId === 'string' ? item.internetMessageId : '';
  const itemId = typeof item.itemId === 'string' ? item.itemId : '';
  return {
    messageId: normalizeMessageId(
      internetId || itemId || `${fromEmail}|${item.subject ?? ''}|${item.dateTimeCreated?.toISOString?.() ?? ''}`,
    ),
    subject: item.subject || '(без темы)',
    fromEmail,
    fromName: item.from?.displayName ?? fromEmail,
    to: (item.to ?? []).map((r) => r.emailAddress).filter(Boolean).join(', '),
    cc: (item.cc ?? []).map((r) => r.emailAddress).filter(Boolean).join(', '),
    received: item.dateTimeCreated?.toISOString?.() ?? new Date().toISOString(),
  };
}

/** Headers only — no body round-trips. */
export function readCurrentMailMeta(): MailMeta {
  return readMeta(getItem());
}

/**
 * Full message with HTML and text bodies (needed only when uploading).
 * Throws if the user switched to another message meanwhile.
 */
export async function readCurrentMail(expectedMessageId?: string): Promise<MailSnapshot> {
  const item = getItem();
  const meta = readMeta(item);
  if (expectedMessageId && meta.messageId !== expectedMessageId)
    throw new Error('Письмо сменилось — повторите загрузку');
  const [bodyHtml, bodyText] = await Promise.all([
    readString((cb) => item.body.getAsync(Office.CoercionType.Html, cb)),
    readString((cb) => item.body.getAsync(Office.CoercionType.Text, cb)),
  ]);
  return { ...meta, bodyHtml, bodyText };
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

function toCrlf(value: string): string {
  return value.replace(/\r?\n/g, '\r\n');
}

export function emlFileName(subject: string, received: string): string {
  const safe = subject.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0, 80) || 'email';
  return `${received.slice(0, 10)}_${safe}.eml`;
}

/** RFC 5322 message text: headers, one blank line, then a multipart/alternative body. */
export function buildEmlText(mail: MailSnapshot, boundary = `kosta_${Date.now().toString(36)}`): string {
  const text = mail.bodyText || mail.bodyHtml.replace(/<[^>]+>/g, ' ');
  const html = mail.bodyHtml || `<pre>${escapeHtml(text)}</pre>`;
  // An empty line ends the header block, so optional headers must be dropped, not blanked.
  const headers = [
    `From: ${encodeHeader(mail.fromName)} <${mail.fromEmail}>`,
    `To: ${mail.to || 'undisclosed-recipients:;'}`,
    mail.cc ? `Cc: ${mail.cc}` : null,
    `Subject: ${encodeHeader(mail.subject)}`,
    `Date: ${new Date(mail.received).toUTCString()}`,
    mail.messageId.includes('@') ? `Message-ID: <${mail.messageId}>` : `Message-ID: <${mail.messageId}@kosta.local>`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ].filter((line): line is string => Boolean(line));
  const body = [
    `--${boundary}`,
    'Content-Type: text/plain; charset="utf-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    toCrlf(text),
    `--${boundary}`,
    'Content-Type: text/html; charset="utf-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    toCrlf(html),
    `--${boundary}--`,
    '',
  ];
  return `${headers.join('\r\n')}\r\n\r\n${body.join('\r\n')}`;
}

/** Build a simple .eml for upload into Correspondence/Emails. */
export function buildEml(mail: MailSnapshot): File {
  const blob = new Blob([buildEmlText(mail)], { type: 'message/rfc822' });
  return new File([blob], emlFileName(mail.subject, mail.received), { type: 'message/rfc822' });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
