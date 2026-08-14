import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { createChart, AreaSeries, ColorType, IChartApi, ISeriesApi } from 'lightweight-charts';
import { ApiService, FxRate } from '../api.service';
import { LangService } from '../lang.service';
import { ShareButton } from '../share-button';
import { EduCard } from '../edu-card';
import { EDU_CONTENT } from '../edu-content';

const DISCLAIMER = 'All data on this page is provided for information and education only and does not constitute investment advice.';

@Component({
  selector: 'app-fx',
  imports: [CommonModule, FormsModule, ShareButton, EduCard],
  template: `
    <h2>{{ t('CBN FX Rates', 'CBN FX Rate-Dem') }}</h2>
    <p class="sub">Official published exchange rates.</p>
    <p class="disclaimer">{{ t(disclaimer, 'All di data for dis page na for information and education only — e no be investment advice.') }}</p>

    <app-edu-card
      moduleLabel="FX"
      [questions]="edu['fx'].questions"
      [defaultExpanded]="edu['fx'].defaultExpanded"
    ></app-edu-card>

    <div style="position:relative;margin-bottom:14px;">
      <input type="search" placeholder="{{ t('Type to search FX pairs… e.g. USD/NGN', 'Type make e search FX pairs… e.g. USD/NGN') }}" [(ngModel)]="q" name="fxSearch" style="width:100%;" (input)="onQuery()" (keydown)="onKey($event)" autocomplete="off">
      <div class="sugg-dd" *ngIf="suggestions().length">
        <button type="button" class="sugg" *ngFor="let s of suggestions(); let i = index" [class.on]="i === activeIndex()" (mousedown)="pick(s)">
          <span class="s">{{ s.pair }}</span><span class="n">{{ s.rate }}</span><span class="t">{{ s.source }}</span>
        </button>
      </div>
    </div>

    <!-- Rate history chart -->
    <div class="card" style="margin-bottom: 20px;">
      <div class="form-row" style="margin-bottom: 10px;">
        <label style="font-size:12px;color:var(--txt2);font-weight:700;">{{ t('Pair:', 'Pair:') }}</label>
        <select [ngModel]="chartPair()" (ngModelChange)="setPair($event)" name="fxChartPair" style="flex:1;min-width:200px;">
          <option *ngFor="let p of chartPairs()" [ngValue]="p">{{ p }}</option>
        </select>
        <span *ngIf="fxPerf()" class="pill" [class.g]="fxPerf()!.pct >= 0" [class.r]="fxPerf()!.pct < 0">{{ fxPerf()!.pct >= 0 ? '▲' : '▼' }} {{ fxPerf()!.pct }}% ({{ fxPerf()!.label }})</span>
      </div>
      <div class="interval-row" style="margin-bottom: 10px; display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
        <span class="muted" style="font-size:12px;font-weight:700;">{{ t('Period:', 'Period:') }}</span>
        <button type="button" *ngFor="let p of periods" class="pill interval" [class.active]="p.days === period" (click)="setPeriod(p.days)" style="cursor:pointer;">{{ p.label }}</button>
        <span style="flex:1"></span>
        <app-share-btn [text]="'FX chart — ' + chartPair()" [link]="'/fx?pair=' + chartPair() + '&days=' + period"></app-share-btn>
      </div>
      <div #chartRef style="width: 100%; height: 260px;"></div>
      <div class="chart-empty" *ngIf="chartPts() < 2">{{ t('Chart builds as CBN rates are published — ' + chartPts() + ' point so far.', 'Chart dey build as CBN rates dey publish — ' + chartPts() + ' point so far.') }}</div>
      <p class="loading" *ngIf="rates().length === 0">Loading rates…</p>
    </div>

    <div class="stat-grid">
      <div class="stat-tile" *ngFor="let r of pagedRates()">
        <div class="label">{{ r.pair }}</div>
        <div class="value">{{ r.rate }}</div>
        <div class="delta muted">{{ r.date }} · {{ r.source }}</div>
        <div style="margin-top:8px"><app-share-btn [iconOnly]="true" [text]="shareText(r)" [link]="'/fx?pair=' + r.pair"></app-share-btn></div>
      </div>
    </div>
    <div class="pager" *ngIf="visibleRates().length > pageSize">
      <button type="button" (click)="page = page - 1" [disabled]="page === 0">← Prev</button>
      <span class="muted">Page {{ page + 1 }} / {{ pageCount() }} · {{ visibleRates().length }} pairs</span>
      <button type="button" (click)="page = page + 1" [disabled]="page >= pageCount() - 1">Next →</button>
    </div>
    <p class="loading" *ngIf="rates().length === 0">Loading rates…</p>
  `,
})
export class FxPage implements OnInit, AfterViewInit {
  edu = EDU_CONTENT;
  disclaimer = DISCLAIMER;
  rates = signal<FxRate[]>([]);
  q = '';
  page = 0;
  pageSize = 10;
  suggestions = signal<FxRate[]>([]);
  activeIndex = signal(-1);
  periods = [{ label: '1M', days: 30 }, { label: '3M', days: 90 }, { label: '6M', days: 180 }, { label: '1Y', days: 365 }];
  period = 90;
  chartPair = signal<string>('USD/NGN');
  fxPerf = signal<{ label: string; pct: number } | null>(null);
  @ViewChild('chartRef') chartRef!: ElementRef;
  private chart: IChartApi | null = null;
  private series: ISeriesApi<'Area'> | null = null;
  constructor(private api: ApiService, private lang: LangService, private route: ActivatedRoute) {}
  get isPidgin() { return this.lang.isPidgin; }
  t(en: string, pidgin: string): string { return this.lang.t(en, pidgin); }
  shareText(r: FxRate): string { return `${r.pair} — NGN ${r.rate} (CBN, ${r.date})`; }

