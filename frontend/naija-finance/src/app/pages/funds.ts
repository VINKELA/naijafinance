import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
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
      <div class="form-row" style="margin-bottom: 10px;">
        <input type="search" placeholder="Search funds by name or manager…" [(ngModel)]="q" name="fundSearch" style="flex:1;min-width:220px;">
      </div>
      <div class="form-row" style="margin-bottom: 10px;">
        <label style="font-size:12px;color:var(--txt2);font-weight:700;">Fund:</label>
        <select [ngModel]="selectedId()" (ngModelChange)="select($event)" name="fundSelect" style="flex:1;min-width:220px;">
          <option *ngFor="let f of visibleFunds()" [ngValue]="f.id">{{ f.name }} ({{ f.asset_class_display }})</option>
        </select>
        <span *ngIf="perf()" class="pill" [class.g]="perf()!.pct >= 0" [class.r]="perf()!.pct < 0">{{ perf()!.pct >= 0 ? '▲' : '▼' }} {{ perf()!.pct }}% ({{ perf()!.label }})</span>
      </div>
      <div #chartRef style="width: 100%; height: 260px;"></div>
      <p class="loading" *ngIf="!selected()">Loading funds…</p>
    </div>

    <div class="table-wrap">
      <h3>Funds &amp; latest NAV</h3>
      <table class="data">
        <thead><tr><th>Fund</th><th>Manager</th><th>Class</th><th class="num">Latest NAV</th><th class="num">NAV date</th><th></th></tr></thead>
        <tbody>
          <tr *ngFor="let f of visibleFunds()">
            <td class="sym"><a routerLink="/asset" [queryParams]="{type:'fund', id: f.id}">{{ f.name }}</a></td><td class="muted">{{ f.manager ?? '—' }}</td>
            <td>{{ f.asset_class_display }}</td>
            <td class="num">{{ f.latest_nav?.nav ?? '—' }}</td>
            <td class="num muted">{{ f.latest_nav?.date ?? '—' }}</td>
            <td><app-share-btn [text]="shareText(f)" link="/funds"></app-share-btn></td>
          </tr>
        </tbody>
      </table>
      <p class="loading" *ngIf="funds().length === 0">Loading funds…</p>
    </div>
  `,
})
export class FundsPage implements OnInit, AfterViewInit {
  edu = EDU_CONTENT;
  disclaimer = DISCLAIMER;
  funds = signal<Fund[]>([]);
  q = '';
  selectedId = signal<number | null>(null);
  perf = signal<{ label: string; pct: number } | null>(null);
  @ViewChild('chartRef') chartRef!: ElementRef;
  private chart: IChartApi | null = null;
  private series: ISeriesApi<'Area'> | null = null;

  constructor(private api: ApiService, private lang: LangService) {}
  get isPidgin() { return this.lang.isPidgin; }
  t(en: string, pidgin: string): string { return this.lang.t(en, pidgin); }
  selected(): Fund | null { return this.funds().find(f => f.id === this.selectedId()) ?? this.funds()[0] ?? null; }
  visibleFunds(): Fund[] {
    const s = this.q.trim().toLowerCase();
    if (!s) return this.funds();
    return this.funds().filter(f => (f.name ?? '').toLowerCase().includes(s) || (f.manager ?? '').toLowerCase().includes(s));
  }
  shareText(f: Fund): string { return `${f.name} — NAV ${f.latest_nav?.nav ?? '—'} (${f.asset_class_display})`; }
  ngOnInit() {
    this.api.funds().subscribe(fs => {
      this.funds.set(fs);
      if (fs.length && this.selectedId() === null) this.selectedId.set(fs[0].id);
      this.render();
    });
  }
  ngAfterViewInit() { this.render(); }
  select(id: number) { this.selectedId.set(id); this.render(); }
  private render() {
    if (!this.chartRef?.nativeElement) return;
    if (!this.chart) {
      this.chart = createChart(this.chartRef.nativeElement, {
        layout: { background: { type: ColorType.Solid, color: '#121a2e' }, textColor: '#93a4c8' },
        grid: { vertLines: { color: '#1a2440' }, horzLines: { color: '#1a2440' } },
        width: this.chartRef.nativeElement.clientWidth, height: 260,
        timeScale: { borderColor: '#223053' }, rightPriceScale: { borderColor: '#223053' },
      });
      this.series = this.chart.addSeries(AreaSeries, { lineColor: '#16c784', topColor: 'rgba(22,199,132,0.35)', bottomColor: 'rgba(22,199,132,0.02)', lineWidth: 2 });
    }
    const f = this.selected();
    if (!f || !this.series) return;
    const pts = [...f.nav_history].sort((a, b) => a.date.localeCompare(b.date));
    this.series.setData(pts.map(p => ({ time: p.date, value: Number(p.nav) })));
    this.chart?.timeScale().fitContent();
    if (pts.length >= 2) {
      const first = Number(pts[0].nav), last = Number(pts[pts.length - 1].nav);
      const days = Math.max(1, Math.round((new Date(pts[pts.length - 1].date).getTime() - new Date(pts[0].date).getTime()) / 86400000));
      const label = days >= 300 ? '1Y' : days >= 150 ? '6M' : days >= 45 ? '3M' : days >= 20 ? '1M' : `${days}D`;
      this.perf.set({ label, pct: Math.round((last / first - 1) * 10000) / 100 });
    } else this.perf.set(null);
  }
}
