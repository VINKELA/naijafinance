import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../api.service';
import { track } from '../analytics';

const DISCLAIMER = 'All data on this page is provided for information and education only and does not constitute investment advice.';

@Component({
  selector: 'app-watchlist',
  imports: [CommonModule, FormsModule],
  template: `
    <h2>Watchlist (F-01)</h2>
    <p class="sub">Your saved instruments — toggle from the search box.</p>
    <p class="disclaimer">{{ disclaimer }}</p>
    <p class="error" *ngIf="error">{{ error }}</p>

    <div class="card" style="margin-bottom: 20px;">
      <form class="form-row" (ngSubmit)="toggle()">
        <input type="text" placeholder="Symbol — stock, bond, CP (e.g. MTNN, FGN-14.55-2029)" [(ngModel)]="symbol" name="symbol">
        <button type="submit" [disabled]="!symbol && !fundId">Add / remove</button>
      </form>
      <form class="form-row" style="margin-top:8px" (ngSubmit)="toggleFund()">
        <select [(ngModel)]="fundId" name="fundId" style="flex:1;min-width:200px;">
          <option [ngValue]="null" disabled>Add a mutual fund…</option>
          <option *ngFor="let f of funds()" [ngValue]="f.id">{{ f.name }} ({{ f.asset_class_display }})</option>
        </select>
        <button type="submit" [disabled]="!fundId">Add / remove fund</button>
      </form>
    </div>

    <div class="table-wrap">
      <h3>My watchlist</h3>
      <table class="data">
        <thead><tr><th>Symbol</th><th>Name</th><th>Class</th><th class="num">Last price</th><th></th></tr></thead>
        <tbody>
          <tr *ngFor="let i of instruments()">
            <td class="sym">{{ i.symbol }}</td><td>{{ i.name }}</td>
            <td><span class="pill">{{ i.asset_type }}</span></td>
            <td class="num">{{ i.last_price }}</td>
            <td><button class="ghost" (click)="remove(i.symbol)">Remove</button></td>
          </tr>
        </tbody>
      </table>
      <h3 style="margin-top:18px;">Watched funds</h3>
      <table class="data">
        <thead><tr><th>Fund</th><th>Class</th><th class="num">Latest NAV</th><th></th></tr></thead>
        <tbody>
          <tr *ngFor="let f of fundsWatched()">
            <td class="sym">{{ f.name }}</td>
            <td><span class="pill">{{ f.asset_class_display }}</span></td>
            <td class="num">{{ f.latest_nav?.nav ?? '—' }} <span class="muted">({{ f.latest_nav?.date ?? '' }})</span></td>
            <td><button class="ghost" (click)="removeFund(f.id)">Remove</button></td>
          </tr>
        </tbody>
      </table>
      <p class="loading" *ngIf="!error && instruments().length === 0 && fundsWatched().length === 0">{{ authed ? 'Watchlist empty — add a symbol or fund above.' : 'Sign in to use your watchlist (Account page).' }}</p>
    </div>
  `,
})
export class WatchlistPage implements OnInit {
  disclaimer = DISCLAIMER;
  instruments = signal<any[]>([]);
  fundsWatched = signal<any[]>([]);
  funds = signal<any[]>([]);
  symbol = '';
  fundId = null as number | null;
  error = '';
  constructor(private api: ApiService) {}
  get authed() { return this.api.isAuthed; }

  ngOnInit() { this.refresh(); }

  refresh() {
    if (!this.api.isAuthed) return;
    this.api.defaultWatchlist().subscribe({
      next: (w) => { this.instruments.set(w.instruments ?? []); this.fundsWatched.set(w.funds ?? []); },
      error: (e) => this.error = 'Could not load watchlist — are you logged in?',
    });
    this.api.funds().subscribe(fs => this.funds.set(fs));
  }

  toggle() {
    const sym = this.symbol.trim().toUpperCase();
    if (!sym) return;
    this.api.toggleWatchlist(sym).subscribe({
      next: (r) => { track('watchlist_add', { symbol: sym, added: r.added }); this.symbol = ''; this.error = ''; this.setFrom(r); },
      error: (e) => this.error = e?.error?.detail ?? 'Symbol not found.',
    });
  }

  toggleFund() {
    if (!this.fundId) return;
    this.api.toggleWatchlist('', this.fundId).subscribe({
      next: (r) => { track('watchlist_add', { fund_id: this.fundId, added: r.added }); this.fundId = null; this.error = ''; this.setFrom(r); },
      error: (e) => this.error = e?.error?.detail ?? 'Fund toggle failed.',
    });
  }

  private setFrom(r: any) {
    this.instruments.set(r.watchlist.instruments ?? []);
    this.fundsWatched.set(r.watchlist.funds ?? []);
  }

  remove(symbol: string) {
    this.api.toggleWatchlist(symbol).subscribe({
      next: (r) => this.setFrom(r),
      error: (e) => this.error = e?.error?.detail ?? 'Remove failed.',
    });
  }

  removeFund(fundId: number) {
    this.api.toggleWatchlist('', fundId).subscribe({
      next: (r) => this.setFrom(r),
      error: (e) => this.error = e?.error?.detail ?? 'Remove failed.',
    });
  }
}
