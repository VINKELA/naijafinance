import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, FxRate } from '../api.service';
import { ShareButton } from '../share-button';

const DISCLAIMER = 'All data on this page is provided for information and education only and does not constitute investment advice.';

@Component({
  selector: 'app-fx',
  imports: [CommonModule, FormsModule, ShareButton],
  template: `
    <h2>CBN FX Rates</h2>
    <p class="sub">Official published exchange rates.</p>
    <p class="disclaimer">{{ disclaimer }}</p>

    <input type="search" placeholder="Search FX pairs… e.g. USD/NGN" [(ngModel)]="q" name="fxSearch" style="width:100%;margin-bottom:14px;">

    <div class="stat-grid">
      <div class="stat-tile" *ngFor="let r of visibleRates()">
        <div class="label">{{ r.pair }}</div>
        <div class="value">{{ r.rate }}</div>
        <div class="delta muted">{{ r.date }} · {{ r.source }}</div>
        <div style="margin-top:8px"><app-share-btn [iconOnly]="true" [text]="shareText(r)" link="/fx"></app-share-btn></div>
      </div>
    </div>
    <p class="loading" *ngIf="rates().length === 0">Loading rates…</p>
  `,
})
export class FxPage implements OnInit {
  disclaimer = DISCLAIMER;
  rates = signal<FxRate[]>([]);
  q = '';
  constructor(private api: ApiService) {}
  shareText(r: FxRate): string { return `${r.pair} — NGN ${r.rate} (CBN, ${r.date})`; }
  visibleRates(): FxRate[] {
    const s = this.q.trim().toLowerCase();
    if (!s) return this.rates();
    return this.rates().filter(r => (r.pair ?? '').toLowerCase().includes(s));
  }
  ngOnInit() { this.api.fxRates(true).subscribe(r => this.rates.set(r)); }
}
