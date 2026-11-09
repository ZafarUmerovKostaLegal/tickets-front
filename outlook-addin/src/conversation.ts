import { normalizeMessageId } from './email';
import { readAzureAccessToken } from './auth/session';

export type ConversationMessageMeta = {
  graphId: string;
  internetMessageId: string;
  subject: string;
  fromEmail: string;
  fromName: string;
  received: string;
  /** When set, MIME is already available (EWS path) — skip Graph $value. */
  mimeBase64?: string;
};

type GraphMessage = {
  id: string;
  subject?: string;
  internetMessageId?: string;
  receivedDateTime?: string;
  conversationId?: string;
  from?: { emailAddress?: { address?: string; name?: string } };
};

function currentItem(): Office.MessageRead {
  const item = Office.context.mailbox.item as Office.MessageRead | undefined;
  if (!item)
    throw new Error('Откройте письмо');
  return item;
}

function currentConversationId(): string {
  const id = (currentItem().conversationId || '').trim();
  if (!id)
    throw new Error('У письма нет conversationId — откройте письмо из переписки');
  return id;
}

function escapeODataString(value: string): string {
  return value.replace(/'/g, "''");
}

function isTooComplexError(message: string): boolean {
  return /too complex|InefficientFilter|restriction or sort order/i.test(message);
}

async function graphGetJson<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      // Prefer immutable ids when available
      Prefer: 'IdType="ImmutableId"',
    },
  });
  if (!response.ok) {
    let detail = `Graph HTTP ${response.status}`;
    try {
      const body = await response.json() as { error?: { message?: string; code?: string } };
      if (body.error?.message)
        detail = body.error.message;
      else if (body.error?.code)
        detail = body.error.code;
    } catch {
      /* ignore */
    }
    if (response.status === 401 || response.status === 403)
      throw new Error(`${detail}. Выйдите и войдите снова (нужно согласие Mail.Read).`);
    throw new Error(detail);
  }
  return await response.json() as T;
}

function mapGraphMessages(rows: GraphMessage[]): ConversationMessageMeta[] {
  return rows.map((row) => {
    const address = row.from?.emailAddress?.address || '';
    return {
      graphId: row.id,
      internetMessageId: normalizeMessageId(row.internetMessageId || row.id),
      subject: row.subject || '(без темы)',
      fromEmail: address,
      fromName: row.from?.emailAddress?.name || address,
      received: row.receivedDateTime || new Date().toISOString(),
    };
  });
}

async function listViaGraphFilter(conversationId: string, token: string): Promise<ConversationMessageMeta[]> {
  // No $orderby / minimal $select — $orderby+conversationId causes "too complex".
  // Some tenants also reject bare conversationId filter; fallbacks handle that.
  const filter = encodeURIComponent(`conversationId eq '${escapeODataString(conversationId)}'`);
  let url = `https://graph.microsoft.com/v1.0/me/messages?$filter=${filter}&$top=50`;

  const messages: ConversationMessageMeta[] = [];
  while (url) {
    const page = await graphGetJson<{ value?: GraphMessage[]; '@odata.nextLink'?: string }>(url, token);
    messages.push(...mapGraphMessages(page.value || []));
    url = page['@odata.nextLink'] || '';
  }
  return messages;
}

/** Workaround: put receivedDateTime in both $filter and $orderby. */
async function listViaGraphFilterOrdered(conversationId: string, token: string): Promise<ConversationMessageMeta[]> {
  const filter = encodeURIComponent(
    `conversationId eq '${escapeODataString(conversationId)}' and receivedDateTime ge 1970-01-01T00:00:00Z`,
  );
  const orderby = encodeURIComponent('receivedDateTime asc');
  let url =
    `https://graph.microsoft.com/v1.0/me/messages?$filter=${filter}&$orderby=${orderby}&$top=50`;

  const messages: ConversationMessageMeta[] = [];
  while (url) {
    const page = await graphGetJson<{ value?: GraphMessage[]; '@odata.nextLink'?: string }>(url, token);
    messages.push(...mapGraphMessages(page.value || []));
    url = page['@odata.nextLink'] || '';
  }
  return messages;
}

