import { Component, OnInit, signal, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { createChart, AreaSeries, ColorType, IChartApi, ISeriesApi } from 'lightweight-charts';
import { ApiService } from '../api.service';
import { track } from '../analytics';

const DISCLAIMER = 'All data on this page is provided for information and education only and does not constitute investment advice.';
const PERF_NOTE = 'Past performance ≠ future returns. Shown for information only.';

@Component({
  selector: 'app-portfolio',
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <h2>Portfolio</h2>
    <p class="sub">Manual positions, P&L and allocation.</p>
    <p class="disclaimer">{{ disclaimer }}</p>
    <p class="error" *ngIf="error">{{ error }}</p>

    <div class="form-row" style="margin-bottom: 12px;" *ngIf="portfolios().length">
      <button type="button" (click)="shareMix()">📤 Share my Asset Mix</button>
      <span class="muted" style="font-size:11.5px;">Generates your allocation snapshot for WhatsApp/Telegram — the acquisition loop.</span>
    </div>

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

    <div class="card" style="margin-bottom: 20px;" *ngIf="portfolios().length">
      <div class="form-row" style="margin-bottom: 10px;">
        <span class="pill" *ngFor="let p of periods" [class.g]="period === p.days" style="cursor:pointer;" (click)="loadPerformance(p.days)">{{ p.label }}</span>
        <span class="muted" style="font-size:11.5px;">Portfolio value over time</span>
      </div>
      <div #perfChartRef style="width: 100%; height: 260px;"></div>
      <p class="disclaimer" style="margin:8px 0 0;">{{ perfNote }}</p>
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
        <select [(ngModel)]="form.kind" name="kind">
          <option value="instrument">Stock / Bond / CP</option>
          <option value="fund">Mutual fund</option>
        </select>
        <input *ngIf="form.kind === 'instrument'" type="text" placeholder="Symbol (e.g. MTNN)" [(ngModel)]="form.symbol" name="symbol" required>
        <select *ngIf="form.kind === 'fund'" [(ngModel)]="form.fundId" name="fundId" required style="flex:1;min-width:200px;">
          <option [ngValue]="null" disabled>Select fund…</option>
          <option *ngFor="let f of funds()" [ngValue]="f.id">{{ f.name }} ({{ f.asset_class_display }})</option>
        </select>
        <input type="number" step="any" placeholder="Units" [(ngModel)]="form.quantity" name="quantity" required>
        <input type="number" step="any" placeholder="Purchase price" [(ngModel)]="form.purchasePrice" name="purchasePrice" required>
        <button type="submit">Add position</button>
      </form>
    </div>

    <div class="table-wrap" *ngFor="let p of portfolios()">
      <h3>{{ p.name }} — ₦{{ total(p) }} <button type="button" class="ghost" style="margin-left:8px" (click)="removePortfolio(p)">Delete</button></h3>
      <table class="data">
        <thead><tr><th>Symbol</th><th>Name</th><th>Class</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Value</th><th class="num">G/L</th><th></th></tr></thead>
        <tbody>
          <tr *ngFor="let it of p.items">
            <td class="sym"><a routerLink="/asset" [queryParams]="assetQp(it)">{{ it.symbol }}</a></td><td>{{ it.name }}</td>
            <td><span class="pill">{{ it.asset_class }}</span></td>
            <td class="num">{{ it.quantity }}</td>
            <td class="num">{{ it.current_price }}</td>
            <td class="num">{{ it.current_value }}</td>
            <td class="num" [class.up]="it.gain_loss >= 0" [class.down]="it.gain_loss < 0">{{ it.gain_loss }} ({{ it.gain_loss_pct }}%)</td>
            <td><button type="button" class="ghost" (click)="removeItem(it)">Remove</button></td>
          </tr>
        </tbody>
      </table>
      <p class="loading" *ngIf="p.items.length === 0">No positions yet.</p>
    </div>
  `,
})
export class PortfolioPage implements OnInit, AfterViewInit {
  disclaimer = DISCLAIMER;
  perfNote = PERF_NOTE;
  periods = [{ label: '1M', days: 30 }, { label: '3M', days: 90 }, { label: '6M', days: 180 }, { label: '1Y', days: 365 }];
  period = 90;
  portfolios = signal<any[]>([]);
  funds = signal<any[]>([]);
  insights = signal<any>(null);
  newName = '';
  error = '';
  form = { portfolioId: null as number | null, kind: 'instrument' as 'instrument' | 'fund', symbol: '', fundId: null as number | null, quantity: null as number | null, purchasePrice: null as number | null };
  @ViewChild('perfChartRef') perfChartRef!: ElementRef;
  private chart: IChartApi | null = null;
  private series: ISeriesApi<'Area'> | null = null;

  constructor(private api: ApiService) {}

  ngOnInit() { this.refresh(); }
  ngAfterViewInit() { if (this.api.isAuthed) this.loadPerformance(this.period); }

  loadPerformance(days: number) {
    this.period = days;
    const ps = this.portfolios();
    if (!ps.length) return;
    this.api.portfolioPerformance(ps[0].id, days).subscribe({
      next: (r) => this.renderPerf(r.points ?? []),
      error: () => this.renderPerf([]),
    });
  }

  private renderPerf(pts: any[]) {
    if (!this.perfChartRef?.nativeElement) return;
    if (!this.chart) {
      this.chart = createChart(this.perfChartRef.nativeElement, {
        layout: { background: { type: ColorType.Solid, color: '#121a2e' }, textColor: '#93a4c8' },
        grid: { vertLines: { color: '#1a2440' }, horzLines: { color: '#1a2440' } },
        width: this.perfChartRef.nativeElement.clientWidth, height: 260,
        timeScale: { borderColor: '#223053' }, rightPriceScale: { borderColor: '#223053' },
      });
      this.series = this.chart.addSeries(AreaSeries, { lineColor: '#4e9bff', topColor: 'rgba(78,155,255,0.3)', bottomColor: 'rgba(78,155,255,0.02)', lineWidth: 2 });
    }
    this.series?.setData(pts.map(p => ({ time: p.date, value: Number(p.value) })));
    this.chart?.timeScale().fitContent();
  }

  refresh() {
    if (!this.api.isAuthed) { this.error = 'Sign in to use portfolios (Account page).'; return; }
    this.api.portfolios().subscribe({
      next: (p) => { this.portfolios.set(p); this.error = ''; if (p.length && this.form.portfolioId === null) this.form.portfolioId = p[0].id; if (p.length && !this.chart) this.loadPerformance(this.period); },
      error: () => this.error = 'Could not load portfolios — are you logged in?',
    });
    this.api.portfolioInsights().subscribe({
      next: (i) => this.insights.set(i),
      error: () => {},
    });
    this.api.funds().subscribe(fs => this.funds.set(fs));
  }

  assetQp(it: any): any {
    return (it.asset_class ?? '').startsWith('Fund') ? { type: 'fund', id: it.fund } : { type: 'instrument', symbol: it.symbol };
  }

  total(p: any): string {
    const n = Number(p.total_value ?? 0);
    return n >= 1e9 ? `${(n / 1e9).toFixed(2)}bn` : n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }

  removeItem(it: any) {
    this.api.removePortfolioItem(it.id).subscribe({ next: () => this.refresh(), error: (e) => this.error = e?.error?.detail ?? 'Remove failed.' });
  }

  removePortfolio(p: any) {
    this.api.deletePortfolio(p.id).subscribe({ next: () => this.refresh(), error: (e) => this.error = e?.error?.detail ?? 'Delete failed.' });
  }

  shareMix() {
    const ps = this.portfolios();
    if (!ps.length) return;
    const items = ps.flatMap((p: any) => p.items ?? []);
    if (!items.length) { this.error = 'Add a position before sharing your mix.'; return; }
    // Cost-basis fallback: a holding with no live price (fund without published NAV,
    // un-priced bond) is valued at cost so allocation never shows a bogus "0%" bucket.
    const valOf = (it: any) => {
      const live = Number(it.current_value ?? 0);
      return live > 0 ? live : Number(it.purchase_price ?? 0) * Number(it.quantity ?? 0);
    };
    const total = items.reduce((sum: number, it: any) => sum + valOf(it), 0);
    const byClass = new Map<string, number>();
    for (const it of items) {
      const cls = (it.asset_class ?? 'Other').split('·')[0].trim();
      byClass.set(cls, (byClass.get(cls) ?? 0) + valOf(it));
    }
    const alloc = [...byClass.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([c, v]) => `${c} ${total ? Math.round((v / total) * 100) : 0}%`)
      .join(' · ');
    const fmt = (n: number) => n >= 1e9 ? `${(n / 1e9).toFixed(2)}bn` : n.toLocaleString(undefined, { maximumFractionDigits: 0 });
    const base = `${location.origin}/asset-mix`;
    const buildYours = `${location.origin}/market`;
    track('share_click', { url: '/asset-mix', mix: true });
    // REQ-11: create a public Asset Mix card (chart in the card is the viral hook), open it, copy its link.
    this.api.createMixShare(ps[0].id).subscribe({
      next: (share) => {
        const cardUrl = `${base}?token=${share.token}`;
        const text = `My Asset Mix — ${items.length} holdings · ₦${fmt(total)}\n${alloc}\nBuild yours → ${buildYours}`;
        try {
          navigator.share({ title: 'My Asset Mix', text, url: cardUrl }).catch(() => {});
        } catch { /* fall through */ }
        try {
          navigator.clipboard.writeText(`${text}\n${cardUrl}`).then(() => { this.error = 'Asset Mix card created — link copied.'; });
        } catch { /* ignore */ }
        window.open(cardUrl, '_blank');
      },
      error: () => {
        const text = `My Asset Mix — ${items.length} holdings · ₦${fmt(total)}\n${alloc}\nBuild yours → ${buildYours}`;
        const url = buildYours;
        try {
          if (navigator.share) { navigator.share({ title: 'My Asset Mix', text, url }).catch(() => {}); return; }
        } catch { /* fall through */ }
        try {
          navigator.clipboard.writeText(`${text}\n${url}`).then(() => { this.error = 'Mix copied to clipboard — paste into WhatsApp.'; });
        } catch {
          window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, '_blank');
        }
      },
    });
  }

  createPortfolio() {
    this.api.createPortfolio(this.newName.trim()).subscribe({
      next: () => { this.newName = ''; this.refresh(); },
      error: (e) => this.error = e?.error?.detail ?? 'Create failed.',
    });
  }

  addItem() {
    if (!this.form.portfolioId || !this.form.quantity || !this.form.purchasePrice) return;
    if (this.form.kind === 'fund') {
      if (!this.form.fundId) return;
      this.api.addPortfolioItem(this.form.portfolioId, '', this.form.quantity, this.form.purchasePrice, this.form.fundId).subscribe({
        next: () => { this.form.fundId = null; this.form.quantity = null; this.form.purchasePrice = null; this.refresh(); },
        error: (e) => this.error = e?.error?.detail ?? 'Add failed — check fund.',
      });
      return;
    }
    if (!this.form.symbol) return;
    this.api.addPortfolioItem(this.form.portfolioId, this.form.symbol.trim().toUpperCase(), this.form.quantity, this.form.purchasePrice).subscribe({
      next: () => { this.form.symbol = ''; this.form.quantity = null; this.form.purchasePrice = null; this.refresh(); },
      error: (e) => this.error = e?.error?.detail ?? 'Add failed — check symbol.',
    });
  }
}
