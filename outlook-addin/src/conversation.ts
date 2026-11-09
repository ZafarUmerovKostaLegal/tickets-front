import { normalizeMessageId } from './email';
import { readAzureAccessToken } from './auth/session';

export type ConversationMessageMeta = {
  graphId: string;
  internetMessageId: string;
  subject: string;
  fromEmail: string;
  fromName: string;
  received: string;
};

type GraphMessage = {
  id: string;
  subject?: string;
  internetMessageId?: string;
  receivedDateTime?: string;
  from?: { emailAddress?: { address?: string; name?: string } };
};

function currentConversationId(): string {
  const item = Office.context.mailbox.item as Office.MessageRead | undefined;
  const id = (item?.conversationId || '').trim();
  if (!id)
    throw new Error('У письма нет conversationId — откройте письмо из переписки');
  return id;
}

function escapeODataString(value: string): string {
  return value.replace(/'/g, "''");
}

async function graphGetJson<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  if (!response.ok) {
    let detail = `Graph HTTP ${response.status}`;
    try {
      const body = await response.json() as { error?: { message?: string } };
      if (body.error?.message)
        detail = body.error.message;
    } catch {
      /* ignore */
    }
    if (response.status === 401 || response.status === 403)
      throw new Error(`${detail}. Выйдите и войдите снова (нужно согласие Mail.Read).`);
    throw new Error(detail);
  }
  return await response.json() as T;
}

/**
 * List all messages in the current Outlook conversation via Microsoft Graph.
 * Requires Azure token with Mail.Read (stored after Hub login).
 */
export async function listConversationMessages(): Promise<{
  conversationId: string;
  messages: ConversationMessageMeta[];
}> {
  const token = readAzureAccessToken();
  if (!token)
    throw new Error('Нет Azure-токена для Graph. Выйдите и войдите снова (нужен Mail.Read).');

  const conversationId = currentConversationId();
  // Do NOT combine conversationId $filter with $orderby — Graph returns
  // "The restriction or sort order is too complex for this operation."
  const filter = encodeURIComponent(`conversationId eq '${escapeODataString(conversationId)}'`);
  const select = encodeURIComponent('id,subject,internetMessageId,receivedDateTime,from');
  let url =
    `https://graph.microsoft.com/v1.0/me/messages`
    + `?$filter=${filter}&$select=${select}&$top=50`;

  const messages: ConversationMessageMeta[] = [];
  while (url) {
    const page = await graphGetJson<{ value?: GraphMessage[]; '@odata.nextLink'?: string }>(url, token);
    for (const row of page.value || []) {
      const address = row.from?.emailAddress?.address || '';
      messages.push({
        graphId: row.id,
        internetMessageId: normalizeMessageId(row.internetMessageId || row.id),
        subject: row.subject || '(без темы)',
        fromEmail: address,
        fromName: row.from?.emailAddress?.name || address,
        received: row.receivedDateTime || new Date().toISOString(),
      });
    }
    url = page['@odata.nextLink'] || '';
  }

  if (!messages.length)
    throw new Error('В переписке не найдено сообщений (Graph). Проверьте согласие Mail.Read.');

  messages.sort((a, b) => a.received.localeCompare(b.received));
  return { conversationId, messages };
}

/** Download raw MIME (.eml) for a Graph message id. */
export async function downloadMessageMime(graphId: string, fileName: string): Promise<File> {
  const token = readAzureAccessToken();
  if (!token)
    throw new Error('Нет Azure-токена для Graph. Войдите снова.');

  const url = `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(graphId)}/$value`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok)
    throw new Error(`Не удалось скачать MIME (${response.status})`);
  const blob = await response.blob();
  const safe = fileName.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0, 80) || 'email';
  return new File([blob], safe.endsWith('.eml') ? safe : `${safe}.eml`, { type: 'message/rfc822' });
}

export function conversationFileName(meta: ConversationMessageMeta, index: number): string {
  const stamp = (meta.received || '').slice(0, 10) || 'msg';
  const who = (meta.fromEmail.split('@')[0] || 'user').slice(0, 24);
  const sub = meta.subject.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0, 40) || 'email';
  return `${stamp}_${String(index + 1).padStart(2, '0')}_${who}_${sub}.eml`;
}
