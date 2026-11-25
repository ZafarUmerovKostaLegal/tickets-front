import { readConversationOnServer } from './api';
import { normalizeMessageId } from './email';
import { readAzureAccessToken } from './auth/session';

export type ConversationMessageMeta = {
  graphId: string;
  internetMessageId: string;
  subject: string;
  fromEmail: string;
  fromName: string;
  received: string;
  mimeBase64?: string;
  preloaded?: {
    to: Array<{ email: string; name: string }>;
    cc: Array<{ email: string; name: string }>;
    bodyType: string;
    body: string;
  };
};

function describeError(error: unknown): string {
  if (error instanceof Error)
    return error.message;
  if (error && typeof error === 'object') {
    const raw = error as { message?: unknown; name?: unknown; code?: unknown };
    const text = [raw.code, raw.name, raw.message].filter((part) => part != null && String(part).trim()).map(String).join(': ');
    if (text)
      return text;
    try {
      return JSON.stringify(error);
    } catch {
    }
  }
  return String(error);
}

async function listViaServer(conversationId: string): Promise<ConversationMessageMeta[]> {
  const item = currentItem();
  const rows = await readConversationOnServer(conversationId, item.internetMessageId || '');
  return rows.map((row) => ({
    graphId: row.graphId,
    internetMessageId: normalizeMessageId(row.internetMessageId || row.graphId),
    subject: row.subject || '(без темы)',
    fromEmail: row.fromEmail,
    fromName: row.fromName || row.fromEmail,
    received: row.received || new Date().toISOString(),
    preloaded: { to: row.to, cc: row.cc, bodyType: row.bodyType, body: row.body },
  }));
}

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

async function resolveGraphConversationId(token: string): Promise<string> {
  const item = currentItem();
  const ewsId = item.itemId;
  if (!ewsId)
    return currentConversationId();

  let restId = ewsId;
  try {
    restId = Office.context.mailbox.convertToRestId(ewsId, Office.MailboxEnums.RestVersion.v2_0);
  } catch {
  }

  try {
    const data = await graphGetJson<GraphMessage>(
      `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(restId)}?$select=id,conversationId`,
      token,
    );
    if (data.conversationId)
      return data.conversationId;
  } catch {
  }
  return currentConversationId();
}

function ewsRequest(soap: string): Promise<string> {
  return new Promise((resolve, reject) => {
    Office.context.mailbox.makeEwsRequestAsync(soap, (result) => {
      if (result.status === Office.AsyncResultStatus.Succeeded)
        resolve(result.value || '');
      else
        reject(new Error(describeError(result.error) || 'EWS request failed'));
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

export async function listConversationMessages(graphToken?: string | null): Promise<{
  conversationId: string;
  messages: ConversationMessageMeta[];
}> {
  const officeConversationId = currentConversationId();
  const token = graphToken ?? readAzureAccessToken();
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

  let serverError = '';
  if (!messages.length) {
    try {
      messages = await listViaServer(officeConversationId);
      if (messages[0]?.internetMessageId)
        conversationId = officeConversationId;
    } catch (error) {
      serverError = describeError(error);
      messages = [];
    }
  }

  if (!messages.length) {
    try {
      messages = await listViaEws(officeConversationId);
      conversationId = officeConversationId;
    } catch (error) {
      const ewsMsg = describeError(error);
      const graphMsg = lastError?.message || (token ? '' : 'нет токена Microsoft');
      throw new Error(
        `Не удалось прочитать переписку.\nСервер: ${serverError || 'писем не найдено'}\nGraph: ${graphMsg || '—'}\nEWS: ${ewsMsg}`,
      );
    }
  }

  messages.sort((a, b) => a.received.localeCompare(b.received));
  return { conversationId, messages };
}
