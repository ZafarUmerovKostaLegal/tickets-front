export const FIXED_FEE_LINE_KIND = 'fixed_fee';

type FeeLine = {
  lineKind?: string | null;
  lineTotal?: number | string | null;
};

export function roundInvoiceMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function invoiceFixedFeeTotal(
  lines: readonly FeeLine[] | null | undefined,
): number {
  let sum = 0;
  for (const line of lines ?? []) {
    if ((line.lineKind ?? '').toLowerCase() !== FIXED_FEE_LINE_KIND)
      continue;
    const amount = Number(line.lineTotal);
    if (Number.isFinite(amount))
      sum += amount;
  }
  return roundInvoiceMoney(sum);
}

/** Hours and expenses before the extra fixed amount. Null when there is no fee to split off. */
export function invoiceServicesAmount(total: number | null, fee: number): number | null {
  if (total == null || !Number.isFinite(total) || !(fee > 0))
    return null;
  return roundInvoiceMoney(total - fee);
}

export function parseInvoiceFixedFeeInput(raw: string): number | null {
  const text = raw.trim().replace(/\s/g, '').replace(',', '.');
  if (!text)
    return null;
  const amount = Number(text);
  if (!Number.isFinite(amount))
    return null;
  return roundInvoiceMoney(amount);
}

export function readProjectExtraFixedFee(
  row: { extra_fixed_fee_amount?: unknown; extraFixedFeeAmount?: unknown; extra_fixed_fee_description?: unknown; extraFixedFeeDescription?: unknown } | null | undefined,
): { amount: number; description: string } {
  if (!row)
    return { amount: 0, description: '' };
  const raw = row.extra_fixed_fee_amount ?? row.extraFixedFeeAmount;
  const amount = raw == null || String(raw).trim() === '' ? 0 : Number(String(raw).replace(/\s/g, '').replace(',', '.'));
  const description = String(row.extra_fixed_fee_description ?? row.extraFixedFeeDescription ?? '').trim();
  return {
    amount: Number.isFinite(amount) && amount > 0 ? roundInvoiceMoney(amount) : 0,
    description,
  };
}
