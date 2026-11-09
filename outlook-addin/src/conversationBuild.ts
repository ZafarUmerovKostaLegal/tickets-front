import { readAzureAccessToken } from './auth/session';
import type { ConversationMessageMeta } from './conversation';

type GraphBodyMessage = {
  id: string;
  subject?: string;
  internetMessageId?: string;
  receivedDateTime?: string;
  body?: { contentType?: string; content?: string };
  from?: { emailAddress?: { address?: string; name?: string } };
  toRecipients?: Array<{ emailAddress?: { address?: string; name?: string } }>;
  ccRecipients?: Array<{ emailAddress?: { address?: string; name?: string } }>;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatRecipients(rows?: Array<{ emailAddress?: { address?: string; name?: string } }>): string {
  if (!rows?.length)
    return '';
  return rows
    .map((row) => {
      const name = row.emailAddress?.name || '';
      const address = row.emailAddress?.address || '';
      if (name && address)
        return `${escapeHtml(name)} &lt;${escapeHtml(address)}&gt;`;
      return escapeHtml(address || name);
    })
    .filter(Boolean)
    .join(', ');
}

async function fetchMessageBody(graphId: string, token: string): Promise<GraphBodyMessage> {
  const select = encodeURIComponent(
    'id,subject,internetMessageId,receivedDateTime,body,from,toRecipients,ccRecipients',
  );
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(graphId)}?$select=${select}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        Prefer: 'outlook.body-content-type="html"',
      },
    },
  );
  if (!response.ok)
    throw new Error(`Не удалось прочитать тело письма (${response.status})`);
  return await response.json() as GraphBodyMessage;
}

/** Best-effort HTML/text body from raw MIME (EWS IncludeMimeContent). */
function bodyFromMimeBase64(mimeBase64: string): { html: string; text: string } {
  let raw = '';
  try {
    raw = atob(mimeBase64.replace(/\s+/g, ''));
  } catch {
    return { html: '', text: '' };
  }
  const htmlMatch = raw.match(
    /Content-Type:\s*text\/html[\s\S]*?(?:\r?\n\r?\n|\r\n\r\n)([\s\S]*?)(?=\r?\n--|\r\n--|$)/i,
  );
  const textMatch = raw.match(
    /Content-Type:\s*text\/plain[\s\S]*?(?:\r?\n\r?\n|\r\n\r\n)([\s\S]*?)(?=\r?\n--|\r\n--|$)/i,
  );
  const decodePart = (part: string): string => {
    let value = part.trim();
    if (/quoted-printable/i.test(raw.slice(Math.max(0, raw.indexOf(part) - 200), raw.indexOf(part)))) {
      value = value.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (_, hex: string) =>
        String.fromCharCode(parseInt(hex, 16)));
    }
    return value;
  };
  return {
    html: htmlMatch ? decodePart(htmlMatch[1]) : '',
    text: textMatch ? decodePart(textMatch[1]) : '',
  };
}

function shortConversationKey(conversationId: string): string {
  let hash = 0;
  for (let i = 0; i < conversationId.length; i += 1)
    hash = ((hash << 5) - hash + conversationId.charCodeAt(i)) | 0;
  return `t${Math.abs(hash).toString(36)}`;
}

export function conversationDocumentFileName(conversationId: string, subject: string): string {
  const safe = subject.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 60)
    || 'conversation';
  return `Conversation_${shortConversationKey(conversationId)}_${safe}.eml`;
}

export function conversationStorageKey(conversationId: string): string {
  return `conv:${shortConversationKey(conversationId)}`;
}

/**
 * Build one .eml that contains the full thread as a readable HTML transcript
 * (single document in FM, like one Outlook conversation).
 */
