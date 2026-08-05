/** Shared number formatting standard (REQ-14, CEO 16:45 — "kill the 0s").
 *  Google Finance-style: compact tiers, max 2dp, strip trailing zeros,
 *  signed percents, "—" for nil. ONE source of truth app-wide. */

const stripZeros = (s: string) => s.includes('.') ? s.replace(/\.0+$/, '').replace(/\.$/, '') : s;

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
  const sign = n < 0 ? '-' : '';
  // Word tiers everywhere (CEO 19:49 — "20 Million", never 20000000).
  const tier = (d: number, word: string) => `${sign}₦${stripZeros((abs / d).toFixed(2))} ${word}`;
  if (abs >= 1e12) return tier(1e12, 'Trillion');
  if (abs >= 1e9) return tier(1e9, 'Billion');
  if (abs >= 1e6) return tier(1e6, 'Million');
  if (abs >= 1e3) return tier(1e3, 'Thousand');
  return `${sign}₦${stripZeros(abs.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 0 }))}`;
}

/** Word-tier money: 20 Million, 1.5 Billion, 840 Thousand (CEO 19:49 — kill the zeros). */
export function fmtWords(v: any): string {
  if (v === null || v === undefined || v === '' || Number.isNaN(Number(v))) return '—';
  const n = Number(v);
  if (!isFinite(n)) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  const tier = (d: number, word: string) => `${sign}${stripZeros((abs / d).toFixed(abs / d >= 100 ? 0 : 2))} ${word}`;
  if (abs >= 1e12) return tier(1e12, 'Trillion');
  if (abs >= 1e9) return tier(1e9, 'Billion');
  if (abs >= 1e6) return tier(1e6, 'Million');
  if (abs >= 1e3) return tier(1e3, 'Thousand');
  return `${sign}${abs.toLocaleString('en-US')}`;
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

/** Human word-form compact (CEO 19:49 — "20 Million", not 20000000):
 *  1,200,000,000,000 → 1.2 Trillion · 850,400,000 → 850.4 Million. */
export function fmtCompactWords(v: any): string {
  if (v === null || v === undefined || v === '' || Number.isNaN(Number(v))) return '—';
  const n = Number(v);
  if (!isFinite(n)) return '—';
  const abs = Math.abs(n);
  const word = (d: number, name: string) => `${stripZeros((abs / d).toFixed(2))} ${name}`;
  const body = abs >= 1e12 ? word(1e12, 'Trillion')
    : abs >= 1e9 ? word(1e9, 'Billion')
    : abs >= 1e6 ? word(1e6, 'Million')
    : abs >= 1e3 ? word(1e3, 'Thousand')
    : abs.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return `${n < 0 ? '-' : ''}${body}`;
}
