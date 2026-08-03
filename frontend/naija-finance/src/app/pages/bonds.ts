import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService, Bond, Auction } from '../api.service';

const DISCLAIMER = 'All data on this page is provided for information and education only and does not constitute investment advice.';

@Component({
  selector: 'app-bonds',
  imports: [CommonModule],
  template: `
    <h2>FGN Bonds &amp; Treasury Bills (F-04)</h2>
    <p>Bond instruments and the public DMO auction calendar. <em>{{ disclaimer }}</em></p>

    <h3>Bond instruments</h3>
    <table>
      <thead><tr><th>Symbol</th><th>Name</th><th>Coupon</th></tr></thead>
      <tbody>
        <tr *ngFor="let b of bonds">
          <td>{{ b.symbol }}</td><td>{{ b.name }}</td>
          <td>{{ b.coupon_rate ? (b.coupon_rate + '%') : '—' }}</td>
        </tr>
      </tbody>
    </table>
    <p *ngIf="bonds.length === 0">Loading bonds…</p>

    <h3>DMO auction calendar</h3>
    <table>
      <thead><tr><th>Date</th><th>Instrument</th><th>Tenor</th><th>Offer (₦bn)</th><th>Stop rate</th></tr></thead>
      <tbody>
        <tr *ngFor="let a of auctions">
          <td>{{ a.auction_date }}</td><td>{{ a.instrument_name }}</td>
          <td>{{ a.tenor }}</td><td>{{ a.offer_size ?? '—' }}</td><td>{{ a.stop_rate ?? '—' }}</td>
        </tr>
      </tbody>
    </table>
  `,
  styles: ['table { border-collapse: collapse; width: 100%; margin-bottom: 1rem; } td, th { border: 1px solid #ccc; padding: 6px 10px; text-align: left; }']
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
