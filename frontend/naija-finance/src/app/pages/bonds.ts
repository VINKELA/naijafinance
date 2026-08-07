import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService, Bond, Auction } from '../api.service';
import { fmtDate, fmtPrice } from '../format';
import { ShareButton } from '../share-button';

const DISCLAIMER = 'All data on this page is provided for information and education only and does not constitute investment advice.';
const CP_RESTRICTED = 'Restricted — professional / institutional investors only.';

@Component({
  selector: 'app-bonds',
  imports: [CommonModule, RouterLink, ShareButton],
  template: `
    <h2>Bonds &amp; Treasury Bills</h2>
    <p class="sub">FGN fixed-income instruments and the public DMO auction calendar.</p>
    <p class="disclaimer">{{ disclaimer }}</p>

    <div class="table-wrap">
      <h3>Bond instruments</h3>
      <table class="data">
        <thead><tr><th>Symbol</th><th>Name</th><th class="num">Coupon</th><th class="num">Maturity</th><th></th></tr></thead>
        <tbody>
          <tr *ngFor="let b of bonds()">
            <td class="sym"><a routerLink="/asset" [queryParams]="{type:'instrument', symbol: b.symbol}">{{ b.symbol }}</a></td><td>{{ b.name }}</td>
            <td class="num">{{ b.coupon_rate ? (fmtPrice(b.coupon_rate) + '%') : '—' }}</td>
            <td class="num muted">{{ fmtDate(b.maturity_date) }}</td>
            <td><app-share-btn [text]="shareText(b)" [link]="'/symbol?symbol=' + b.symbol"></app-share-btn></td>
          </tr>
        </tbody>
      </table>
      <p class="loading" *ngIf="bonds().length === 0">Loading bonds…</p>
    </div>

    <div class="table-wrap">
      <h3>Commercial papers</h3>
      <p class="pill" style="margin-bottom:8px;background:var(--warn);color:#fff;display:inline-block;">{{ cpRestricted }}</p>
      <p class="muted" style="font-size:11.5px;margin-bottom:10px;">Commercial papers are short-term unsecured promissory notes issued by corporations. These instruments are restricted to professional and institutional investors under Nigerian securities regulations and are displayed here for informational purposes only.</p>
      <table class="data">
        <thead><tr><th>Symbol</th><th>Name</th><th class="num">Discount rate</th><th class="num">Maturity</th></tr></thead>
        <tbody>
          <tr *ngFor="let cp of cps()">
            <td class="sym"><a routerLink="/asset" [queryParams]="{type:'instrument', symbol: cp.symbol}">{{ cp.symbol }}</a></td><td>{{ cp.name }}</td>
            <td class="num">{{ cp.coupon_rate ? (fmtPrice(cp.coupon_rate) + '%') : '—' }}</td>
            <td class="num muted">{{ fmtDate(cp.maturity_date) }}</td>
          </tr>
        </tbody>
      </table>
      <p class="loading" *ngIf="cps().length === 0">Loading commercial papers…</p>
    </div>

    <div class="table-wrap">
      <h3>DMO auction calendar</h3>
      <table class="data">
        <thead><tr><th>Date</th><th>Instrument</th><th>Tenor</th><th class="num">Offer (₦bn)</th><th class="num">Stop rate</th></tr></thead>
        <tbody>
          <tr *ngFor="let a of auctions()">
            <td>{{ fmtDate(a.auction_date) }}</td><td>{{ a.instrument_name }}</td>
            <td>{{ a.tenor }}</td><td class="num">{{ fmtPrice(a.offer_size) }}</td><td class="num">{{ fmtPrice(a.stop_rate) }}</td>
          </tr>
        </tbody>
      </table>
      <p class="loading" *ngIf="auctions().length === 0">Loading auctions…</p>
    </div>
  `,
})
export class BondsPage implements OnInit {
  fmtDate = fmtDate; fmtPrice = fmtPrice;
  disclaimer = DISCLAIMER;
  cpRestricted = CP_RESTRICTED;
  bonds = signal<Bond[]>([]);
  cps = signal<Bond[]>([]);
  auctions = signal<Auction[]>([]);
  constructor(private api: ApiService) {}
  shareText(b: Bond): string { return `${b.symbol} — ${b.name} (FGN bond)`; }
  ngOnInit() {
    this.api.bonds().subscribe(b => this.bonds.set(b));
    this.api.commercialPapers().subscribe(cp => this.cps.set(cp));
    this.api.auctions().subscribe(a => this.auctions.set(a));
  }
}
