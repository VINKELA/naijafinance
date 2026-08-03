import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService, CompanyProfile } from '../api.service';

const DISCLAIMER = 'All data on this page is provided for information and education only and does not constitute investment advice.';

@Component({
  selector: 'app-companies',
  imports: [CommonModule],
  template: `
    <h2>Company Profiles &amp; Fundamentals (F-07)</h2>
    <p>Public company profiles with key fundamentals, for display only. <em>{{ disclaimer }}</em></p>
    <table>
      <thead><tr><th>Symbol</th><th>Name</th><th>Sector</th><th>EPS</th><th>P/E</th><th>Book value</th><th>Market cap (₦)</th></tr></thead>
      <tbody>
        <tr *ngFor="let c of companies">
          <td>{{ c.symbol }}</td><td>{{ c.name }}</td><td>{{ c.sector ?? '—' }}</td>
          <td>{{ c.eps ?? '—' }}</td><td>{{ c.pe_ratio ?? '—' }}</td>
          <td>{{ c.book_value ?? '—' }}</td><td>{{ c.market_cap ?? '—' }}</td>
        </tr>
      </tbody>
    </table>
    <p *ngIf="companies.length === 0">Loading profiles…</p>
  `,
  styles: ['table { border-collapse: collapse; width: 100%; } td, th { border: 1px solid #ccc; padding: 6px 10px; text-align: left; }']
})
export class CompaniesPage implements OnInit {
  disclaimer = DISCLAIMER;
  companies: CompanyProfile[] = [];
  constructor(private api: ApiService) {}
  ngOnInit() { this.api.companies().subscribe(c => this.companies = c); }
}
