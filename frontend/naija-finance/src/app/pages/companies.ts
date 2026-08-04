import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService, CompanyProfile } from '../api.service';
import { ShareButton } from '../share-button';

const DISCLAIMER = 'All data on this page is provided for information and education only and does not constitute investment advice.';

@Component({
  selector: 'app-companies',
  imports: [CommonModule, ShareButton],
  template: `
    <h2>Company Profiles &amp; Fundamentals</h2>
    <p class="sub">Public company profiles with key fundamentals, for display only.</p>
    <p class="disclaimer">{{ disclaimer }}</p>

    <div class="table-wrap">
      <h3>Profiles</h3>
      <table class="data">
        <thead><tr><th>Symbol</th><th>Name</th><th>Sector</th><th class="num">EPS</th><th class="num">P/E</th><th class="num">Book value</th><th class="num">Market cap (₦)</th><th></th></tr></thead>
        <tbody>
          <tr *ngFor="let c of companies()">
            <td class="sym">{{ c.symbol }}</td><td>{{ c.name }}</td><td class="muted">{{ c.sector ?? '—' }}</td>
            <td class="num">{{ c.eps ?? '—' }}</td><td class="num">{{ c.pe_ratio ?? '—' }}</td>
            <td class="num">{{ c.book_value ?? '—' }}</td><td class="num">{{ c.market_cap ?? '—' }}</td>
            <td><app-share-btn [text]="shareText(c)" [link]="'/symbol?symbol=' + c.symbol"></app-share-btn></td>
          </tr>
        </tbody>
      </table>
      <p class="loading" *ngIf="companies().length === 0">Loading profiles…</p>
    </div>
  `,
})
export class CompaniesPage implements OnInit {
  disclaimer = DISCLAIMER;
  companies = signal<CompanyProfile[]>([]);
  constructor(private api: ApiService) {}
  ngOnInit() { this.api.companies().subscribe(c => this.companies.set(c)); }
  shareText(c: CompanyProfile): string { return `${c.name} (${c.symbol}) — company profile`; }
}
