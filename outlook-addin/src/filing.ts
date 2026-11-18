/** Filing operations used by the pane: message, attachments, whole thread, Office document. */
import { checkinDocument, ensureEmailsFolder, uploadToFolder, type Location, type MailLink } from './api';
import { getGraphToken } from './auth/authApi';
import { getProfile } from './auth/session';
import { listConversationMessages } from './conversation';
import { buildConversationEml } from './conversationBuild';
import { readAttachmentFile, readMessageFile, type AttachmentInfo, type ItemInfo } from './mailbox';
import { hostLabel, readCurrentOfficeDocument } from './officeDoc';
import { markItemSavedToKosta } from './outlookCategory';
import { getConversationDoc, markFiled, markFiledMany, rememberTarget, setConversationDoc, type FilingRule } from './settings';

export type FileRequest = {
  target: Location;
  message: boolean;
  thread: boolean;
  attachments: AttachmentInfo[];
  comment: string;
};

export type FileResult = { saved: string[]; failed: string[]; categoryOk: boolean };

type Progress = (text: string) => void;

function mailLink(item: ItemInfo, kind: MailLink['kind']): MailLink {
  return {
    messageId: item.messageId,
    conversationId: item.conversationId,
    fromEmail: item.fromEmail,
    subject: item.subject,
    kind,
  };
}

function commentFor(item: ItemInfo, extra: string): string {
  const base = `Outlook · ${item.fromEmail || 'без отправителя'}`;
  return extra.trim() ? `${extra.trim()} · ${base}` : base;
}

async function fileThread(item: ItemInfo, target: Location, comment: string, progress: Progress): Promise<string> {
  const token = await getGraphToken();
  progress('Читаем всю переписку…');
  const { conversationId, messages } = await listConversationMessages(token);
  if (!messages.length)
    throw new Error('В переписке нет писем');
  const { file, storageKey } = await buildConversationEml(
    conversationId,
    messages,
    (index, total) => progress(`Собираем переписку ${index}/${total}…`),
    token,
  );
  const existing = getConversationDoc(storageKey);
  const text = `${comment} · переписка ${messages.length} писем`;
  let documentId = existing?.matterId === target.matterId ? existing.documentId : undefined;
  if (documentId) {
    progress(`Обновляем файл переписки (${messages.length} писем)…`);
    try {
      await checkinDocument(documentId, file, text);
    } catch {
      documentId = undefined;
    }
  }
  if (!documentId) {
    progress(`Сохраняем переписку (${messages.length} писем)…`);
    const uploaded = await uploadToFolder(target.matterId, target.folderId, file, text, mailLink(item, 'thread'));
    documentId = uploaded[0]?.id;
    if (!documentId)
      throw new Error('Сервер не вернул документ');
  }
  setConversationDoc(storageKey, {
    documentId,
    matterId: target.matterId,
    fileName: file.name,
    messageCount: messages.length,
    updatedAt: new Date().toISOString(),
  });
  markFiledMany(messages.map((row) => row.internetMessageId));
  return `${file.name} (${messages.length} писем)`;
}

/** File what the user ticked into the chosen location; one failure does not stop the rest. */
export async function fileMail(item: ItemInfo, request: FileRequest, progress: Progress): Promise<FileResult> {
  const saved: string[] = [];
  const failed: string[] = [];
  const comment = commentFor(item, request.comment);
  const { target } = request;

  if (request.thread) {
    try {
      saved.push(await fileThread(item, target, comment, progress));
    } catch (error) {
      failed.push(`Переписка: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else if (request.message) {
    try {
      progress('Сохраняем письмо…');
      const file = await readMessageFile(item.messageId);
      await uploadToFolder(target.matterId, target.folderId, file, comment, mailLink(item, 'email'));
      markFiled(item.messageId);
      saved.push(file.name);
    } catch (error) {
      failed.push(`Письмо: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  for (const [index, attachment] of request.attachments.entries()) {
    try {
      progress(`Вложение ${index + 1}/${request.attachments.length}: ${attachment.name}`);
      const file = await readAttachmentFile(attachment);
      await uploadToFolder(target.matterId, target.folderId, file, comment, mailLink(item, 'attachment'));
      saved.push(file.name);
    } catch (error) {
      failed.push(`${attachment.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  let categoryOk = false;
  if (saved.length) {
    rememberTarget(target);
    categoryOk = (await markItemSavedToKosta()).ok;
  }
  return { saved, failed, categoryOk };
}

/** Legacy rules point at a matter only: they file into its Correspondence/Emails. */
export async function ruleTarget(rule: FilingRule): Promise<Location> {
  if (rule.folderId) {
    return {
      matterId: rule.matterId,
      matterName: rule.matterName,
      matterCode: '',
      clientId: '',
      clientName: rule.clientName,
      folderId: rule.folderId,
      folderPath: rule.folderPath ?? [],
    };
  }
  const folderId = await ensureEmailsFolder(rule.matterId);
  return {
    matterId: rule.matterId,
    matterName: rule.matterName,
    matterCode: '',
    clientId: '',
    clientName: rule.clientName,
    folderId,
    folderPath: [{ id: '', name: 'Correspondence' }, { id: folderId, name: 'Emails' }],
  };
}

/** Files dropped onto a folder (from Outlook or the desktop) — plain uploads. */
export async function fileDropped(target: Location, files: File[], progress: Progress): Promise<FileResult> {
  const saved: string[] = [];
  const failed: string[] = [];
  for (const [index, file] of files.entries()) {
    try {
      progress(`Загрузка ${index + 1}/${files.length}: ${file.name}`);
      await uploadToFolder(target.matterId, target.folderId, file, 'Перетащено в Kosta File');
      saved.push(file.name);
    } catch (error) {
      failed.push(`${file.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (saved.length)
    rememberTarget(target);
  return { saved, failed, categoryOk: false };
}

export async function fileOfficeDocument(host: Office.HostType | undefined, target: Location, comment: string, progress: Progress): Promise<FileResult> {
  progress(`Читаем файл ${hostLabel(host)}…`);
  const file = await readCurrentOfficeDocument(host);
  progress(`Сохраняем «${file.name}»…`);
  const note = [comment.trim(), `${hostLabel(host)} · ${getProfile()?.email || ''}`].filter(Boolean).join(' · ');
  await uploadToFolder(target.matterId, target.folderId, file, note);
  rememberTarget(target);
  return { saved: [file.name], failed: [], categoryOk: false };
}
