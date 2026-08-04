import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService, FxRate } from '../api.service';

const DISCLAIMER = 'All data on this page is provided for information and education only and does not constitute investment advice.';

@Component({
  selector: 'app-fx',
  imports: [CommonModule],
  template: `
    <h2>CBN FX Rates</h2>
    <p class="sub">Official published exchange rates.</p>
    <p class="disclaimer">{{ disclaimer }}</p>

    <div class="stat-grid">
      <div class="stat-tile" *ngFor="let r of rates()">
        <div class="label">{{ r.pair }}</div>
        <div class="value">{{ r.rate }}</div>
        <div class="delta muted">{{ r.date }} · {{ r.source }}</div>
      </div>
    </div>
    <p class="loading" *ngIf="rates().length === 0">Loading rates…</p>
  `,
})
export class FxPage implements OnInit {
  disclaimer = DISCLAIMER;
  rates = signal<FxRate[]>([]);
  constructor(private api: ApiService) {}
  ngOnInit() { this.api.fxRates(true).subscribe(r => this.rates.set(r)); }
}
