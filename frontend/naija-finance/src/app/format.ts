/** Shared number formatting standard (REQ-14, CEO 16:45 — "kill the 0s").
 *  Google Finance-style: compact tiers, max 2dp, strip trailing zeros,
 *  signed percents, "—" for nil. ONE source of truth app-wide. */

const stripZeros = (s: string) => s.replace(/\.?0+$/, '');

/** Price/index value: thousands separators, max 2dp, no trailing zeros. Nil → — */
export function fmtPrice(v: any): string {
  if (v === null || v === undefined || v === '' || Number.isNaN(Number(v))) return '—';
  const n = Number(v);
  if (!isFinite(n)) return '—';
  if (n === 0) return '0';
  return stripZeros(n.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 0 }));
}

/** Signed percent: +0.29% / -1.23%, max 2dp, no trailing zeros. Nil → — */
export function fmtPct(v: any): string {
  if (v === null || v === undefined || v === '' || Number.isNaN(Number(v))) return '—';
  const n = Number(v);
  if (!isFinite(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${stripZeros(n.toFixed(2))}%`;
}

/** Money: ₦ + compact tiers — ≥1T → ₦1.20tn, ≥1B → ₦850.40bn, ≥1M → ₦12.50m,
 *  else thousands separators (₦838,360). Nil → — */
export function fmtMoney(v: any): string {
  if (v === null || v === undefined || v === '' || Number.isNaN(Number(v))) return '—';
  const n = Number(v);
  if (!isFinite(n)) return '—';
  const abs = Math.abs(n);
  const tier = (d: number, suffix: string) => `${n < 0 ? '-' : ''}₦${stripZeros((abs / d).toFixed(2))}${suffix}`;
  if (abs >= 1e12) return tier(1e12, 'tn');
  if (abs >= 1e9) return tier(1e9, 'bn');
  if (abs >= 1e6) return tier(1e6, 'm');
  return `${n < 0 ? '-' : ''}₦${stripZeros(abs.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 0 }))}`;
}

/** Compact count (volume/shares): 1.2M, 45,600. Nil → — */
export function fmtCompact(v: any): string {
  if (v === null || v === undefined || v === '' || Number.isNaN(Number(v))) return '—';
  const n = Number(v);
  if (!isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${stripZeros((abs / 1e9).toFixed(1))}B`;
  if (abs >= 1e6) return `${stripZeros((abs / 1e6).toFixed(1))}M`;
  if (abs >= 1e3) return `${stripZeros((abs / 1e3).toFixed(1))}K`;
  return abs.toLocaleString('en-US');
}
