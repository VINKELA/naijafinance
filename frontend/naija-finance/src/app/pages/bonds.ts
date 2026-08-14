import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, Bond, Auction } from '../api.service';
import { ShareButton } from '../share-button';
import { EduCard } from '../edu-card';
import { EDU_CONTENT } from '../edu-content';

const DISCLAIMER = 'All data on this page is provided for information and education only and does not constitute investment advice.';

@Component({
  selector: 'app-bonds',
  imports: [CommonModule, FormsModule, RouterLink, ShareButton, EduCard],
  template: `
    <h2>Bonds &amp; Treasury Bills</h2>
    <p class="sub">FGN fixed-income instruments and the public DMO auction calendar.</p>
    <p class="disclaimer">{{ disclaimer }}</p>

    <app-edu-card
      moduleLabel="Bonds &amp; Commercial Papers"
      [questions]="edu['bonds'].questions"
      [defaultExpanded]="edu['bonds'].defaultExpanded"
    ></app-edu-card>

    <div class="card" style="margin-bottom: 20px;">
      <input type="search" placeholder="Search bonds, commercial papers, auctions…" [(ngModel)]="q" name="bondSearch" style="width:100%;">
    </div>

    <div class="table-wrap">
      <h3>Bond instruments</h3>
      <table class="data">
        <thead><tr><th>Symbol</th><th>Name</th><th class="num">Coupon</th><th class="num">Maturity</th><th></th></tr></thead>
        <tbody>
          <tr *ngFor="let b of visibleBonds()">
            <td class="sym"><a routerLink="/asset" [queryParams]="{type:'instrument', symbol: b.symbol}">{{ b.symbol }}</a></td><td>{{ b.name }}</td>
            <td class="num">{{ b.coupon_rate ? (b.coupon_rate + '%') : '—' }}</td>
            <td class="num muted">{{ b.maturity_date ?? '—' }}</td>
            <td><app-share-btn [text]="shareText(b)" [link]="'/asset?type=instrument&symbol=' + b.symbol"></app-share-btn></td>
          </tr>
        </tbody>
      </table>
      <p class="loading" *ngIf="bonds().length === 0">Loading bonds…</p>
    </div>

    <div class="table-wrap">
      <h3>Commercial papers</h3>
      <table class="data">
        <thead><tr><th>Symbol</th><th>Name</th><th class="num">Discount rate</th><th class="num">Maturity</th><th></th></tr></thead>
        <tbody>
          <tr *ngFor="let cp of visibleCps()">
            <td class="sym"><a routerLink="/asset" [queryParams]="{type:'instrument', symbol: cp.symbol}">{{ cp.symbol }}</a></td><td>{{ cp.name }}</td>
            <td class="num">{{ cp.coupon_rate ? (cp.coupon_rate + '%') : '—' }}</td>
            <td class="num muted">{{ cp.maturity_date ?? '—' }}</td>
            <td><app-share-btn [text]="shareCpText(cp)" [link]="'/bonds'"></app-share-btn></td>
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
          <tr *ngFor="let a of visibleAuctions()">
            <td>{{ a.auction_date }}</td><td>{{ a.instrument_name }}</td>
            <td>{{ a.tenor }}</td><td class="num">{{ a.offer_size ?? '—' }}</td><td class="num">{{ a.stop_rate ?? '—' }}</td>
          </tr>
        </tbody>
      </table>
      <p class="loading" *ngIf="auctions().length === 0">Loading auctions…</p>
    </div>
  `,
})
export class BondsPage implements OnInit {
  edu = EDU_CONTENT;
  disclaimer = DISCLAIMER;
  bonds = signal<Bond[]>([]);
  cps = signal<Bond[]>([]);
  auctions = signal<Auction[]>([]);
  q = '';
  constructor(private api: ApiService) {}
  shareText(b: Bond): string { return `${b.symbol} — ${b.name} (FGN bond)`; }
  shareCpText(cp: Bond): string { return `${cp.symbol} — ${cp.name} (commercial paper)`; }
  private matches(v: string | null | undefined): boolean {
    const s = this.q.trim().toLowerCase();
    if (!s) return true;
    return (v ?? '').toLowerCase().includes(s);
  }
  visibleBonds(): Bond[] { return this.bonds().filter(b => this.matches(b.symbol) || this.matches(b.name)); }
  visibleCps(): Bond[] { return this.cps().filter(c => this.matches(c.symbol) || this.matches(c.name)); }
  visibleAuctions(): Auction[] { return this.auctions().filter(a => this.matches(a.instrument_name) || this.matches(a.tenor) || this.matches(a.auction_date)); }
  ngOnInit() {
    this.api.bonds().subscribe(b => this.bonds.set(b));
    this.api.commercialPapers().subscribe(cp => this.cps.set(cp));
    this.api.auctions().subscribe(a => this.auctions.set(a));
  }
}
