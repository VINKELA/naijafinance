import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, FxRate } from '../api.service';
import { LangService } from '../lang.service';
import { ShareButton } from '../share-button';
import { EduCard } from '../edu-card';
import { EDU_CONTENT } from '../edu-content';

const DISCLAIMER = 'All data on this page is provided for information and education only and does not constitute investment advice.';

@Component({
  selector: 'app-fx',
  imports: [CommonModule, FormsModule, ShareButton, EduCard],
  template: `
    <h2>{{ t('CBN FX Rates', 'CBN FX Rate-Dem') }}</h2>
    <p class="sub">Official published exchange rates.</p>
    <p class="disclaimer">{{ t(disclaimer, 'All di data for dis page na for information and education only — e no be investment advice.') }}</p>

    <app-edu-card
      moduleLabel="FX"
      [questions]="edu['fx'].questions"
      [defaultExpanded]="edu['fx'].defaultExpanded"
    ></app-edu-card>

    <div style="position:relative;margin-bottom:14px;">
      <input type="search" placeholder="{{ t('Type to search FX pairs… e.g. USD/NGN', 'Type make e search FX pairs… e.g. USD/NGN') }}" [(ngModel)]="q" name="fxSearch" style="width:100%;" (input)="onQuery()" (keydown)="onKey($event)" autocomplete="off">
      <div class="sugg-dd" *ngIf="suggestions().length">
        <button type="button" class="sugg" *ngFor="let s of suggestions(); let i = index" [class.on]="i === activeIndex()" (mousedown)="pick(s)">
          <span class="s">{{ s.pair }}</span><span class="n">{{ s.rate }}</span><span class="t">{{ s.source }}</span>
        </button>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat-tile" *ngFor="let r of pagedRates()">
        <div class="label">{{ r.pair }}</div>
        <div class="value">{{ r.rate }}</div>
        <div class="delta muted">{{ r.date }} · {{ r.source }}</div>
        <div style="margin-top:8px"><app-share-btn [iconOnly]="true" [text]="shareText(r)" link="/fx"></app-share-btn></div>
      </div>
    </div>
    <div class="pager" *ngIf="visibleRates().length > pageSize">
      <button type="button" (click)="page = page - 1" [disabled]="page === 0">← Prev</button>
      <span class="muted">Page {{ page + 1 }} / {{ pageCount() }} · {{ visibleRates().length }} pairs</span>
      <button type="button" (click)="page = page + 1" [disabled]="page >= pageCount() - 1">Next →</button>
    </div>
    <p class="loading" *ngIf="rates().length === 0">Loading rates…</p>
  `,
})
export class FxPage implements OnInit {
  edu = EDU_CONTENT;
  disclaimer = DISCLAIMER;
  rates = signal<FxRate[]>([]);
  q = '';
  page = 0;
  pageSize = 10;
  suggestions = signal<FxRate[]>([]);
  activeIndex = signal(-1);
  constructor(private api: ApiService, private lang: LangService) {}
  get isPidgin() { return this.lang.isPidgin; }
  t(en: string, pidgin: string): string { return this.lang.t(en, pidgin); }
  shareText(r: FxRate): string { return `${r.pair} — NGN ${r.rate} (CBN, ${r.date})`; }
  visibleRates(): FxRate[] {
    const s = this.q.trim().toLowerCase();
    if (!s) return this.rates();
    return this.rates().filter(r => (r.pair ?? '').toLowerCase().includes(s));
  }
  pagedRates(): FxRate[] {
    const v = this.visibleRates();
    const start = this.page * this.pageSize;
    return v.slice(start, start + this.pageSize);
  }
  pageCount(): number { return Math.max(1, Math.ceil(this.visibleRates().length / this.pageSize)); }
  onQuery() {
    this.page = 0;
    const s = this.q.trim().toLowerCase();
    const list = s
      ? this.rates().filter(r => (r.pair ?? '').toLowerCase().includes(s)).slice(0, 8)
      : [];
    this.suggestions.set(list);
    this.activeIndex.set(-1);
  }
  onKey(e: KeyboardEvent) {
    const n = this.suggestions().length;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!n) return;
      e.preventDefault();
      let idx = this.activeIndex() + (e.key === 'ArrowDown' ? 1 : -1);
      if (idx < 0) idx = n - 1;
      if (idx >= n) idx = 0;
      this.activeIndex.set(idx);
    } else if (e.key === 'Enter') {
      const list = this.suggestions();
      const idx = this.activeIndex();
      const target = idx >= 0 && list[idx] ? list[idx] : list[0];
      if (target) { e.preventDefault(); this.pick(target); }
    } else if (e.key === 'Escape') {
      this.suggestions.set([]);
    }
  }
  pick(r: FxRate) {
    this.q = r.pair;
    this.suggestions.set([]);
    this.activeIndex.set(-1);
    this.page = 0;
  }
  ngOnInit() { this.api.fxRates(true).subscribe(r => this.rates.set(r)); }
}
