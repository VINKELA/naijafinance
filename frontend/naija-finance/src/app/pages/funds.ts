import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService, Fund } from '../api.service';

const DISCLAIMER = 'All data on this page is provided for information and education only and does not constitute investment advice.';

@Component({
  selector: 'app-funds',
  imports: [CommonModule],
  template: `
    <h2>Mutual Funds &amp; Public NAVs (F-05)</h2>
    <p>Fund list with published NAV snapshots. <em>{{ disclaimer }}</em></p>
    <table>
      <thead><tr><th>Fund</th><th>Manager</th><th>Class</th><th>Latest NAV</th><th>NAV date</th></tr></thead>
      <tbody>
        <tr *ngFor="let f of funds">
          <td>{{ f.name }}</td><td>{{ f.manager ?? '—' }}</td>
          <td>{{ f.asset_class_display }}</td>
          <td>{{ f.latest_nav?.nav ?? '—' }}</td>
          <td>{{ f.latest_nav?.date ?? '—' }}</td>
        </tr>
      </tbody>
    </table>
    <p *ngIf="funds.length === 0">Loading funds…</p>
  `,
  styles: ['table { border-collapse: collapse; width: 100%; } td, th { border: 1px solid #ccc; padding: 6px 10px; text-align: left; }']
})
export class FundsPage implements OnInit {
  disclaimer = DISCLAIMER;
  funds: Fund[] = [];
  constructor(private api: ApiService) {}
  ngOnInit() { this.api.funds().subscribe(f => this.funds = f); }
}
