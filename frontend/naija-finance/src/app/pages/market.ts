import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../api.service';

const DISCLAIMER = 'All data on this page is illustrative mock data for demo purposes and does not constitute investment advice. Live exchange feeds replace this layer once the NGX data decision is finalised.';

@Component({
  selector: 'app-market',
  imports: [CommonModule],
  template: `
    <h2>Market Overview (F-01/F-02/F-03)</h2>
    <p><em>{{ disclaimer }}</em></p>

    <h3>Indices</h3>
    <table>
      <thead><tr><th>Index</th><th>Value</th><th>Change</th><th>%</th></tr></thead>
      <tbody>
        <tr *ngFor="let i of indexes">
          <td>{{ i.symbol }} — {{ i.name }}</td>
          <td>{{ i.current_price }}</td>
          <td [style.color]="i.isUp ? '#188038' : '#c5221f'">{{ i.point_change }}</td>
          <td [style.color]="i.isUp ? '#188038' : '#c5221f'">{{ i.percent_change }}%</td>
        </tr>
      </tbody>
    </table>
    <p *ngIf="indexes.length === 0">Loading indices…</p>

    <h3>Top movers</h3>
    <table>
      <thead><tr><th>Symbol</th><th>Name</th><th>Price</th><th>Change</th></tr></thead>
      <tbody>
        <tr *ngFor="let m of movers">
          <td>{{ m.symbol }}</td><td>{{ m.name }}</td><td>{{ m.price }}</td>
          <td [style.color]="m.isUp ? '#188038' : '#c5221f'">{{ m.change }}</td>
        </tr>
      </tbody>
    </table>
    <p *ngIf="movers.length === 0">Loading movers…</p>

    <h3>Headlines</h3>
    <ul>
      <li *ngFor="let n of news"><strong>{{ n.source }}</strong> — {{ n.title }}</li>
    </ul>
    <p *ngIf="news.length === 0">Loading news…</p>
  `,
  styles: ['table { border-collapse: collapse; width: 100%; margin-bottom: 1rem; } td, th { border: 1px solid #ccc; padding: 6px 10px; text-align: left; }']
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
