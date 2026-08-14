import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { createChart, AreaSeries, ColorType, IChartApi, ISeriesApi } from 'lightweight-charts';
import { ApiService } from '../api.service';
import { ShareButton } from '../share-button';

const DISCLAIMER = 'All data on this page is illustrative mock data for demo purposes and does not constitute investment advice.';

@Component({
  selector: 'app-symbol',
  imports: [CommonModule, FormsModule, ShareButton],
  template: `
    <h2>Symbol &amp; Chart</h2>
    <p class="sub">OHLCV price chart with company profile.</p>
    <p class="disclaimer">{{ disclaimer }}</p>

    <div class="card" style="margin-bottom: 20px;">
      <form class="form-row" (ngSubmit)="load()">
        <input type="text" placeholder="Symbol (e.g. MTNN, DANGCEM, GTCO)" [(ngModel)]="symbol" name="symbol" required>
        <button type="submit">Load chart</button>
      </form>
    </div>

    <div class="card" style="margin-bottom: 20px;" *ngIf="detail()">
      <div class="stat-grid" style="margin-bottom: 0;">
        <div class="stat-tile">
          <div class="label">{{ detail().symbol }} · {{ detail().name }}</div>
          <div class="value">{{ detail().price }}</div>
          <div class="delta" [class.up]="detail().isUp" [class.down]="!detail().isUp">{{ detail().isUp ? '▲' : '▼' }} {{ detail().changePct }}%</div>
          <div style="margin-top:8px"><app-share-btn [text]="shareText()" [link]="'/symbol?symbol=' + detail().symbol"></app-share-btn></div>
        </div>
        <div class="stat-tile" *ngFor="let s of detail().stats">
          <div class="label">{{ s.label }}</div>
          <div class="value" style="font-size:16px;">{{ s.value }}</div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom: 20px;">
      <div class="interval-row" style="margin-bottom: 10px; display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
        <span class="muted" style="font-size:12px;font-weight:700;">Period:</span>
        <button type="button" *ngFor="let p of periods" class="pill interval" [class.active]="p.days === period" (click)="setPeriod(p.days)" style="cursor:pointer;">{{ p.label }}</button>
      </div>
      <div #chartRef style="width: 100%; height: 340px;"></div>
      <p class="loading" *ngIf="!detail()">Enter a symbol above to render its price history.</p>
    </div>

    <div class="table-wrap" *ngIf="detail()">
      <h3>{{ detail().about }}</h3>
    </div>
  `,
})
export class SymbolPage implements OnInit, AfterViewInit {
  disclaimer = DISCLAIMER;
  symbol = 'MTNN';
  periods = [{ label: '1M', days: 30 }, { label: '3M', days: 90 }, { label: '6M', days: 180 }, { label: '1Y', days: 365 }];
  period = 365;
  detail = signal<any>(null);
  @ViewChild('chartRef') chartRef!: ElementRef;
  private chart: IChartApi | null = null;
  private series: ISeriesApi<'Area'> | null = null;

  constructor(private api: ApiService, private route: ActivatedRoute) {}
  setPeriod(days: number) { this.period = days; this.renderChart(); }
  private windowed(pts: any[]): any[] {
    if (!pts.length) return [];
    const cutoff = new Date(Date.now() - this.period * 86400000).toISOString().slice(0, 10);
    const w = pts.filter(p => p.date >= cutoff);
    return w.length >= 2 ? w : pts;
  }

  ngOnInit() {
    this.route.queryParams.subscribe(p => {
      if (p['symbol']) { this.symbol = p['symbol'].toUpperCase(); this.load(); }
      else this.load();
    });
  }
  ngAfterViewInit() { this.renderChart(); }

  shareText(): string { const d = this.detail(); return d ? `${d.symbol} — NGN ${d.price} (${d.changePct}%)` : 'Naija Finance'; }
  load() {
    const sym = this.symbol.trim().toUpperCase();
    if (!sym) return;
    this.api.stockDetail(sym).subscribe({
      next: (d) => { this.detail.set(d); this.renderChart(); },
      error: () => this.detail.set(null),
    });
  }

  private renderChart() {
    if (!this.chartRef?.nativeElement) return;
    if (!this.chart) {
      this.chart = createChart(this.chartRef.nativeElement, {
        layout: { attributionLogo: false, background: { type: ColorType.Solid, color: '#121a2e' }, textColor: '#93a4c8' },
        grid: { vertLines: { color: '#1a2440' }, horzLines: { color: '#1a2440' } },
        width: this.chartRef.nativeElement.clientWidth,
        height: 340,
        timeScale: { borderColor: '#223053' },
        rightPriceScale: { borderColor: '#223053' },
      });
      this.series = this.chart.addSeries(AreaSeries, { lineColor: '#5b8dff', topColor: 'rgba(91,141,255,0.35)', bottomColor: 'rgba(91,141,255,0.02)', lineWidth: 2 });
    }
    const data = this.windowed((this.detail()?.chart_data ?? []).map((p: any) => ({ date: p.date, value: Number(p.price) })));
    if (this.series) this.series.setData(data.map(p => ({ time: p.date, value: p.value })));
    this.chart?.timeScale().fitContent();
  }
}
