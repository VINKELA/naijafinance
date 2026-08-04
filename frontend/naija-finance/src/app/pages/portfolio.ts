import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../api.service';

const DISCLAIMER = 'All data on this page is provided for information and education only and does not constitute investment advice.';

@Component({
  selector: 'app-portfolio',
  imports: [CommonModule, FormsModule],
  template: `
    <h2>Portfolio (F-09)</h2>
    <p class="sub">Manual positions, P&L and allocation.</p>
    <p class="disclaimer">{{ disclaimer }}</p>
    <p class="error" *ngIf="error">{{ error }}</p>

    <div class="stat-grid" *ngIf="insights()">
      <div class="stat-tile">
        <div class="label">Total value</div>
        <div class="value">{{ insights().totals?.formattedValue ?? '—' }}</div>
      </div>
      <div class="stat-tile">
        <div class="label">Cost</div>
        <div class="value">{{ insights().totals?.formattedCost ?? '—' }}</div>
      </div>
      <div class="stat-tile">
        <div class="label">Gain / loss</div>
        <div class="value" [class.up]="(insights().totals?.gainLoss ?? 0) >= 0" [class.down]="(insights().totals?.gainLoss ?? 0) < 0">
          {{ insights().totals?.formattedGainLoss ?? '—' }}
        </div>
        <div class="delta">{{ insights().totals?.gainLossPct ?? 0 }}%</div>
      </div>
    </div>

    <div class="card" style="margin-bottom: 20px;">
      <form class="form-row" (ngSubmit)="createPortfolio()">
        <input type="text" placeholder="New portfolio name" [(ngModel)]="newName" name="newName" required>
        <button type="submit">Create</button>
      </form>
    </div>

    <div class="card" style="margin-bottom: 20px;">
      <form class="form-row" (ngSubmit)="addItem()">
        <select [(ngModel)]="form.portfolioId" name="portfolioId" required>
          <option *ngFor="let p of portfolios()" [ngValue]="p.id">{{ p.name }}</option>
        </select>
        <input type="text" placeholder="Symbol (e.g. MTNN)" [(ngModel)]="form.symbol" name="symbol" required>
        <input type="number" step="any" placeholder="Quantity" [(ngModel)]="form.quantity" name="quantity" required>
        <input type="number" step="any" placeholder="Purchase price" [(ngModel)]="form.purchasePrice" name="purchasePrice" required>
        <button type="submit">Add position</button>
      </form>
    </div>

    <div class="table-wrap" *ngFor="let p of portfolios()">
      <h3>{{ p.name }} — {{ p.total_value }}</h3>
      <table class="data">
        <thead><tr><th>Symbol</th><th>Name</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Value</th><th class="num">G/L</th></tr></thead>
        <tbody>
          <tr *ngFor="let it of p.items">
            <td class="sym">{{ it.symbol }}</td><td>{{ it.name }}</td>
            <td class="num">{{ it.quantity }}</td>
            <td class="num">{{ it.current_price }}</td>
            <td class="num">{{ it.current_value }}</td>
            <td class="num" [class.up]="it.gain_loss >= 0" [class.down]="it.gain_loss < 0">{{ it.gain_loss }} ({{ it.gain_loss_pct }}%)</td>
          </tr>
        </tbody>
      </table>
      <p class="loading" *ngIf="p.items.length === 0">No positions yet.</p>
    </div>
  `,
})
export class PortfolioPage implements OnInit {
  disclaimer = DISCLAIMER;
  portfolios = signal<any[]>([]);
  insights = signal<any>(null);
  newName = '';
  error = '';
  form = { portfolioId: null as number | null, symbol: '', quantity: null as number | null, purchasePrice: null as number | null };

  constructor(private api: ApiService) {}

  ngOnInit() { this.refresh(); }

  refresh() {
    if (!this.api.isAuthed) { this.error = 'Sign in to use portfolios (Account page).'; return; }
    this.api.portfolios().subscribe({
      next: (p) => { this.portfolios.set(p); this.error = ''; if (p.length && this.form.portfolioId === null) this.form.portfolioId = p[0].id; },
      error: () => this.error = 'Could not load portfolios — are you logged in?',
    });
    this.api.portfolioInsights().subscribe({
      next: (i) => this.insights.set(i),
      error: () => {},
    });
  }

  createPortfolio() {
    this.api.createPortfolio(this.newName.trim()).subscribe({
      next: () => { this.newName = ''; this.refresh(); },
      error: (e) => this.error = e?.error?.detail ?? 'Create failed.',
    });
  }

  addItem() {
    if (!this.form.portfolioId || !this.form.symbol || !this.form.quantity || !this.form.purchasePrice) return;
    this.api.addPortfolioItem(this.form.portfolioId, this.form.symbol.trim().toUpperCase(), this.form.quantity, this.form.purchasePrice).subscribe({
      next: () => { this.form.symbol = ''; this.form.quantity = null; this.form.purchasePrice = null; this.refresh(); },
      error: (e) => this.error = e?.error?.detail ?? 'Add failed — check symbol.',
    });
  }
}
