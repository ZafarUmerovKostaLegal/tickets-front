export function ticketAttachmentFileName(attachmentPath) {
    const rawName = attachmentPath.split(/[/\\]/).filter(Boolean).pop() || 'attachment';
    return rawName.replace(/^[0-9a-f]{32}_/i, '');
}
