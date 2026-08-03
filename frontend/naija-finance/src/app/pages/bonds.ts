import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService, Bond, Auction } from '../api.service';

const DISCLAIMER = 'All data on this page is provided for information and education only and does not constitute investment advice.';

@Component({
  selector: 'app-bonds',
  imports: [CommonModule],
  template: `
    <h2>Bonds &amp; Treasury Bills</h2>
    <p class="sub">FGN fixed-income instruments and the public DMO auction calendar.</p>
    <p class="disclaimer">{{ disclaimer }}</p>

    <div class="table-wrap">
      <h3>Bond instruments</h3>
      <table class="data">
        <thead><tr><th>Symbol</th><th>Name</th><th class="num">Coupon</th><th class="num">Maturity</th></tr></thead>
        <tbody>
          <tr *ngFor="let b of bonds">
            <td class="sym">{{ b.symbol }}</td><td>{{ b.name }}</td>
            <td class="num">{{ b.coupon_rate ? (b.coupon_rate + '%') : '—' }}</td>
            <td class="num muted">{{ b.maturity_date ?? '—' }}</td>
          </tr>
        </tbody>
      </table>
      <p class="loading" *ngIf="bonds.length === 0">Loading bonds…</p>
    </div>

    <div class="table-wrap">
      <h3>DMO auction calendar</h3>
      <table class="data">
        <thead><tr><th>Date</th><th>Instrument</th><th>Tenor</th><th class="num">Offer (₦bn)</th><th class="num">Stop rate</th></tr></thead>
        <tbody>
          <tr *ngFor="let a of auctions">
            <td>{{ a.auction_date }}</td><td>{{ a.instrument_name }}</td>
            <td>{{ a.tenor }}</td><td class="num">{{ a.offer_size ?? '—' }}</td><td class="num">{{ a.stop_rate ?? '—' }}</td>
          </tr>
        </tbody>
      </table>
      <p class="loading" *ngIf="auctions.length === 0">Loading auctions…</p>
    </div>
  `,
})
export class BondsPage implements OnInit {
  disclaimer = DISCLAIMER;
  bonds: Bond[] = [];
  auctions: Auction[] = [];
  constructor(private api: ApiService) {}
  ngOnInit() {
    this.api.bonds().subscribe(b => this.bonds = b);
    this.api.auctions().subscribe(a => this.auctions = a);
  }
}
