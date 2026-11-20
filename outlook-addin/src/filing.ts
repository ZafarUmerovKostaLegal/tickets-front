import { ensureEmailsFolder, uploadToFolder, type Location, type MailLink, type UploadOutcome } from './api';
import { getGraphToken } from './auth/authApi';
import { getProfile } from './auth/session';
import { listConversationMessages } from './conversation';
import { buildConversationEml } from './conversationBuild';
import { readAttachmentFile, readMessageFile, type AttachmentInfo, type ItemInfo } from './mailbox';
import { hostLabel, readCurrentOfficeDocument } from './officeDoc';
import { markItemSavedToKosta } from './outlookCategory';
import { markFiled, markFiledMany, rememberTarget, type FilingRule } from './settings';

export type FileRequest = {
  target: Location;
  message: boolean;
  thread: boolean;
  attachments: AttachmentInfo[];
  comment: string;
};

export type FileResult = { saved: string[]; failed: string[]; categoryOk: boolean; fresh: number };

type Progress = (text: string) => void;

export function describeOutcome(name: string, outcome: UploadOutcome): string {
  switch (outcome.status) {
    case 'version':
      return `${name} — новая версия${outcome.document.version ? ` v${outcome.document.version}` : ''}`;
    case 'unchanged':
      return `${name} — без изменений`;
    case 'exists':
      return `${name} — уже сохранено в этом matter${outcome.document.name && outcome.document.name !== name ? ` (${outcome.document.name})` : ''}`;
    case 'duplicate':
      return `${name} — такой файл уже есть: ${outcome.document.name ?? ''}`;
    default:
      return name;
  }
}

export function isFresh(outcome: UploadOutcome): boolean {
  return outcome.status === 'created' || outcome.status === 'version';
}

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

async function fileThread(item: ItemInfo, target: Location, comment: string, progress: Progress): Promise<UploadOutcome & { line: string }> {
  const token = await getGraphToken();
  progress('Читаем всю переписку…');
  const { conversationId, messages } = await listConversationMessages(token);
  if (!messages.length)
    throw new Error('В переписке нет писем');
  const { file } = await buildConversationEml(
    conversationId,
    messages,
    (index, total) => progress(`Собираем переписку ${index}/${total}…`),
    token,
  );
  progress(`Сохраняем переписку (${messages.length} писем)…`);
  const outcome = await uploadToFolder(target.matterId, target.folderId, file, `${comment} · переписка ${messages.length} писем`, mailLink(item, 'thread'));
  markFiledMany(messages.map((row) => row.internetMessageId));
  return { ...outcome, line: describeOutcome(`Переписка (${messages.length} писем)`, outcome) };
}

export async function fileMail(item: ItemInfo, request: FileRequest, progress: Progress): Promise<FileResult> {
  const saved: string[] = [];
  const failed: string[] = [];
  let fresh = 0;
  const comment = commentFor(item, request.comment);
  const { target } = request;

  if (request.thread) {
    try {
      const outcome = await fileThread(item, target, comment, progress);
      saved.push(outcome.line);
      fresh += isFresh(outcome) ? 1 : 0;
    } catch (error) {
      failed.push(`Переписка: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else if (request.message) {
    try {
      progress('Сохраняем письмо…');
      const file = await readMessageFile(item.messageId);
      const outcome = await uploadToFolder(target.matterId, target.folderId, file, comment, mailLink(item, 'email'));
      markFiled(item.messageId);
      saved.push(describeOutcome(file.name, outcome));
      fresh += isFresh(outcome) ? 1 : 0;
    } catch (error) {
      failed.push(`Письмо: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  for (const [index, attachment] of request.attachments.entries()) {
    try {
      progress(`Вложение ${index + 1}/${request.attachments.length}: ${attachment.name}`);
      const file = await readAttachmentFile(attachment);
      const outcome = await uploadToFolder(target.matterId, target.folderId, file, comment, mailLink(item, 'attachment'));
      saved.push(describeOutcome(file.name, outcome));
      fresh += isFresh(outcome) ? 1 : 0;
    } catch (error) {
      failed.push(`${attachment.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  let categoryOk = false;
  if (saved.length) {
    rememberTarget(target);
    categoryOk = (await markItemSavedToKosta()).ok;
  }
  return { saved, failed, categoryOk, fresh };
}

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

export async function fileDropped(target: Location, files: File[], progress: Progress): Promise<FileResult> {
  const saved: string[] = [];
  const failed: string[] = [];
  let fresh = 0;
  for (const [index, file] of files.entries()) {
    try {
      progress(`Загрузка ${index + 1}/${files.length}: ${file.name}`);
      const outcome = await uploadToFolder(target.matterId, target.folderId, file, 'Перетащено в Kosta File');
      saved.push(describeOutcome(file.name, outcome));
      fresh += isFresh(outcome) ? 1 : 0;
    } catch (error) {
      failed.push(`${file.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (saved.length)
    rememberTarget(target);
  return { saved, failed, categoryOk: false, fresh };
}

export async function fileOfficeDocument(host: Office.HostType | undefined, target: Location, comment: string, progress: Progress): Promise<FileResult> {
  progress(`Читаем файл ${hostLabel(host)}…`);
  const file = await readCurrentOfficeDocument(host);
  progress(`Сохраняем «${file.name}»…`);
  const note = [comment.trim(), `${hostLabel(host)} · ${getProfile()?.email || ''}`].filter(Boolean).join(' · ');
  const outcome = await uploadToFolder(target.matterId, target.folderId, file, note);
  rememberTarget(target);
  return { saved: [describeOutcome(file.name, outcome)], failed: [], categoryOk: false, fresh: isFresh(outcome) ? 1 : 0 };
}