/**
 * Resolve Graph conversationId from the open item (more reliable than Office.js id alone).
 */
async function resolveGraphConversationId(token: string): Promise<string> {
  const item = currentItem();
  const ewsId = item.itemId;
  if (!ewsId)
    return currentConversationId();

  let restId = ewsId;
  try {
    restId = Office.context.mailbox.convertToRestId(ewsId, Office.MailboxEnums.RestVersion.v2_0);
  } catch {
    /* already rest-shaped on some clients */
  }

  try {
    const data = await graphGetJson<GraphMessage>(
      `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(restId)}?$select=id,conversationId`,
      token,
    );
    if (data.conversationId)
      return data.conversationId;
  } catch {
    /* fall back to Office conversationId */
  }
  return currentConversationId();
}

function ewsRequest(soap: string): Promise<string> {
  return new Promise((resolve, reject) => {
    Office.context.mailbox.makeEwsRequestAsync(soap, (result) => {
      if (result.status === Office.AsyncResultStatus.Succeeded)
        resolve(result.value || '');
      else
        reject(result.error ?? new Error('EWS request failed'));
    });
  });
}

function xmlText(parent: Element, localName: string): string {
  const nodes = parent.getElementsByTagNameNS('*', localName);
  const node = nodes[0];
  return (node?.textContent || '').trim();
}

function listViaEws(conversationId: string): Promise<ConversationMessageMeta[]> {
  const soap = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:m="http://schemas.microsoft.com/exchange/services/2006/messages"
  xmlns:t="http://schemas.microsoft.com/exchange/services/2006/types"
  xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Header>
    <t:RequestServerVersion Version="Exchange2016" />
  </soap:Header>
  <soap:Body>
    <m:GetConversationItems>
      <m:ItemShape>
        <t:BaseShape>IdOnly</t:BaseShape>
        <t:IncludeMimeContent>true</t:IncludeMimeContent>
        <t:AdditionalProperties>
          <t:FieldURI FieldURI="item:Subject"/>
          <t:FieldURI FieldURI="item:DateTimeReceived"/>
          <t:FieldURI FieldURI="message:InternetMessageId"/>
          <t:FieldURI FieldURI="message:From"/>
          <t:FieldURI FieldURI="item:MimeContent"/>
        </t:AdditionalProperties>
      </m:ItemShape>
      <m:FoldersToIgnore>
        <t:DistinguishedFolderId Id="deleteditems"/>
      </m:FoldersToIgnore>
      <m:SortOrder>DateOrderAscending</m:SortOrder>
      <m:Conversations>
        <t:ConversationRequest>
          <t:ConversationId Id="${conversationId.replace(/"/g, '')}" />
        </t:ConversationRequest>
      </m:Conversations>
    </m:GetConversationItems>
  </soap:Body>
