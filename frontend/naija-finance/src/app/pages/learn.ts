import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EDU_CONTENT, EduQuestion } from '../edu-content';

interface EduModule { name: string; icon: string; cards: EduQuestion[]; }

// Single source of truth: the CCO-approved 72-question bank (edu-content.ts).
// The same bank powers the per-module education cards on each module page.
const MODULES: EduModule[] = [
  { name: 'Market Overview', icon: '📊', cards: EDU_CONTENT['market'].questions },
  { name: 'Bonds & Commercial Papers', icon: '🧾', cards: EDU_CONTENT['bonds'].questions },
  { name: 'Mutual Funds', icon: '💰', cards: EDU_CONTENT['funds'].questions },
  { name: 'FX', icon: '💱', cards: EDU_CONTENT['fx'].questions },
  { name: 'Companies & Equities', icon: '🏢', cards: EDU_CONTENT['companies'].questions },
  { name: 'Watchlist', icon: '👀', cards: EDU_CONTENT['watchlist'].questions },
  { name: 'Portfolio', icon: '💼', cards: EDU_CONTENT['portfolio'].questions },
  { name: 'Asset Mix', icon: '🧺', cards: EDU_CONTENT['assetMix'].questions },
  { name: 'Compare', icon: '⚖️', cards: EDU_CONTENT['compare'].questions },
  { name: 'Alerts', icon: '🔔', cards: EDU_CONTENT['alerts'].questions },
  { name: 'News & Learning', icon: '📰', cards: EDU_CONTENT['blog'].questions },
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
          <span class="q">{{ c.pidginHook }}</span>
          <span class="t">{{ c.englishTitle }}</span>
          <span class="chev">{{ open() === (mi + '-' + ci) ? '▾' : '▸' }}</span>
        </button>
        <div class="eduA" *ngIf="open() === (mi + '-' + ci)">
          <p>{{ c.answer }}</p>
          <div class="tags" *ngIf="c.keyTerms.length">
            <span class="pill g" *ngFor="let k of c.keyTerms">{{ k.label }}</span>
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
      .map(m => ({ ...m, cards: m.cards.filter(c => (c.pidginHook + ' ' + c.englishTitle + ' ' + c.answer + ' ' + c.keyTerms.map(k => k.label).join(' ')).toLowerCase().includes(s)) }))
      .filter(m => m.cards.length > 0);
  }
}