export async function buildConversationEml(
  conversationId: string,
  messages: ConversationMessageMeta[],
  onProgress?: (index: number, total: number) => void,
): Promise<{ file: File; storageKey: string }> {
  const token = readAzureAccessToken();
  if (!token)
    throw new Error('Нет Azure-токена для Graph. Войдите снова.');

  const blocks: string[] = [];
  for (let i = 0; i < messages.length; i += 1) {
    onProgress?.(i + 1, messages.length);
    const meta = messages[i];
    let bodyHtml = `<p><em>(тело письма недоступно)</em></p>`;
    let to = '';
    let cc = '';
    let subject = meta.subject;
    let fromLabel = meta.fromName
      ? `${escapeHtml(meta.fromName)} &lt;${escapeHtml(meta.fromEmail)}&gt;`
      : escapeHtml(meta.fromEmail);
    let received = meta.received;
    let loaded = false;
    try {
      const full = await fetchMessageBody(meta.graphId, token);
      subject = full.subject || subject;
      received = full.receivedDateTime || received;
      const address = full.from?.emailAddress?.address || meta.fromEmail;
      const name = full.from?.emailAddress?.name || meta.fromName;
      fromLabel = name
        ? `${escapeHtml(name)} &lt;${escapeHtml(address)}&gt;`
        : escapeHtml(address);
      to = formatRecipients(full.toRecipients);
      cc = formatRecipients(full.ccRecipients);
      const raw = full.body?.content || '';
      if ((full.body?.contentType || '').toLowerCase() === 'text')
        bodyHtml = `<pre style="white-space:pre-wrap;font-family:Segoe UI,sans-serif">${escapeHtml(raw)}</pre>`;
      else
        bodyHtml = raw || bodyHtml;
      loaded = Boolean(raw);
    } catch {
      /* try EWS MIME below */
    }
    if (!loaded && meta.mimeBase64) {
      const fromMime = bodyFromMimeBase64(meta.mimeBase64);
      if (fromMime.html)
        bodyHtml = fromMime.html;
      else if (fromMime.text)
        bodyHtml = `<pre style="white-space:pre-wrap;font-family:Segoe UI,sans-serif">${escapeHtml(fromMime.text)}</pre>`;
    }

    blocks.push(`
      <section style="border:1px solid #d8dee6;border-radius:10px;padding:14px 16px;margin:0 0 14px;background:#fff">
        <div style="font-size:12px;color:#64748b;margin-bottom:8px">
          <div><strong>From:</strong> ${fromLabel}</div>
          ${to ? `<div><strong>To:</strong> ${to}</div>` : ''}
          ${cc ? `<div><strong>Cc:</strong> ${cc}</div>` : ''}
          <div><strong>Date:</strong> ${escapeHtml(received)}</div>
          <div><strong>Subject:</strong> ${escapeHtml(subject)}</div>
        </div>
        <div style="font-size:13px;color:#0f172a;line-height:1.45">${bodyHtml}</div>
      </section>
    `);
  }

  const title = messages[0]?.subject || 'Conversation';
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:16px;background:#f4f6f8;font-family:Segoe UI,Arial,sans-serif">
  <h1 style="font-size:18px;margin:0 0 6px;color:#0f172a">${escapeHtml(title)}</h1>
  <p style="margin:0 0 16px;color:#64748b;font-size:12px">
    Outlook conversation · ${messages.length} message(s) · exported by Kosta File
  </p>
  ${blocks.join('\n')}
</body>
</html>`;

  const boundary = `kosta_thread_${Date.now().toString(36)}`;
  const textFallback = messages
    .map((m, i) => `#${i + 1} ${m.received} | ${m.fromEmail} | ${m.subject}`)
    .join('\n');
  const subjectRaw = `[Thread · ${messages.length}] ${title}`.replace(/\r?\n/g, ' ').trim();
  const subjectBytes = new TextEncoder().encode(subjectRaw);
  let subjectBinary = '';
  subjectBytes.forEach((b) => {
    subjectBinary += String.fromCharCode(b);
  });
  const subjectHeader = `=?UTF-8?B?${btoa(subjectBinary)}?=`;
  const eml = [
    `From: Kosta File <noreply@kostalegal.com>`,
    `To: correspondence@kostalegal.com`,
    `Subject: ${subjectHeader}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${shortConversationKey(conversationId)}.thread@kosta.local>`,
    `X-Kosta-Conversation-Id: ${conversationId}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="utf-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    textFallback,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="utf-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    html,
    '',
    `--${boundary}--`,
    '',
  ].join('\r\n');

  const file = new File(
    [eml],
    conversationDocumentFileName(conversationId, title),
    { type: 'message/rfc822' },
  );
  return { file, storageKey: conversationStorageKey(conversationId) };
}