</soap:Envelope>`;

  return ewsRequest(soap).then((xml) => {
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    const items = Array.from(doc.getElementsByTagNameNS('*', 'Message'));
    // Some responses wrap as Item
    const fallbackItems = items.length
      ? items
      : Array.from(doc.getElementsByTagNameNS('*', 'Item'));
    const messages: ConversationMessageMeta[] = [];
    for (const node of fallbackItems) {
      const itemIdNodes = node.getElementsByTagNameNS('*', 'ItemId');
      const itemId = itemIdNodes[0]?.getAttribute('Id') || '';
      if (!itemId)
        continue;
      const subject = xmlText(node, 'Subject') || '(без темы)';
      const received = xmlText(node, 'DateTimeReceived') || new Date().toISOString();
      const internetMessageId = normalizeMessageId(xmlText(node, 'InternetMessageId') || itemId);
      const emailNodes = node.getElementsByTagNameNS('*', 'EmailAddress');
      const fromEmail = (emailNodes[0]?.textContent || '').trim();
      const nameNodes = node.getElementsByTagNameNS('*', 'Name');
      const fromName = (nameNodes[0]?.textContent || fromEmail).trim();
      const mimeNodes = node.getElementsByTagNameNS('*', 'MimeContent');
      const mimeBase64 = (mimeNodes[0]?.textContent || '').replace(/\s+/g, '');
      let graphId = itemId;
      try {
        graphId = Office.context.mailbox.convertToRestId(itemId, Office.MailboxEnums.RestVersion.v2_0);
      } catch {
        /* keep ews id */
      }
      messages.push({
        graphId,
        internetMessageId,
        subject,
        fromEmail,
        fromName,
        received,
        mimeBase64: mimeBase64 || undefined,
      });
    }
    if (!messages.length) {
      const fault = xmlText(doc.documentElement, 'faultstring')
        || xmlText(doc.documentElement, 'Message')
        || 'EWS: пустой тред';
      throw new Error(fault);
    }
    return messages;
  });
}

/**
 * List all messages in the current Outlook conversation.
 * Tries Graph (several shapes), then EWS GetConversationItems.
 */
export async function listConversationMessages(): Promise<{
  conversationId: string;
  messages: ConversationMessageMeta[];
}> {
  const officeConversationId = currentConversationId();
  const token = readAzureAccessToken();
  let messages: ConversationMessageMeta[] = [];
  let conversationId = officeConversationId;
  let lastError: Error | null = null;

  if (token) {
    try {
      conversationId = await resolveGraphConversationId(token);
      try {
        messages = await listViaGraphFilter(conversationId, token);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        lastError = error instanceof Error ? error : new Error(msg);
        if (isTooComplexError(msg)) {
          messages = await listViaGraphFilterOrdered(conversationId, token);
        } else {
          throw error;
        }
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      messages = [];
    }
  }

  if (!messages.length) {
    try {
      messages = await listViaEws(officeConversationId);
      conversationId = officeConversationId;
    } catch (error) {
      const ewsMsg = error instanceof Error ? error.message : String(error);
      const graphMsg = lastError?.message || (token ? '' : 'нет Azure-токена Mail.Read');
      throw new Error(
        `Не удалось прочитать тред.\nGraph: ${graphMsg || '—'}\nEWS: ${ewsMsg}`,
      );
    }
  }

  messages.sort((a, b) => a.received.localeCompare(b.received));
  return { conversationId, messages };
}

/** Download raw MIME (.eml) for a conversation message. */
export async function downloadMessageMime(meta: ConversationMessageMeta, fileName: string): Promise<File> {
  const safe = fileName.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0, 80) || 'email';
  const name = safe.endsWith('.eml') ? safe : `${safe}.eml`;

  if (meta.mimeBase64) {
    const binary = Uint8Array.from(atob(meta.mimeBase64), (c) => c.charCodeAt(0));
    return new File([binary], name, { type: 'message/rfc822' });
  }

  const token = readAzureAccessToken();
  if (!token)
    throw new Error('Нет Azure-токена для Graph. Войдите снова.');

  const url = `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(meta.graphId)}/$value`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok)
    throw new Error(`Не удалось скачать MIME (${response.status})`);
  const blob = await response.blob();
  return new File([blob], name, { type: 'message/rfc822' });
}

export function conversationFileName(meta: ConversationMessageMeta, index: number): string {
  const stamp = (meta.received || '').slice(0, 10) || 'msg';
  const who = (meta.fromEmail.split('@')[0] || 'user').slice(0, 24);
  const sub = meta.subject.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0, 40) || 'email';
  return `${stamp}_${String(index + 1).padStart(2, '0')}_${who}_${sub}.eml`;
}
