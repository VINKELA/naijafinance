import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ShareButton } from '../share-button';
import { ChartImgShareButton } from '../chart-share-img';
import { createChart, AreaSeries, ColorType, IChartApi, ISeriesApi } from 'lightweight-charts';
import { ApiService } from '../api.service';
import { track } from '../analytics';

const DISCLAIMER = 'All data on this page is provided for information and education only and does not constitute investment advice.';

@Component({
  selector: 'app-watchlist',
  imports: [ChartImgShareButton, CommonModule, FormsModule, RouterLink, ShareButton],
  template: `
    <h2>Watchlist</h2>
    <p class="sub">Your saved instruments — toggle from the search box.</p>
    <p class="disclaimer">{{ disclaimer }}</p>
    <p class="error" *ngIf="error">{{ error }}</p>

    <div class="card" style="margin-bottom: 20px;" *ngIf="authed">
      <div class="form-row" style="margin-bottom: 10px;">
        <span class="pill" *ngFor="let p of periods" [class.g]="period === p.days" style="cursor:pointer;" (click)="loadHistory(p.days)">{{ p.label }}</span>
        <span style="flex:1"></span>
        <app-share-btn [text]="'Watchlist price chart'" [link]="'/watchlist'"></app-share-btn>
        <app-chart-img-share [chart]="chart" [title]="'Watchlist price chart'" [link]="'/watchlist'"></app-chart-img-share>
      </div>
      <div #chartRef style="width: 100%; height: 220px;"></div>
      <p class="loading" *ngIf="!authed">Sign in to see performance.</p>
    </div>

    <div class="card" style="margin-bottom: 20px;">
      <form class="form-row" (ngSubmit)="toggle()">
        <input type="text" placeholder="Symbol — stock, bond or commercial paper (e.g. MTNN, FGN-14.55-2029)" [(ngModel)]="symbol" name="symbol">
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
            <td class="sym"><a routerLink="/asset" [queryParams]="{type:'instrument', symbol: i.symbol}">{{ i.symbol }}</a></td><td>{{ i.name }}</td>
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
            <td class="sym"><a routerLink="/asset" [queryParams]="{type:'fund', id: f.id}">{{ f.name }}</a></td>
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
export class WatchlistPage implements OnInit, AfterViewInit {
  disclaimer = DISCLAIMER;
  instruments = signal<any[]>([]);
  fundsWatched = signal<any[]>([]);
  funds = signal<any[]>([]);
  symbol = '';
  fundId = null as number | null;
  error = '';
  periods = [{ label: '1W', days: 7 }, { label: '1M', days: 30 }, { label: '3M', days: 90 }, { label: '1Y', days: 365 }];
  period = 90;
  @ViewChild('chartRef') chartRef!: ElementRef;
  chart: IChartApi | null = null;
  private series: ISeriesApi<'Area'> | null = null;

  constructor(private api: ApiService) {}
  get authed() { return this.api.isAuthed; }

  ngOnInit() { this.refresh(); }
  ngAfterViewInit() { if (this.authed) this.loadHistory(this.period); }

  loadHistory(days: number) {
    this.period = days;
    this.api.watchlistHistory(days).subscribe({
      next: (h) => this.render(h.points ?? []),
      error: () => this.render([]),
    });
  }

  private render(pts: any[]) {
    if (!this.chartRef?.nativeElement) return;
    if (!this.chart) {
      this.chart = createChart(this.chartRef.nativeElement, {
        layout: { attributionLogo: false, background: { type: ColorType.Solid, color: '#121a2e' }, textColor: '#93a4c8' },
        grid: { vertLines: { color: '#1a2440' }, horzLines: { color: '#1a2440' } },
        autoSize: true,
        height: 220,
        timeScale: { borderColor: '#223053' }, rightPriceScale: { borderColor: '#223053' },
      });
      this.series = this.chart.addSeries(AreaSeries, { lineColor: '#4e9bff', topColor: 'rgba(78,155,255,0.3)', bottomColor: 'rgba(78,155,255,0.02)', lineWidth: 2 });
    }
    this.series?.setData(pts.map(p => ({ time: p.date, value: Number(p.value) })));
    this.chart?.timeScale().fitContent();
  }

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