  chartPairs(): string[] {
    const s = new Set<string>();
    for (const r of this.rates()) s.add(r.pair);
    return [...s].sort();
  }
  chartSeries(): FxRate[] {
    const pair = this.chartPair();
    const rows = this.rates().filter(r => r.pair === pair)
      .slice().sort((a, b) => a.date.localeCompare(b.date));
    const cutoff = new Date(Date.now() - this.period * 86400000).toISOString().slice(0, 10);
    const w = rows.filter(r => r.date >= cutoff);
    return w.length >= 2 ? w : rows;
  }
  chartPts(): number { return this.chartSeries().length; }
  setPair(p: string) { this.chartPair.set(p); this.render(); }
  setPeriod(days: number) { this.period = days; this.render(); }

  visibleRates(): FxRate[] {
    const s = this.q.trim().toLowerCase();
    // Latest row per pair for the tile grid
    const byPair = new Map<string, FxRate>();
    for (const r of this.rates()) {
      const cur = byPair.get(r.pair);
      if (!cur || r.date > cur.date) byPair.set(r.pair, r);
    }
    const latest = [...byPair.values()];
    if (!s) return latest;
    return latest.filter(r => (r.pair ?? '').toLowerCase().includes(s));
  }
  pagedRates(): FxRate[] {
    const v = this.visibleRates();
    const start = this.page * this.pageSize;
    return v.slice(start, start + this.pageSize);
  }
  pageCount(): number { return Math.max(1, Math.ceil(this.visibleRates().length / this.pageSize)); }
  onQuery() {
    this.page = 0;
    const s = this.q.trim().toLowerCase();
    const byPair = new Map<string, FxRate>();
    for (const r of this.rates()) {
      const cur = byPair.get(r.pair);
      if (!cur || r.date > cur.date) byPair.set(r.pair, r);
    }
    const latest = [...byPair.values()];
    const list = s ? latest.filter(r => (r.pair ?? '').toLowerCase().includes(s)).slice(0, 8) : [];
    this.suggestions.set(list);
    this.activeIndex.set(-1);
  }
  onKey(e: KeyboardEvent) {
    const n = this.suggestions().length;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!n) return;
      e.preventDefault();
      let idx = this.activeIndex() + (e.key === 'ArrowDown' ? 1 : -1);
      if (idx < 0) idx = n - 1;
      if (idx >= n) idx = 0;
      this.activeIndex.set(idx);
    } else if (e.key === 'Enter') {
      const list = this.suggestions();
      const idx = this.activeIndex();
      const target = idx >= 0 && list[idx] ? list[idx] : list[0];
      if (target) { e.preventDefault(); this.pick(target); }
    } else if (e.key === 'Escape') {
      this.suggestions.set([]);
    }
  }
  pick(r: FxRate) {
    this.q = '';
    this.suggestions.set([]);
    this.activeIndex.set(-1);
    this.page = 0;
    this.chartPair.set(r.pair);
    this.render();
  }
  ngOnInit() {
    this.route.queryParams.subscribe(p => {
      if (p['pair']) this.chartPair.set(String(p['pair']).toUpperCase());
      const days = p['days'] ? Number(p['days']) : NaN;
      if (days && !isNaN(days) && this.periods.some(x => x.days === days)) this.period = days;
    });
    this.api.fxRates(false).subscribe(r => {
      this.rates.set(r);
      this.render();
    });
  }
  ngAfterViewInit() { this.render(); }
  private render() {
    if (!this.chartRef?.nativeElement) return;
    if (!this.chart) {
      this.chart = createChart(this.chartRef.nativeElement, {
        layout: { attributionLogo: false, background: { type: ColorType.Solid, color: '#121a2e' }, textColor: '#93a4c8' },
        grid: { vertLines: { color: '#1a2440' }, horzLines: { color: '#1a2440' } },
        width: this.chartRef.nativeElement.clientWidth, height: 260,
        timeScale: { borderColor: '#223053' }, rightPriceScale: { borderColor: '#223053' },
      });
      this.series = this.chart.addSeries(AreaSeries, { lineColor: '#4e9bff', topColor: 'rgba(78,155,255,0.3)', bottomColor: 'rgba(78,155,255,0.02)', lineWidth: 2 });
    }
    const rows = this.chartSeries();
    if (rows.length >= 2 && this.series) {
      this.series.setData(rows.map(r => ({ time: r.date, value: Number(r.rate) })));
      this.chart?.timeScale().fitContent();
      const first = Number(rows[0].rate), last = Number(rows[rows.length - 1].rate);
      const days = Math.max(1, Math.round((new Date(rows[rows.length - 1].date).getTime() - new Date(rows[0].date).getTime()) / 86400000));
      const label = days >= 300 ? '1Y' : days >= 150 ? '6M' : days >= 45 ? '3M' : days >= 20 ? '1M' : `${days}D`;
      this.fxPerf.set({ label, pct: first ? Math.round((last / first - 1) * 10000) / 100 : 0 });
    } else {
      this.series?.setData([]);
      this.fxPerf.set(null);
    }
  }
}
