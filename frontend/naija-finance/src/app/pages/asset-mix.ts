import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { createChart, AreaSeries, ColorType, IChartApi, ISeriesApi } from 'lightweight-charts';
import { ApiService } from '../api.service';
import { fmtMoney, fmtPct } from '../format';

const PERF_NOTE = 'Past performance ≠ future returns. Shown for information only.';

@Component({
  selector: 'app-asset-mix',
  imports: [CommonModule, RouterLink],
  template: `
    <h2>My Asset Mix</h2>
    <p class="sub" *ngIf="card()">Shareable performance card · as of {{ card().asOf }}</p>
    <p class="error" *ngIf="error">{{ error }}</p>

    <div class="card" style="margin-bottom: 20px;" *ngIf="card()">
      <div class="stat-grid" style="margin-bottom: 0;">
        <div class="stat-tile">
          <div class="label">{{ card().name }}</div>
          <div class="value">{{ fmt(card().totalValue) }}</div>
          <div class="delta" *ngIf="yield() !== null" [class.up]="yield()! >= 0" [class.down]="yield()! < 0">{{ yield()! >= 0 ? '▲' : '▼' }} {{ yield() }}% ({{ periodLabel() }})</div>
        </div>
        <div class="stat-tile" *ngFor="let it of card().items">
          <div class="label">{{ it.symbol }}</div>
          <div class="value" style="font-size:16px;">{{ fmt(it.value) }}</div>
          <div class="delta">{{ it.pct }}%</div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom: 20px;">
      <div class="form-row" style="margin-bottom: 10px;">
        <span class="pill" *ngFor="let p of periods" [class.g]="period === p.days" style="cursor:pointer;" (click)="loadPerformance(p.days)">{{ p.label }}</span>
        <span class="muted" style="font-size:11.5px;">Mix value over time</span>
      </div>
      <div #chartRef style="width: 100%; height: 260px;"></div>
      <p class="loading" *ngIf="!card() && !error">Loading…</p>
      <p class="disclaimer" style="margin:8px 0 0;">{{ perfNote }}</p>
    </div>
  `,
})
export class AssetMixPage implements OnInit, AfterViewInit {
  perfNote = PERF_NOTE;
  periods = [{ label: '1M', days: 30 }, { label: '3M', days: 90 }, { label: '6M', days: 180 }, { label: '1Y', days: 365 }];
  period = 90;
  card = signal<any>(null);
  yieldVal = signal<number | null>(null);
  error = '';
  token = '';
  @ViewChild('chartRef') chartRef!: ElementRef;
  private chart: IChartApi | null = null;
  private series: ISeriesApi<'Area'> | null = null;

  constructor(private api: ApiService, private route: ActivatedRoute) {}

  ngOnInit() {
    this.route.queryParams.subscribe(p => {
      this.token = p['token'] ?? '';
      if (!this.token) { this.error = 'No Asset Mix token in the link.'; return; }
      this.api.mixCard(this.token).subscribe({
        next: (c) => { this.card.set(c); this.error = ''; },
        error: () => this.error = 'Mix not found — the link may be invalid or expired.',
      });
      if (this.api.isAuthed || true) this.loadPerformance(this.period);
    });
  }

  ngAfterViewInit() { if (this.token) this.loadPerformance(this.period); }

  yield(): number | null { return this.yieldVal(); }
  periodLabel(): string { return this.periods.find(p => p.days === this.period)?.label ?? ''; }
  loadPerformance(days: number) {
    this.period = days;
    if (!this.token) return;
    this.api.mixPerformance(this.token, days).subscribe({
      next: (r) => {
        const pts = r.points ?? [];
        this.render(pts);
        if (pts.length >= 2) {
          const first = Number(pts[0].value), last = Number(pts[pts.length - 1].value);
          this.yieldVal.set(first ? Math.round((last / first - 1) * 10000) / 100 : null);
        } else this.yieldVal.set(null);
      },
      error: () => { this.render([]); this.yieldVal.set(null); },
    });
  }

  private render(pts: any[]) {
    if (!this.chartRef?.nativeElement) return;
    if (!this.chart) {
      this.chart = createChart(this.chartRef.nativeElement, {
        layout: { background: { type: ColorType.Solid, color: '#121a2e' }, textColor: '#93a4c8' },
        grid: { vertLines: { color: '#1a2440' }, horzLines: { color: '#1a2440' } },
        width: this.chartRef.nativeElement.clientWidth, height: 260,
        timeScale: { borderColor: '#223053' }, rightPriceScale: { borderColor: '#223053' },
      });
      this.series = this.chart.addSeries(AreaSeries, { lineColor: '#4e9bff', topColor: 'rgba(78,155,255,0.3)', bottomColor: 'rgba(78,155,255,0.02)', lineWidth: 2 });
    }
    this.series?.setData(pts.map(p => ({ time: p.date, value: Number(p.value) })));
    this.chart?.timeScale().fitContent();
  }

  fmt(n: number): string { return fmtMoney(n); }
}
