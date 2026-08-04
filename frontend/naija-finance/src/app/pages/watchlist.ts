import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../api.service';

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
        <input type="text" placeholder="Symbol (e.g. MTNN, DANGCEM)" [(ngModel)]="symbol" name="symbol" required>
        <button type="submit">Add / remove</button>
      </form>
    </div>

    <div class="table-wrap">
      <h3>My watchlist</h3>
      <table class="data">
        <thead><tr><th>Symbol</th><th>Name</th><th class="num">Last price</th><th></th></tr></thead>
        <tbody>
          <tr *ngFor="let i of instruments()">
            <td class="sym">{{ i.symbol }}</td><td>{{ i.name }}</td>
            <td class="num">{{ i.last_price }}</td>
            <td><button class="ghost" (click)="remove(i.symbol)">Remove</button></td>
          </tr>
        </tbody>
      </table>
      <p class="loading" *ngIf="!error && instruments().length === 0">{{ authed ? 'Watchlist empty — add a symbol above.' : 'Sign in to use your watchlist (Account page).' }}</p>
    </div>
  `,
})
export class WatchlistPage implements OnInit {
  disclaimer = DISCLAIMER;
  instruments = signal<any[]>([]);
  symbol = '';
  error = '';
  constructor(private api: ApiService) {}
  get authed() { return this.api.isAuthed; }

  ngOnInit() { this.refresh(); }

  refresh() {
    if (!this.api.isAuthed) return;
    this.api.defaultWatchlist().subscribe({
      next: (w) => this.instruments.set(w.instruments ?? []),
      error: (e) => this.error = 'Could not load watchlist — are you logged in?',
    });
  }

  toggle() {
    const sym = this.symbol.trim().toUpperCase();
    if (!sym) return;
    this.api.toggleWatchlist(sym).subscribe({
      next: (r) => { this.symbol = ''; this.error = ''; this.instruments.set(r.watchlist.instruments ?? []); },
      error: (e) => this.error = e?.error?.detail ?? 'Symbol not found.',
    });
  }

  remove(symbol: string) {
    this.api.toggleWatchlist(symbol).subscribe({
      next: (r) => this.instruments.set(r.watchlist.instruments ?? []),
      error: (e) => this.error = e?.error?.detail ?? 'Remove failed.',
    });
  }
}
