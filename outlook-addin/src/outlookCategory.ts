/** Outlook category shown in the message list after a successful FM upload. */
export const SAVED_CATEGORY = 'Saved to Kosta';

function asAsync<T>(
  run: (cb: (result: Office.AsyncResult<T>) => void) => void,
): Promise<Office.AsyncResult<T>> {
  return new Promise((resolve) => {
    run((result) => resolve(result));
  });
}

function getReadItem(): Office.MessageRead | null {
  try {
    const item = Office.context?.mailbox?.item;
    if (!item || !('categories' in item))
      return null;
    return item as Office.MessageRead;
  } catch {
    return null;
  }
}

/** Ensure the master category exists (once per mailbox). Safe to call repeatedly. */
export async function ensureSavedMasterCategory(): Promise<void> {
  try {
    const master = Office.context.mailbox.masterCategories;
    if (!master)
      return;
    const listed = await asAsync<Office.CategoryDetails[]>(
      (cb) => master.getAsync(cb),
    );
    if (listed.status !== Office.AsyncResultStatus.Succeeded)
      return;
    const names = (listed.value || []).map((c) => (c.displayName || '').toLowerCase());
    if (names.includes(SAVED_CATEGORY.toLowerCase()))
      return;
    await asAsync<void>((cb) => master.addAsync(
      [{
        displayName: SAVED_CATEGORY,
        color: Office.MailboxEnums.CategoryColor.Preset4,
      }],
      cb,
    ));
  } catch {
    /* master list may be read-only in shared/delegate mailboxes */
  }
}

function categoryName(value: string | Office.CategoryDetails): string {
  if (typeof value === 'string')
    return value;
  return value.displayName || '';
}

export async function itemHasSavedCategory(): Promise<boolean> {
  const item = getReadItem();
  if (!item?.categories)
    return false;
  try {
    const result = await asAsync<Office.CategoryDetails[] | string[]>(
      (cb) => item.categories.getAsync(cb as (r: Office.AsyncResult<Office.CategoryDetails[]>) => void),
    );
    if (result.status !== Office.AsyncResultStatus.Succeeded)
      return false;
    const cats = result.value || [];
    return cats.some((c) => categoryName(c).toLowerCase() === SAVED_CATEGORY.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Mark the currently open message with "Saved to Kosta".
 * Call after a successful File Manager upload.
 */
export async function markItemSavedToKosta(): Promise<{ ok: boolean; detail?: string }> {
  const item = getReadItem();
  if (!item?.categories)
    return { ok: false, detail: 'Категории Outlook недоступны для этого письма' };

  await ensureSavedMasterCategory();

  if (await itemHasSavedCategory())
    return { ok: true };

  const added = await asAsync<void>((cb) => item.categories.addAsync([SAVED_CATEGORY], cb));
  if (added.status !== Office.AsyncResultStatus.Succeeded) {
    const code = added.error?.code || added.error?.name || 'error';
    const msg = added.error?.message || String(code);
    // InvalidCategory → master add may have failed (permissions); surface briefly
    return { ok: false, detail: msg };
  }
  return { ok: true };
}
