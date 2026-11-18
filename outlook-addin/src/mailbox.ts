/** Office.js mailbox helpers for the pane: current item, full MIME, attachments, draft actions. */
import { bareEmailAddress, buildEml, normalizeMessageId, readCurrentMail, readCurrentMailMeta } from './email';
import { attachmentFileName, messageFileName } from './naming';

export type AttachmentInfo = {
  id: string;
  name: string;
  size: number;
  /** Outlook item attachments (forwarded letters) come as .eml */
  isItem: boolean;
  contentType: string;
};

export type ItemInfo = {
  mode: 'read' | 'compose';
  messageId: string;
  conversationId: string;
  subject: string;
  fromEmail: string;
  fromName: string;
  received: string;
  attachments: AttachmentInfo[];
};

function supports(version: string): boolean {
  try {
    return Boolean(Office.context.requirements.isSetSupported('Mailbox', version));
  } catch {
    return false;
  }
}

function asyncResult<T>(run: (cb: (result: Office.AsyncResult<T>) => void) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    run((result) => {
      if (result.status === Office.AsyncResultStatus.Succeeded)
        resolve(result.value);
      else
        reject(new Error(result.error?.message || 'Outlook отклонил запрос'));
    });
  });
}

function isCompose(item: Office.Item): boolean {
  return typeof (item as Office.MessageCompose).subject?.getAsync === 'function';
}

export function readItemInfo(): ItemInfo | null {
  const item = Office.context?.mailbox?.item;
  if (!item)
    return null;
  if (isCompose(item)) {
    return {
      mode: 'compose',
      messageId: '',
      conversationId: (item as Office.MessageCompose).conversationId || '',
      subject: '',
      fromEmail: '',
      fromName: '',
      received: '',
      attachments: [],
    };
  }
  const read = item as Office.MessageRead;
  const meta = readCurrentMailMeta();
  const attachments = (read.attachments ?? [])
    .filter((row) => !row.isInline && row.attachmentType !== Office.MailboxEnums.AttachmentType.Cloud)
    .map((row) => ({
      id: row.id,
      name: row.name,
      size: row.size,
      isItem: row.attachmentType === Office.MailboxEnums.AttachmentType.Item,
      contentType: row.contentType || 'application/octet-stream',
    }));
  return {
    mode: 'read',
    messageId: meta.messageId,
    conversationId: read.conversationId || '',
    subject: meta.subject,
    fromEmail: bareEmailAddress(meta.fromEmail),
    fromName: meta.fromName,
    received: meta.received,
    attachments,
  };
}

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1)
    bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * The open message as an .eml. `getAsFileAsync` (Mailbox 1.14) gives the original MIME with
 * attachments; older clients get a rebuilt message with both bodies.
 */
export async function readMessageFile(expectedMessageId: string): Promise<File> {
  const item = Office.context.mailbox.item as Office.MessageRead & {
    getAsFileAsync?: (cb: (result: Office.AsyncResult<string>) => void) => void;
  };
  const meta = readCurrentMailMeta();
  if (expectedMessageId && meta.messageId !== expectedMessageId)
    throw new Error('Письмо сменилось — повторите сохранение');
  const name = messageFileName(meta);
  if (supports('1.14') && typeof item.getAsFileAsync === 'function') {
    try {
      const base64 = await asyncResult<string>((cb) => item.getAsFileAsync!(cb));
      if (base64)
        return new File([base64ToBytes(base64)], name, { type: 'message/rfc822' });
    } catch {
      /* fall back to the rebuilt copy */
    }
  }
  const rebuilt = buildEml(await readCurrentMail(expectedMessageId));
  return new File([rebuilt], name, { type: 'message/rfc822' });
}

export async function readAttachmentFile(attachment: AttachmentInfo): Promise<File> {
  if (!supports('1.8'))
    throw new Error('Этот Outlook не отдаёт вложения надстройкам (нужен Mailbox 1.8)');
  const item = Office.context.mailbox.item as Office.MessageRead;
  const content = await asyncResult<Office.AttachmentContent>((cb) => item.getAttachmentContentAsync(attachment.id, cb));
  const format = content.format;
  if (format === Office.MailboxEnums.AttachmentContentFormat.Base64) {
    return new File([base64ToBytes(content.content)], attachmentFileName(attachment.name), { type: attachment.contentType });
  }
  if (format === Office.MailboxEnums.AttachmentContentFormat.Eml) {
    const name = attachmentFileName(/\.eml$/i.test(attachment.name) ? attachment.name : `${attachment.name}.eml`);
    return new File([content.content], name, { type: 'message/rfc822' });
  }
  throw new Error(`Вложение «${attachment.name}» хранится в облаке — сохраните его вручную`);
}

/** Attach a filed document to the draft being composed. */
export async function attachToDraft(name: string, blob: Blob): Promise<void> {
  const item = Office.context.mailbox.item as Office.MessageCompose;
  if (!item || !isCompose(item))
    throw new Error('Откройте новое письмо или ответ');
  if (!supports('1.8'))
    throw new Error('Этот Outlook не позволяет вкладывать файлы из надстройки');
  const buffer = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < buffer.length; i += chunk)
    binary += String.fromCharCode(...buffer.subarray(i, i + chunk));
  await asyncResult<string>((cb) => item.addFileAttachmentFromBase64Async(btoa(binary), name, cb));
}

/** Put a link to the FM document at the cursor in the draft. */
export async function insertLinkInDraft(url: string, text: string): Promise<void> {
  const item = Office.context.mailbox.item as Office.MessageCompose;
  if (!item || !isCompose(item))
    throw new Error('Откройте новое письмо или ответ');
  const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  await asyncResult<void>((cb) => item.body.setSelectedDataAsync(
    `<a href="${escape(url)}">${escape(text)}</a>`,
    { coercionType: Office.CoercionType.Html },
    cb,
  ));
}

export function openInBrowser(url: string): void {
  try {
    const ui = Office.context.ui as Office.UI & { openBrowserWindow?: (url: string) => void };
    if (typeof ui.openBrowserWindow === 'function') {
      ui.openBrowserWindow(url);
      return;
    }
  } catch {
    /* fall through */
  }
  window.open(url, '_blank', 'noopener');
}

export { normalizeMessageId };

/**
 * New Outlook / Outlook on the web: messages and files dragged from Outlook into the pane
 * arrive through the DragAndDropEvent (Mailbox 1.15). Returns false where it is not available.
 */
export function onOutlookDrop(handler: (event: { type: 'dragover' | 'drop'; x: number; y: number; files: File[] }) => void): boolean {
  const eventType = (Office.EventType as unknown as Record<string, string>).DragAndDropEvent;
  if (!eventType || !supports('1.15'))
    return false;
  try {
    Office.context.mailbox.addHandlerAsync(eventType as unknown as Office.EventType, (args: {
      dragAndDropEventData?: { type?: string; pageX?: number; pageY?: number; dataTransfer?: { files?: Array<{ name: string; type?: string; fileContent: Blob }> } };
    }) => {
      const data = args?.dragAndDropEventData;
      if (!data?.type)
        return;
      const files = (data.dataTransfer?.files ?? []).map((row) => new File([row.fileContent], row.name, { type: row.type || 'application/octet-stream' }));
      handler({ type: data.type === 'drop' ? 'drop' : 'dragover', x: data.pageX ?? 0, y: data.pageY ?? 0, files });
    });
    return true;
  } catch {
    return false;
  }
}
