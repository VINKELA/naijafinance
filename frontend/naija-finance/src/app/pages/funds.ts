import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { createChart, AreaSeries, ColorType, IChartApi, ISeriesApi } from 'lightweight-charts';
import { ApiService, Fund } from '../api.service';
import { LangService } from '../lang.service';
import { ShareButton } from '../share-button';
import { EduCard } from '../edu-card';
import { EDU_CONTENT } from '../edu-content';

const DISCLAIMER = 'All data on this page is provided for information and education only and does not constitute investment advice.';

@Component({
  selector: 'app-funds',
  imports: [CommonModule, FormsModule, RouterLink, ShareButton, EduCard],
  template: `
    <h2>{{ t('Mutual Funds &amp; Public NAVs', 'Fands &amp; Public NAV-Dem') }}</h2>
    <p class="sub">Fund list with published NAV snapshots and historical performance.</p>
    <p class="disclaimer">{{ t(disclaimer, 'All di data for dis page na for information and education only — e no be investment advice.') }}</p>

    <app-edu-card
      moduleLabel="Mutual Funds"
      [questions]="edu['funds'].questions"
      [defaultExpanded]="edu['funds'].defaultExpanded"
    ></app-edu-card>

    <div class="card" style="margin-bottom: 20px;">
      <div class="form-row" style="margin-bottom: 10px; position:relative;">
        <input type="search" placeholder="{{ t('Type to search funds by name or manager…', 'Type make e search fands by name or manager…') }}" [(ngModel)]="q" name="fundSearch" style="flex:1;min-width:220px;" (input)="onQuery()" (keydown)="onKey($event)" autocomplete="off">
        <div class="sugg-dd" *ngIf="suggestions().length">
          <button type="button" class="sugg" *ngFor="let s of suggestions(); let i = index" [class.on]="i === activeIndex()" (mousedown)="pick(s)">
            <span class="s">{{ s.name }}</span><span class="n">{{ s.manager }}</span><span class="t">{{ s.asset_class_display }}</span>
          </button>
        </div>
      </div>
      <div class="form-row" style="margin-bottom: 10px;">
        <label style="font-size:12px;color:var(--txt2);font-weight:700;">Fund:</label>
        <select [ngModel]="selectedId()" (ngModelChange)="select($event)" name="fundSelect" style="flex:1;min-width:220px;">
          <option *ngFor="let f of funds()" [ngValue]="f.id">{{ f.name }} ({{ f.asset_class_display }})</option>
        </select>
        <span *ngIf="perf()" class="pill" [class.g]="perf()!.pct >= 0" [class.r]="perf()!.pct < 0">{{ perf()!.pct >= 0 ? '▲' : '▼' }} {{ perf()!.pct }}% ({{ perf()!.label }})</span>
      </div>
      <div class="interval-row" style="margin-bottom: 10px; display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
        <span class="muted" style="font-size:12px;font-weight:700;">{{ t('Period:', 'Period:') }}</span>
        <button type="button" *ngFor="let p of periods" class="pill interval" [class.active]="p.days === period" (click)="setPeriod(p.days)" style="cursor:pointer;">{{ p.label }}</button>
        <span style="flex:1"></span>
        <app-share-btn [text]="'Fund NAV chart — ' + (selected()?.name ?? '')" [link]="'/funds?fund=' + (selected()?.id ?? '') + '&days=' + period"></app-share-btn>
      </div>
      <div #chartRef style="width: 100%; height: 260px;"></div>
      <div class="chart-empty" *ngIf="selected() && histPoints() < 2">{{ t('Chart builds as weekly NAVs are published — only ' + histPoints() + ' point so far (latest ' + (selected()!.latest_nav?.date ?? '—') + ').', 'Chart dey build as NAVs dey publish evri wik — only ' + histPoints() + ' point so far (latest ' + (selected()!.latest_nav?.date ?? '—') + ').') }}</div>
      <p class="loading" *ngIf="!selected()">Loading funds…</p>
    </div>

    <div class="table-wrap">
      <h3>Funds &amp; latest NAV</h3>
      <table class="data">
        <thead><tr><th>Fund</th><th>Manager</th><th>Class</th><th class="num">Latest NAV</th><th class="num">NAV date</th><th></th></tr></thead>
        <tbody>
          <tr *ngFor="let f of pagedFunds()">
            <td class="sym"><a routerLink="/asset" [queryParams]="{type:'fund', id: f.id}">{{ f.name }}</a></td><td class="muted">{{ f.manager ?? '—' }}</td>
            <td>{{ f.asset_class_display }}</td>
            <td class="num">{{ f.latest_nav?.nav ?? '—' }}</td>
            <td class="num muted">{{ f.latest_nav?.date ?? '—' }}</td>
            <td><app-share-btn [text]="shareText(f)" [link]="'/funds?fund=' + f.id"></app-share-btn></td>
          </tr>
        </tbody>
      </table>
      <div class="pager" *ngIf="visibleFunds().length > pageSize">
        <button type="button" (click)="page = page - 1" [disabled]="page === 0">← Prev</button>
        <span class="muted">Page {{ page + 1 }} / {{ pageCount() }} · {{ visibleFunds().length }} funds</span>
        <button type="button" (click)="page = page + 1" [disabled]="page >= pageCount() - 1">Next →</button>
      </div>
      <p class="loading" *ngIf="funds().length === 0">Loading funds…</p>
    </div>
  `,
})
export class FundsPage implements OnInit, AfterViewInit {
  edu = EDU_CONTENT;
  disclaimer = DISCLAIMER;
  periods = [{ label: '1M', days: 30 }, { label: '3M', days: 90 }, { label: '6M', days: 180 }, { label: '1Y', days: 365 }];
  period = 365;
  funds = signal<Fund[]>([]);
  q = '';
  page = 0;
  pageSize = 10;
  suggestions = signal<Fund[]>([]);
  activeIndex = signal(-1);
  selectedId = signal<number | null>(null);
  perf = signal<{ label: string; pct: number } | null>(null);
  @ViewChild('chartRef') chartRef!: ElementRef;
  private chart: IChartApi | null = null;
  private series: ISeriesApi<'Area'> | null = null;

