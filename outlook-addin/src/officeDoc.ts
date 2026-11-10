/** Read the open Word/Excel/PowerPoint file as a Blob for FM upload. */

function fileNameFromUrl(url: string): string {
  try {
    const path = decodeURIComponent(url.split(/[?#]/)[0] || '');
    const base = path.split(/[/\\]/).pop() || '';
    if (base && /\.[a-z0-9]{2,8}$/i.test(base))
      return base;
  } catch {
    /* ignore */
  }
  return '';
}

function defaultNameForHost(host: Office.HostType | undefined): string {
  if (host === Office.HostType.Word)
    return 'document.docx';
  if (host === Office.HostType.Excel)
    return 'workbook.xlsx';
  if (host === Office.HostType.PowerPoint)
    return 'presentation.pptx';
  return 'document.bin';
}

function mimeForName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith('.docx'))
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (lower.endsWith('.xlsx'))
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (lower.endsWith('.pptx'))
    return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  if (lower.endsWith('.doc'))
    return 'application/msword';
  if (lower.endsWith('.xls'))
    return 'application/vnd.ms-excel';
  if (lower.endsWith('.ppt'))
    return 'application/vnd.ms-powerpoint';
  return 'application/octet-stream';
}

export async function readCurrentOfficeDocument(host: Office.HostType | undefined): Promise<File> {
  const doc = Office.context.document;
  if (!doc?.getFileAsync)
    throw new Error('Этот клиент Office не отдаёт файл документа');

  let suggested = defaultNameForHost(host);
  try {
    const props = await new Promise<{ url?: string }>((resolve, reject) => {
      doc.getFilePropertiesAsync((result) => {
        if (result.status === Office.AsyncResultStatus.Succeeded)
          resolve(result.value as { url?: string });
        else
          reject(result.error ?? new Error('getFilePropertiesAsync failed'));
      });
    });
    const fromUrl = fileNameFromUrl(props.url || '');
    if (fromUrl)
      suggested = fromUrl;
  } catch {
    /* keep default */
  }

  const officeFile = await new Promise<Office.File>((resolve, reject) => {
    doc.getFileAsync(Office.FileType.Compressed, { sliceSize: 65536 }, (result) => {
      if (result.status === Office.AsyncResultStatus.Succeeded)
        resolve(result.value);
      else
        reject(result.error ?? new Error('getFileAsync failed'));
    });
  });

  try {
    const chunks: Uint8Array[] = [];
    let offset = 0;
    for (let i = 0; i < officeFile.sliceCount; i += 1) {
      const slice = await new Promise<Office.Slice>((resolve, reject) => {
        officeFile.getSliceAsync(i, (result) => {
          if (result.status === Office.AsyncResultStatus.Succeeded)
            resolve(result.value);
          else
            reject(result.error ?? new Error(`getSliceAsync ${i} failed`));
        });
      });
      const data = slice.data;
      if (data instanceof ArrayBuffer)
        chunks.push(new Uint8Array(data));
      else if (Array.isArray(data))
        chunks.push(Uint8Array.from(data as number[]));
      else if (typeof data === 'string') {
        const binary = atob(data);
        const bytes = new Uint8Array(binary.length);
        for (let j = 0; j < binary.length; j += 1)
          bytes[j] = binary.charCodeAt(j);
        chunks.push(bytes);
      } else {
        throw new Error('Неизвестный формат среза файла');
      }
      offset += slice.size;
    }
    void offset;
    const total = chunks.reduce((sum, part) => sum + part.length, 0);
    const merged = new Uint8Array(total);
    let at = 0;
    for (const part of chunks) {
      merged.set(part, at);
      at += part.length;
    }
    return new File([merged], suggested, { type: mimeForName(suggested) });
  } finally {
    await new Promise<void>((resolve) => {
      officeFile.closeAsync(() => resolve());
    });
  }
}

export function hostLabel(host: Office.HostType | undefined): string {
  if (host === Office.HostType.Word)
    return 'Word';
  if (host === Office.HostType.Excel)
    return 'Excel';
  if (host === Office.HostType.PowerPoint)
    return 'PowerPoint';
  if (host === Office.HostType.Outlook)
    return 'Outlook';
  return 'Office';
}
