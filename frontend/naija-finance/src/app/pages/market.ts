import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../api.service';

const DISCLAIMER = 'All data on this page is illustrative mock data for demo purposes and does not constitute investment advice. Live NGX feeds replace this layer once the licensed feed decision is finalised.';

@Component({
  selector: 'app-market',
  imports: [CommonModule],
  template: `
    <h2>Market Overview</h2>
    <p class="sub">The Nigerian market at a glance — indices, movers and headlines.</p>
    <p class="disclaimer">{{ disclaimer }}</p>

    <!-- Ticker -->
    <div class="ticker" *ngIf="movers.length">
      <span *ngFor="let m of movers">
        <span class="t-sym">{{ m.symbol }}</span>
        <span class="t-val" [class.up]="m.isUp" [class.down]="!m.isUp">{{ m.price }} {{ m.change }}</span>
      </span>
    </div>

    <!-- Hero -->
    <div class="hero">
      <div class="hero-main">
        <div class="eyebrow">Nigerian Exchange</div>
        <h1>Naija Finance Dashboard</h1>
        <p>Track equities, bonds, funds and FX — built for Nigerian investors, designed mobile-first.</p>
        <div class="hero-stats">
          <div class="hero-stat"><div class="h-label">Advancers</div><div class="h-value up">{{ advancers }}</div></div>
          <div class="hero-stat"><div class="h-label">Decliners</div><div class="h-value down">{{ decliners }}</div></div>
          <div class="hero-stat"><div class="h-label">Indices</div><div class="h-value">{{ indexes.length }}</div></div>
          <div class="hero-stat"><div class="h-label">Headlines</div><div class="h-value">{{ news.length }}</div></div>
        </div>
      </div>
      <div class="card" style="display:flex;flex-direction:column;justify-content:center;gap:8px;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.07em;color:var(--text-muted);font-weight:700;">Featured market</div>
        <div style="font-size:24px;font-weight:800;font-family:var(--mono);" *ngIf="featured">{{ featured.symbol }}</div>
        <div style="font-size:15px;font-family:var(--mono);" *ngIf="featured">{{ featured.price }}</div>
        <span *ngIf="featured" class="pill" [class.up]="featured.isUp" [class.down]="!featured.isUp" style="align-self:flex-start;">{{ featured.change }}</span>
        <div style="color:var(--text-muted);font-size:12px;">Top mover by activity</div>
      </div>
    </div>

    <!-- Indices -->
    <div class="stat-grid">
      <div class="stat-tile index-card" *ngFor="let i of indexes">
        <div class="top">
          <span class="idx-name">{{ i.symbol }}</span>
          <span class="pill" [class.up]="i.isUp" [class.down]="!i.isUp">{{ i.isUp ? '▲' : '▼' }} {{ i.percent_change }}%</span>
        </div>
        <div class="idx-value">{{ i.current_price }}</div>
        <div [innerHTML]="sparkline(i)"></div>
        <div class="delta muted" style="font-size:11.5px;">{{ i.point_change }} pts today</div>
      </div>
    </div>
    <p class="loading" *ngIf="indexes.length === 0">Loading indices…</p>

    <div class="table-wrap">
      <h3>Top movers — by activity</h3>
      <table class="data">
        <thead><tr><th>Symbol</th><th>Name</th><th class="num">Price (₦)</th><th class="num">Change</th></tr></thead>
        <tbody>
          <tr *ngFor="let m of movers">
            <td class="sym">{{ m.symbol }}</td><td class="muted">{{ m.name }}</td>
            <td class="num">{{ m.price }}</td>
            <td class="num"><span class="pill" [class.up]="m.isUp" [class.down]="!m.isUp">{{ m.change }}</span></td>
          </tr>
        </tbody>
      </table>
      <p class="loading" *ngIf="movers.length === 0">Loading movers…</p>
    </div>

    <div class="table-wrap">
      <h3>Headlines</h3>
      <ul class="news-list">
        <li *ngFor="let n of news"><span class="src">{{ n.source }}</span><span>{{ n.title }}</span></li>
      </ul>
      <p class="loading" *ngIf="news.length === 0">Loading news…</p>
    </div>
  `,
})
export class MarketPage implements OnInit {
  disclaimer = DISCLAIMER;
  indexes: any[] = [];
  movers: any[] = [];
  news: any[] = [];
  featured: any = null;
  advancers = 0;
  decliners = 0;

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.api.indexes().subscribe(i => this.indexes = i);
    this.api.movers('active', 10).subscribe(m => {
      this.movers = m;
      this.featured = m[0] ?? null;
      this.advancers = m.filter(x => x.isUp).length;
      this.decliners = m.filter(x => !x.isUp).length;
    });
    this.api.news(8).subscribe(n => this.news = n);
  }

  sparkline(idx: any): string {
    const seed = (idx.symbol || 'NGX').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    let v = seed % 97;
    const pts: number[] = [];
    const n = 14;
    for (let k = 0; k < n; k++) {
      v = (v * 9301 + 49297) % 233280;
      pts.push((v / 233280) * 2 - 1);
    }
    const last = pts[n - 1];
    const trend = idx.isUp ? 1 : -1;
    // shape so the last point reflects today's direction
    const series = pts.map((p, k) => p * 0.6 + trend * (k / n) * 0.9 + last * 0.1);
    const min = Math.min(...series), max = Math.max(...series);
    const W = 260, H = 34;
    const px = (i: number) => (i / (n - 1)) * W;
    const py = (v: number) => H - 4 - ((v - min) / (max - min || 1)) * (H - 8);
    const line = series.map((p, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)},${py(p).toFixed(1)}`).join(' ');
    const fill = `${line} L${W},${H} L0,${H} Z`;
    const color = idx.isUp ? '#10b981' : '#f87171';
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <path d="${fill}" fill="${color}" opacity="0.12"/>
      <path d="${line}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>
    </svg>`;
  }
}
