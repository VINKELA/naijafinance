import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService, Fund } from '../api.service';
import { ShareButton } from '../share-button';

const DISCLAIMER = 'All data on this page is provided for information and education only and does not constitute investment advice.';

@Component({
  selector: 'app-funds',
  imports: [CommonModule, ShareButton],
  template: `
    <h2>Mutual Funds &amp; Public NAVs</h2>
    <p class="sub">Fund list with published NAV snapshots.</p>
    <p class="disclaimer">{{ disclaimer }}</p>

    <div class="table-wrap">
      <h3>Funds &amp; latest NAV</h3>
      <table class="data">
        <thead><tr><th>Fund</th><th>Manager</th><th>Class</th><th class="num">Latest NAV</th><th class="num">NAV date</th><th></th></tr></thead>
        <tbody>
          <tr *ngFor="let f of funds()">
            <td class="sym">{{ f.name }}</td><td class="muted">{{ f.manager ?? '—' }}</td>
            <td>{{ f.asset_class_display }}</td>
            <td class="num">{{ f.latest_nav?.nav ?? '—' }}</td>
            <td class="num muted">{{ f.latest_nav?.date ?? '—' }}</td>
            <td><app-share-btn [text]="shareText(f)" link="/funds"></app-share-btn></td>
          </tr>
        </tbody>
      </table>
      <p class="loading" *ngIf="funds().length === 0">Loading funds…</p>
    </div>
  `,
})
export class FundsPage implements OnInit {
  disclaimer = DISCLAIMER;
  funds = signal<Fund[]>([]);
  constructor(private api: ApiService) {}
  shareText(f: Fund): string { return `${f.name} — NAV ${f.latest_nav?.nav ?? '—'} (${f.asset_class_display})`; }
  ngOnInit() { this.api.funds().subscribe(f => this.funds.set(f)); }
}
