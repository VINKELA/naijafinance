import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService, FxRate } from '../api.service';

const DISCLAIMER = 'All data on this page is provided for information and education only and does not constitute investment advice.';

@Component({
  selector: 'app-fx',
  imports: [CommonModule],
  template: `
    <h2>CBN FX Rates (F-06)</h2>
    <p>Official published exchange rates. <em>{{ disclaimer }}</em></p>
    <table>
      <thead><tr><th>Pair</th><th>Rate</th><th>Date</th><th>Source</th></tr></thead>
      <tbody>
        <tr *ngFor="let r of rates">
          <td>{{ r.pair }}</td><td>{{ r.rate }}</td><td>{{ r.date }}</td><td>{{ r.source }}</td>
        </tr>
      </tbody>
    </table>
    <p *ngIf="rates.length === 0">Loading rates…</p>
  `,
  styles: ['table { border-collapse: collapse; width: 100%; } td, th { border: 1px solid #ccc; padding: 6px 10px; text-align: left; }']
})
export class FxPage implements OnInit {
  disclaimer = DISCLAIMER;
  rates: FxRate[] = [];
  constructor(private api: ApiService) {}
  ngOnInit() { this.api.fxRates(true).subscribe(r => this.rates = r); }
}
