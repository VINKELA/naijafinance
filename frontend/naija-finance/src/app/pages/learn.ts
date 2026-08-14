import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface EduCard { q: string; t: string; a: string; k: string[]; }
interface EduModule { name: string; icon: string; cards: EduCard[]; }

const MODULES: EduModule[] = [
  {
    name: 'Bonds', icon: '📊',
    cards: [
      { q: 'Wetin be bond?', t: 'What is a bond?', a: 'A loan you give to a government or company; they pay you interest (coupon) and return your money at maturity.', k: ['bond', 'coupon', 'maturity'] },
      { q: 'Wetin be FGN bond?', t: 'What is an FGN bond?', a: 'A bond issued by the federal government (DMO) — generally lower credit risk than corporate bonds, but not risk-free.', k: ['FGN', 'DMO', 'sovereign'] },
      { q: 'Wetin be yield?', t: 'What is yield?', a: 'Your income as a % of what you paid — coupon rate is not the same as yield when price differs.', k: ['yield', 'coupon', 'price'] },
      { q: 'If I hold bond till maturity, wetin I go get?', t: 'What do I get if I hold a bond to maturity?', a: 'Your principal back, plus all coupons paid along the way.', k: ['principal', 'face value'] },
      { q: 'Wetin be T-bill?', t: 'What is a Treasury bill?', a: 'Short-term government debt (≤1 yr) sold at a discount; you receive face value at maturity.', k: ['T-bill', 'discount', 'tenor'] },
      { q: 'Bond dey risky?', t: 'Are bonds risky?', a: 'Lower risk than stocks, but not zero: default risk, interest-rate risk, inflation.', k: ['credit risk', 'duration', 'inflation'] },
      { q: 'Government bond vs company bond — wetin be the difference?', t: 'Government vs corporate bond', a: 'Government (FGN) bonds carry sovereign backing; corporate bonds carry company credit risk, usually with higher yield.', k: ['sovereign', 'credit risk'] },
    ],
  },
  {
    name: 'Commercial Papers', icon: '🧾',
    cards: [
      { q: 'Wetin be commercial paper?', t: 'What is commercial paper?', a: 'Short-term unsecured loan to a company (days–months); higher yield than T-bills, more risk.', k: ['commercial paper', 'tenor', 'issuer'] },
      { q: 'How commercial paper differ from bond?', t: 'How is commercial paper different from a bond?', a: 'Much shorter tenor (days–months vs years) and no collateral.', k: ['tenor', 'unsecured'] },
      { q: 'Why commercial paper yield high pass T-bill?', t: 'Why do commercial paper yields beat T-bills?', a: 'More risk — unsecured corporate credit vs government backing.', k: ['risk premium', 'credit'] },
      { q: 'Who fit issue commercial paper?', t: 'Who can issue commercial paper?', a: 'Creditworthy companies raising short-term cash; usually big corporates and banks.', k: ['issuer', 'credit rating'] },
      { q: 'Wetin be discount?', t: 'What is a discount (in CP context)?', a: 'You buy below face value and receive face value at maturity — the difference is your return.', k: ['discount', 'face value'] },
      { q: 'I fit sell am before maturity?', t: 'Can I sell before maturity?', a: 'Yes, on the secondary market — but the price depends on market conditions.', k: ['secondary market', 'liquidity'] },
    ],
  },
  {
    name: 'Funds', icon: '💰',
    cards: [
      { q: 'Wetin be mutual fund?', t: 'What is a mutual fund?', a: 'A pool of many investors\' money run by a professional manager.', k: ['mutual fund', 'NAV', 'unit'] },
      { q: 'Wetin be NAV?', t: 'What is NAV?', a: 'Net Asset Value — the price of one unit of the fund, usually updated daily.', k: ['NAV', 'unit', 'AUM'] },
      { q: 'How I go know which fund good?', t: 'How do I evaluate a fund?', a: 'Look at NAV history, fund size, fees, and what it invests in — past performance is not a promise.', k: ['performance', 'fees', 'holdings'] },
      { q: 'Wetin be money market fund?', t: 'What is a money market fund?', a: 'A fund investing in short-term, low-risk instruments (T-bills, CP, bank deposits).', k: ['money market', 'liquidity'] },
      { q: 'Fund vs stock — which one?', t: 'Fund vs stock — what\'s the difference?', a: 'A fund spreads your money across many assets (diversification); a stock is one company.', k: ['diversification', 'concentration'] },
      { q: 'I fit withdraw my money anytime?', t: 'Can I withdraw anytime?', a: 'Depends on fund type: money-market and equity funds are usually redeemable; some have lock-ins.', k: ['redemption', 'lock-in'] },
    ],
  },
  {
    name: 'FX', icon: '💱',
    cards: [
      { q: 'Wetin be exchange rate?', t: 'What is an exchange rate?', a: 'The price of one currency in another (e.g. how many naira for 1 USD).', k: ['exchange rate', 'USD/NGN'] },
      { q: 'Why dollar rate dey change?', t: 'Why does the dollar rate keep changing?', a: 'Supply and demand, CBN policy, oil prices, global flows.', k: ['official rate', 'market rate'] },
      { q: 'Wetin be official rate vs market rate?', t: 'Official vs market rate?', a: 'The CBN-published rate vs the rate you actually get from banks and Bureaux de Change.', k: ['CBN', 'parallel market'] },
      { q: 'Wetin be CBN official rate?', t: 'What is the CBN official rate?', a: 'The exchange rate published by the Central Bank of Nigeria; other market rates may differ.', k: ['CBN', 'official rate'] },
      { q: 'How FX dey affect my investments?', t: 'How does FX affect my investments?', a: 'Currency moves change the naira value of foreign assets and the cost of imports.', k: ['currency risk', 'devaluation'] },
      { q: 'Wetin be devaluation?', t: 'What is devaluation?', a: 'When the naira\'s official value drops against other currencies.', k: ['devaluation', 'purchasing power'] },
      { q: 'I fit use app to change money?', t: 'Can I use this app to exchange money?', a: 'No — the app shows rates; it does not do transactions.', k: ['data-only', 'no execution'] },
    ],
  },
  {
    name: 'Alerts', icon: '🔔',
    cards: [
      { q: 'Wetin be alert?', t: 'What is an alert?', a: 'Automatic notification when an instrument crosses your chosen level.', k: ['threshold', 'notification'] },
      { q: 'How I set alert?', t: 'How do I set an alert?', a: 'Pick an instrument, set a threshold level, choose your notification channel.', k: ['threshold', 'trigger'] },
      { q: 'Wetin fit trigger alert?', t: 'What can trigger an alert?', a: 'Price, yield, NAV, or % change crossing your level.', k: ['trigger', 'condition'] },
      { q: 'How many alert I fit get?', t: 'How many alerts can I have?', a: 'Multiple — one per instrument and level you want to track.', k: ['limits', 'coverage'] },
      { q: 'Na advice alert be?', t: 'Are alerts advice?', a: 'No — they just tell you when a level is hit; decisions remain yours.', k: ['notification', 'not advice'] },
      { q: 'Alert vs advice — wetin different?', t: 'What\'s the difference between an alert and advice?', a: 'An alert just tells you a price/yield/NAV crossed your chosen level; it never tells you what to buy or sell.', k: ['threshold', 'notification'] },
    ],
  },
  {
    name: 'Compare', icon: '⚖️',
    cards: [
      { q: 'How I go compare two assets?', t: 'How do I compare two assets?', a: 'Side-by-side price/yield/NAV history overlay.', k: ['benchmark', 'time series'] },
      { q: 'Wetin be benchmark?', t: 'What is a benchmark?', a: 'A reference index used to measure an asset\'s performance against.', k: ['benchmark', 'index'] },
      { q: 'Why I need compare?', t: 'Why compare?', a: 'Spot differences in performance, risk, and timing before deciding.', k: ['analysis', 'relative performance'] },
      { q: 'Wetin compare fit tell me wey chart no fit?', t: 'What can compare show that a single chart can\'t?', a: 'Relative strength and timing gaps between two instruments at a glance.', k: ['relative strength', 'overlay'] },
      { q: 'I fit compare bond with stock?', t: 'Can I compare a bond with a stock?', a: 'Yes — different scales, but the overlay shows behaviour side by side.', k: ['cross-asset', 'scale'] },
      { q: 'Why past performance no be guarantee?', t: 'Why is past performance not a guarantee?', a: 'Markets change; what an asset did before does not promise the same result later.', k: ['historical returns', 'risk'] },
      { q: 'Wetin be time series?', t: 'What is a time series?', a: 'A sequence of values over time (e.g. daily prices), used to spot trends.', k: ['trend', 'historical data'] },
    ],
  },
  {
    name: 'News & Learning', icon: '📰',
    cards: [
      { q: 'Wetin dey inside blog?', t: 'What\'s in the blog?', a: 'Market education and company news in plain language.', k: ['education', 'analysis'] },
      { q: 'Na advice di post be?', t: 'Are posts advice?', a: 'No — analysis and education; not investment advice.', k: ['disclaimer', 'education'] },
      { q: 'How I go take understand market news?', t: 'How do I make sense of market news?', a: 'Focus on what changed, who it affects, and what it means for prices — plain-English explainers.', k: ['news', 'impact'] },
      { q: 'How I go know wetin post dey talk?', t: 'How do I know what a post is about?', a: 'Title and excerpt on each card; open the full post to read.', k: ['cards', 'reading'] },
      { q: 'Wetin be \'plain language\'?', t: 'What is "plain language"?', a: 'No jargon — terms explained as you read; key terms link to the glossary.', k: ['glossary', 'jargon-free'] },
      { q: 'Wetin be inflation?', t: 'What is inflation?', a: 'The general rise in prices over time; it reduces what your money can buy.', k: ['purchasing power', 'CPI'] },
      { q: 'Wetin be compound interest?', t: 'What is compound interest?', a: 'Earning interest on your interest — your money grows faster the longer it stays invested.', k: ['compounding', 'principal'] },
      { q: 'How I go start to invest?', t: 'How do I start investing?', a: 'Start small and regular: learn the basics, track with watchlists, build a diversified mix over time — and for personal advice, talk to a licensed financial adviser.', k: ['diversification', 'discipline'] },
    ],
  },
];