  constructor(private api: ApiService, private lang: LangService, private route: ActivatedRoute) {}
  get isPidgin() { return this.lang.isPidgin; }
  t(en: string, pidgin: string): string { return this.lang.t(en, pidgin); }
  selected(): Fund | null { return this.funds().find(f => f.id === this.selectedId()) ?? this.funds()[0] ?? null; }
  histPoints(): number { return this.selected()?.nav_history?.length ?? 0; }
  setPeriod(days: number) { this.period = days; this.render(); }
  private windowed(pts: any[]): any[] {
    if (!pts.length) return [];
    const cutoff = new Date(Date.now() - this.period * 86400000).toISOString().slice(0, 10);
    const w = pts.filter(p => p.date >= cutoff);
    return w.length >= 2 ? w : pts;
  }
  visibleFunds(): Fund[] {
    const s = this.q.trim().toLowerCase();
    if (!s) return this.funds();
    return this.funds().filter(f => (f.name ?? '').toLowerCase().includes(s) || (f.manager ?? '').toLowerCase().includes(s));
  }
  pagedFunds(): Fund[] {
    const v = this.visibleFunds();
    const start = this.page * this.pageSize;
    return v.slice(start, start + this.pageSize);
  }
  pageCount(): number { return Math.max(1, Math.ceil(this.visibleFunds().length / this.pageSize)); }
  onQuery() {
    this.page = 0;
    const s = this.q.trim().toLowerCase();
    const list = s
      ? this.funds().filter(f => (f.name ?? '').toLowerCase().includes(s) || (f.manager ?? '').toLowerCase().includes(s)).slice(0, 8)
      : [];
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
  pick(f: Fund) {
    this.q = f.name;
    this.suggestions.set([]);
    this.activeIndex.set(-1);
    this.selectedId.set(f.id);
    this.render();
  }
  shareText(f: Fund): string { return `${f.name} — NAV ${f.latest_nav?.nav ?? '—'} (${f.asset_class_display})`; }
  ngOnInit() {
    this.route.queryParams.subscribe(p => {
      const fundId = p['fund'] ? Number(p['fund']) : null;
      if (fundId && !isNaN(fundId)) this.selectedId.set(fundId);
      const days = p['days'] ? Number(p['days']) : NaN;
      if (days && !isNaN(days) && this.periods.some(x => x.days === days)) this.period = days;
    });
    this.api.funds().subscribe(fs => {
      this.funds.set(fs);
      if (fs.length && this.selectedId() === null) {
        const withHistory = fs.find(f => (f.nav_history ?? []).length >= 2);
        this.selectedId.set((withHistory ?? fs[0]).id);
      }
      this.render();
    });
  }
  ngAfterViewInit() { this.render(); }
  select(id: number) { this.selectedId.set(id); this.render(); }
  private render() {
    if (!this.chartRef?.nativeElement) return;
    if (!this.chart) {
      this.chart = createChart(this.chartRef.nativeElement, {
        layout: { attributionLogo: false, background: { type: ColorType.Solid, color: '#121a2e' }, textColor: '#93a4c8' },
        grid: { vertLines: { color: '#1a2440' }, horzLines: { color: '#1a2440' } },
        width: this.chartRef.nativeElement.clientWidth, height: 260,
        timeScale: { borderColor: '#223053' }, rightPriceScale: { borderColor: '#223053' },
      });
      this.series = this.chart.addSeries(AreaSeries, { lineColor: '#16c784', topColor: 'rgba(22,199,132,0.35)', bottomColor: 'rgba(22,199,132,0.02)', lineWidth: 2 });
    }
    const f = this.selected();
    if (!f || !this.series) return;
    const pts = this.windowed([...f.nav_history].sort((a, b) => a.date.localeCompare(b.date)));
    if (pts.length >= 2) {
      this.series.setData(pts.map(p => ({ time: p.date, value: Number(p.nav) })));
      this.chart?.timeScale().fitContent();
      const first = Number(pts[0].nav), last = Number(pts[pts.length - 1].nav);
      const days = Math.max(1, Math.round((new Date(pts[pts.length - 1].date).getTime() - new Date(pts[0].date).getTime()) / 86400000));
      const label = days >= 300 ? '1Y' : days >= 150 ? '6M' : days >= 45 ? '3M' : days >= 20 ? '1M' : `${days}D`;
      this.perf.set({ label, pct: Math.round((last / first - 1) * 10000) / 100 });
    } else {
      this.series.setData([]);
      this.perf.set(null);
    }
  }
}
