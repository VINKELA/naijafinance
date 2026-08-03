import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../api.service';

const DISCLAIMER = 'All data on this page is illustrative mock data for demo purposes and does not constitute investment advice. Live exchange feeds replace this layer once the NGX data decision is finalised.';

@Component({
  selector: 'app-market',
  imports: [CommonModule],
  template: `
    <h2>Market Overview</h2>
    <p class="sub">Indices, movers and headlines across the Nigerian market.</p>
    <p class="disclaimer">{{ disclaimer }}</p>

    <div class="stat-grid">
      <div class="stat-tile" *ngFor="let i of indexes">
        <div class="label">{{ i.symbol }}</div>
        <div class="value">{{ i.current_price }}</div>
        <div class="delta" [class.up]="i.isUp" [class.down]="!i.isUp">
          {{ i.isUp ? '▲' : '▼' }} {{ i.point_change }} ({{ i.percent_change }}%)
        </div>
      </div>
    </div>
    <p class="loading" *ngIf="indexes.length === 0">Loading indices…</p>

    <div class="table-wrap">
      <h3>Top movers</h3>
      <table class="data">
        <thead><tr><th>Symbol</th><th>Name</th><th class="num">Price</th><th class="num">Change</th></tr></thead>
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
  constructor(private api: ApiService) {}
  ngOnInit() {
    this.api.indexes().subscribe(i => this.indexes = i);
    this.api.movers('active', 10).subscribe(m => this.movers = m);
    this.api.news(8).subscribe(n => this.news = n);
  }
}
