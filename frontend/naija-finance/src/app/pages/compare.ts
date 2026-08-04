import { Component, OnInit, AfterViewInit, OnDestroy, ViewChild, ElementRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { createChart, LineSeries, ColorType, IChartApi, ISeriesApi } from 'lightweight-charts';
import { ApiService } from '../api.service';
import { fmtPct } from '../format';

const DISCLAIMER = 'All data on this page is provided for information and education only and does not constitute investment advice.';
const PALETTE = ['#16c784', '#4e9bff', '#f0b90b', '#ea3943', '#a78bfa', '#f97316', '#22d3ee', '#e879f9', '#84cc16', '#fb7185'];

@Component({
  selector: 'app-compare',
  imports: [CommonModule, FormsModule],
  template: `
    <h2>Compare Assets</h2>
    <p class="sub">Normalized % performance of stocks, bonds, funds — and, when signed in, your own Asset Mixes and Portfolios.</p>
    <p class="disclaimer">{{ disclaimer }}</p>
    <p class="error" *ngIf="error">{{ error }}</p>

    <div class="card" style="margin-bottom: 20px;">
      <form class="form-row" (ngSubmit)="addSymbols()">
        <div style="position:relative;flex:1;min-width:220px;">
          <input type="text" placeholder="Search symbols, bonds, funds… e.g. MTNN, DANGCEM" [(ngModel)]="symbolInput" name="symbols"
            (input)="onSymbolInput()" (focus)="onSymbolFocus()" (blur)="onSymbolBlur()" (keydown)="onSymbolKey($event)">
          <div class="sugg-dd" *ngIf="showSuggestions()">
            <button type="button" class="sugg" *ngFor="let s of suggestions(); let i = index" [class.on]="i === activeIndex()" (mousedown)="pickSuggestion(s)">
              <span class="s">{{ s.symbol }}</span><span class="n">{{ s.name }}</span><span class="t">{{ s.type }}</span>
            </button>
            <div class="sugg" *ngIf="!suggestions().length" style="color:var(--txt3);cursor:default;">No matches</div>
          </div>
        </div>
        <button type="submit">Add</button>
      </form>
      <form class="form-row" style="margin-top:8px" (ngSubmit)="addFund()">
        <select [(ngModel)]="fundId" name="fundId" style="flex:1;min-width:220px;">
          <option [ngValue]="null" disabled>Add a fund…</option>
          <option *ngFor="let f of funds()" [ngValue]="f.id">{{ f.name }} ({{ f.asset_class_display }})</option>
        </select>
        <button type="submit" [disabled]="!fundId">Add fund</button>
      </form>
      <form class="form-row" style="margin-top:8px" (ngSubmit)="addMix()" *ngIf="authed">
        <select [(ngModel)]="mixToken" name="mixToken" style="flex:1;min-width:220px;">
          <option [ngValue]="null" disabled>My Asset Mixes…</option>
          <option *ngFor="let m of myMixes()" [ngValue]="m.token">{{ m.name }} ({{ m.visibility === 'public' ? '🌍' : '🔒' }})</option>
        </select>
        <button type="submit" [disabled]="!mixToken">Add mix</button>
      </form>
      <form class="form-row" style="margin-top:8px" (ngSubmit)="addPortfolio()" *ngIf="authed">
        <select [(ngModel)]="pfId" name="pfId" style="flex:1;min-width:220px;">
          <option [ngValue]="null" disabled>My Portfolios…</option>
          <option *ngFor="let p of myPortfolios()" [ngValue]="p.id">{{ p.name }}</option>
        </select>
        <button type="submit" [disabled]="!pfId">Add portfolio</button>
      </form>
      <div class="form-row" style="margin-top:10px;flex-wrap:wrap;" *ngIf="chips().length">
        <span class="pill" *ngFor="let c of chips(); let i = index" style="cursor:pointer;" (click)="removeChip(i)">{{ c.label }} ✕</span>
      </div>
      <div class="form-row" style="margin-top:12px;">
        <span class="pill" *ngFor="let p of periods" [class.g]="period === p.days" style="cursor:pointer;" (click)="load(p.days)">{{ p.label }}</span>
      </div>
    </div>

    <div class="card" style="margin-bottom: 20px;">
      <div #chartRef style="width: 100%; height: 340px;"></div>
      <p class="loading" *ngIf="!rows().length && !error">Add symbols or funds above to compare.</p>
    </div>

    <div class="table-wrap" *ngIf="rows().length">
      <h3>Performance over {{ periodLabel() }}</h3>
      <table class="data">
        <thead><tr><th>Asset</th><th>Class</th><th class="num">Change</th></tr></thead>
        <tbody>
          <tr *ngFor="let r of rows()">
            <td class="sym">{{ r.symbol }}</td><td>{{ r.asset_type }}</td>
            <td class="num" [class.up]="r.change_pct >= 0" [class.down]="r.change_pct < 0">{{ r.change_pct >= 0 ? '▲' : '▼' }} {{ fmtPct(r.change_pct) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `,
})
export class ComparePage implements OnInit, AfterViewInit, OnDestroy {
  disclaimer = DISCLAIMER;
  periods = [{ label: '1W', days: 7 }, { label: '1M', days: 30 }, { label: '3M', days: 90 }, { label: '6M', days: 180 }, { label: '1Y', days: 365 }];
  period = 90;
  symbolInput = '';
  suggestions = signal<any[]>([]);
  showSuggestions = signal(false);
  activeIndex = signal(-1);
  private searchTimer: any;
  fundId = null as number | null;
  mixToken = null as string | null;
  pfId = null as number | null;
  symbols = signal<string[]>([]);
  fundIds = signal<number[]>([]);
  mixTokens = signal<string[]>([]);
  pfIds = signal<number[]>([]);
  funds = signal<any[]>([]);
  myMixes = signal<any[]>([]);
  myPortfolios = signal<any[]>([]);
  rows = signal<any[]>([]);
  error = '';
  get authed() { return this.api.isAuthed; }
  @ViewChild('chartRef') chartRef!: ElementRef;
  private chart: IChartApi | null = null;
  private series: ISeriesApi<'Line'>[] = [];

  fmtPct = fmtPct;
  constructor(private api: ApiService) {}

  ngOnDestroy() { clearTimeout(this.searchTimer); }
  chips() {
    return [
      ...this.symbols().map(s => ({ label: s })),
      ...this.fundIds().map(id => {
        const f = this.funds().find(x => x.id === id);
        return { label: f ? f.name : `fund#${id}` };
      }),
      ...this.mixTokens().map(t => {
        const m = this.myMixes().find(x => x.token === t);
        return { label: m ? `Mix: ${m.name}` : `mix#${t.slice(0, 8)}` };
      }),
      ...this.pfIds().map(id => {
        const p = this.myPortfolios().find(x => x.id === id);
        return { label: p ? `Portfolio: ${p.name}` : `portfolio#${id}` };
      }),
    ];
  }
  periodLabel(): string { return this.periods.find(p => p.days === this.period)?.label ?? ''; }
  ngOnInit() {
    this.api.funds().subscribe(fs => this.funds.set(fs));
    if (this.api.isAuthed) {
      this.api.myMixes().subscribe(m => this.myMixes.set(m ?? []));
      this.api.portfolios().subscribe(p => this.myPortfolios.set(p ?? []));
    }
  }
  ngAfterViewInit() {}

  onSymbolInput() {
    clearTimeout(this.searchTimer);
    const q = this.symbolInput.trim();
    if (!q) { this.suggestions.set([]); this.showSuggestions.set(false); return; }
    this.searchTimer = setTimeout(() => {
      this.api.searchStocks(q).subscribe({
        next: (res) => {
          this.suggestions.set((res ?? []).slice(0, 8));
          this.activeIndex.set(-1);
          this.showSuggestions.set(this.suggestions().length > 0);
        },
        error: () => { this.suggestions.set([]); this.showSuggestions.set(false); },
      });
    }, 250);
  }
  onSymbolFocus() {
    if (this.symbolInput.trim() && this.suggestions().length) this.showSuggestions.set(true);
  }
  onSymbolBlur() {
    setTimeout(() => this.showSuggestions.set(false), 150);
  }
  onSymbolKey(e: KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const n = this.suggestions().length;
      if (!n) return;
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      let idx = this.activeIndex() + delta;
      if (idx < 0) idx = n - 1;
      if (idx >= n) idx = 0;
      this.activeIndex.set(idx);
      this.showSuggestions.set(true);
    } else if (e.key === 'Escape') {
      this.showSuggestions.set(false);
    } else if (e.key === 'Enter') {
      const list = this.suggestions();
      const idx = this.activeIndex();
      const target = idx >= 0 && list[idx] ? list[idx] : null;
      if (target) { e.preventDefault(); this.pickSuggestion(target); }
    }
  }
  pickSuggestion(s: any) {
    if (!s?.symbol) return;
    this.symbols.set([...new Set([...this.symbols(), s.symbol])]);
    this.symbolInput = '';
    this.suggestions.set([]);
    this.showSuggestions.set(false);
    this.load(this.period);
  }

  addSymbols() {
    const parts = this.symbolInput.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    if (!parts.length) return;
    this.symbols.set([...new Set([...this.symbols(), ...parts])]);
    this.symbolInput = '';
    this.load(this.period);
  }
  addFund() {
    if (!this.fundId) return;
    this.fundIds.set([...new Set([...this.fundIds(), this.fundId as number])]);
    this.fundId = null;
    this.load(this.period);
  }
  addMix() {
    if (!this.mixToken) return;
    this.mixTokens.set([...new Set([...this.mixTokens(), this.mixToken as string])]);
    this.mixToken = null;
    this.load(this.period);
  }
  addPortfolio() {
    if (!this.pfId) return;
    this.pfIds.set([...new Set([...this.pfIds(), this.pfId as number])]);
    this.pfId = null;
    this.load(this.period);
  }
  removeChip(i: number) {
    const syms = [...this.symbols()], fids = [...this.fundIds()], mts = [...this.mixTokens()], pfs = [...this.pfIds()];
    if (i < syms.length) syms.splice(i, 1);
    else if (i < syms.length + fids.length) fids.splice(i - syms.length, 1);
    else if (i < syms.length + fids.length + mts.length) mts.splice(i - syms.length - fids.length, 1);
    else pfs.splice(i - syms.length - fids.length - mts.length, 1);
    this.symbols.set(syms); this.fundIds.set(fids); this.mixTokens.set(mts); this.pfIds.set(pfs);
    this.load(this.period);
  }
  load(days: number) {
    this.period = days;
    this.error = '';
    this.api.compare(this.symbols(), this.fundIds(), days, this.mixTokens(), this.pfIds()).subscribe({
      next: (r) => { this.rows.set(r.series ?? []); this.render(r.series ?? []); },
      error: () => { this.rows.set([]); this.render([]); this.error = 'Compare failed.'; },
    });
  }
  private render(rows: any[]) {
    if (!this.chartRef?.nativeElement) return;
    if (!this.chart) {
      this.chart = createChart(this.chartRef.nativeElement, {
        layout: { attributionLogo: false, background: { type: ColorType.Solid, color: '#121a2e' }, textColor: '#93a4c8' },
        grid: { vertLines: { color: '#1a2440' }, horzLines: { color: '#1a2440' } },
        width: this.chartRef.nativeElement.clientWidth, height: 340,
        timeScale: { borderColor: '#223053' }, rightPriceScale: { borderColor: '#223053' },
      });
    }
    while (this.series.length) { this.chart.removeSeries(this.series.pop()!); }
    rows.forEach((r, i) => {
      const line = this.chart!.addSeries(LineSeries, { color: PALETTE[i % PALETTE.length], lineWidth: 2 });
      line.setData(r.points.map((p: any) => ({ time: p.date, value: Number(p.value) })));
      this.series.push(line);
    });
    this.chart?.timeScale().fitContent();
  }
}