@Component({
  selector: 'app-learn',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="secHead"><h2>Learn <span class="tag">Education</span></h2><p style="margin:4px 0 0;color:var(--txt2);font-size:13px;">Plain-language answers to the questions people ask most — in English and Pidgin.</p></div>

    <input type="search" placeholder="Search questions… e.g. bond, NAV, FX" [(ngModel)]="q" name="learnSearch" style="width:100%;margin-bottom:14px;">

    <div *ngFor="let mod of visibleModules(); let mi = index" class="card" style="margin-bottom:16px;">
      <h3 style="margin:0 0 10px;">{{ mod.icon }} {{ mod.name }} <span class="tag">{{ mod.cards.length }}</span></h3>
      <div *ngFor="let c of mod.cards; let ci = index" class="eduItem" [class.open]="open() === (mi + '-' + ci)">
        <button type="button" class="eduQ" (click)="toggle(mi + '-' + ci)">
          <span class="q">{{ c.q }}</span>
          <span class="t">{{ c.t }}</span>
          <span class="chev">{{ open() === (mi + '-' + ci) ? '▾' : '▸' }}</span>
        </button>
        <div class="eduA" *ngIf="open() === (mi + '-' + ci)">
          <p>{{ c.a }}</p>
          <div class="tags" *ngIf="c.k.length">
            <span class="pill g" *ngFor="let k of c.k">{{ k }}</span>
          </div>
        </div>
      </div>
    </div>

    <p class="disc">⚠️ Educational information only. Not investment advice. Nothing on this page is a recommendation or a promise of returns.</p>
  `,
  styles: [`
    .eduItem { border-top: 1px solid var(--border, rgba(128,128,128,.18)); }
    .eduQ { width:100%; display:flex; align-items:baseline; gap:10px; padding:10px 2px; background:none; border:0; cursor:pointer; text-align:left; color:inherit; font:inherit; }
    .eduQ .q { font-weight:700; color:var(--acc, #16c784); min-width:200px; }
    .eduQ .t { flex:1; color:var(--txt2, #999); font-size:12.5px; }
    .eduQ .chev { color:var(--txt3, #777); }
    .eduA { padding:0 2px 12px; color:var(--txt, #ddd); font-size:14px; }
    .eduA p { margin:0 0 8px; }
    .tags { display:flex; gap:6px; flex-wrap:wrap; }
  `]
})
export class LearnPage {
  modules = MODULES;
  q = '';
  open = signal<string | null>(null);
  toggle(key: string) { this.open.set(this.open() === key ? null : key); }
  visibleModules(): EduModule[] {
    const s = this.q.trim().toLowerCase();
    if (!s) return this.modules;
    return this.modules
      .map(m => ({ ...m, cards: m.cards.filter(c => (c.q + ' ' + c.t + ' ' + c.a + ' ' + c.k.join(' ')).toLowerCase().includes(s)) }))
      .filter(m => m.cards.length > 0);
  }
}
