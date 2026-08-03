import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService, Fund } from '../api.service';

const DISCLAIMER = 'All data on this page is provided for information and education only and does not constitute investment advice.';

@Component({
  selector: 'app-funds',
  imports: [CommonModule],
  template: `
    <h2>Mutual Funds &amp; Public NAVs</h2>
    <p class="sub">Fund list with published NAV snapshots.</p>
    <p class="disclaimer">{{ disclaimer }}</p>

    <div class="table-wrap">
      <h3>Funds &amp; latest NAV</h3>
      <table class="data">
        <thead><tr><th>Fund</th><th>Manager</th><th>Class</th><th class="num">Latest NAV</th><th class="num">NAV date</th></tr></thead>
        <tbody>
          <tr *ngFor="let f of funds">
            <td class="sym">{{ f.name }}</td><td class="muted">{{ f.manager ?? '—' }}</td>
            <td>{{ f.asset_class_display }}</td>
            <td class="num">{{ f.latest_nav?.nav ?? '—' }}</td>
            <td class="num muted">{{ f.latest_nav?.date ?? '—' }}</td>
          </tr>
        </tbody>
      </table>
      <p class="loading" *ngIf="funds.length === 0">Loading funds…</p>
    </div>
  `,
})
export class FundsPage implements OnInit {
  disclaimer = DISCLAIMER;
  funds: Fund[] = [];
  constructor(private api: ApiService) {}
  ngOnInit() { this.api.funds().subscribe(f => this.funds = f); }
}
