import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { createChart, AreaSeries, ColorType, IChartApi, ISeriesApi } from 'lightweight-charts';
import { ApiService } from '../api.service';
import { fmtChartPrice } from '../format';
import { ShareButton } from '../share-button';
import { fmtDate, fmtMoney, fmtPrice, fmtPct } from '../format';
import { IS_DEMO } from '../env';

const DISCLAIMER = 'All data on this page is provided for information and education only and does not constitute investment advice.';

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
          <div class="delta" [class.up]="detail().isUp" [class.down]="!detail().isUp">{{ detail().isUp ? '▲' : '▼' }} {{ fmtPct(detail().changePct) }}</div>
          <div style="margin-top:8px"><app-share-btn [text]="shareText()" [link]="'/symbol?symbol=' + detail().symbol"></app-share-btn></div>
        </div>
        <div class="stat-tile" *ngFor="let s of detail().stats">
          <div class="label">{{ s.label }}</div>
          <div class="value" style="font-size:16px;">{{ fmtStat(s.label, s.value) }}</div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom: 20px;">
      <div #chartRef style="width: 100%; height: 340px;"></div>
      <p class="loading" *ngIf="!detail()">Enter a symbol above to render its price history.</p>
    </div>

    <div class="table-wrap" *ngIf="detail()">
      <h3>{{ detail().about }}</h3>
    </div>
  `,
})
export class SymbolPage implements OnInit, AfterViewInit {
  disclaimer = IS_DEMO ? 'All data on this page is illustrative mock data for demo purposes and does not constitute investment advice.' : DISCLAIMER;
  symbol = 'MTNN';
  detail = signal<any>(null);
  @ViewChild('chartRef') chartRef!: ElementRef;
  private chart: IChartApi | null = null;
  private series: ISeriesApi<'Area'> | null = null;

  fmtChartPrice = fmtChartPrice;
  constructor(private api: ApiService, private route: ActivatedRoute) {}

  ngOnInit() {
    this.route.queryParams.subscribe(p => {
      if (p['symbol']) { this.symbol = p['symbol'].toUpperCase(); this.load(); }
      else this.load();
    });
  }
  ngAfterViewInit() { this.renderChart(); }

  shareText(): string { const d = this.detail(); return d ? `${d.symbol} — NGN ${fmtPrice(d.price)} (${fmtPct(d.changePct)})` : 'NaijaFinance Hub'; }
  fmtStat(label: string, value: string): string {
    if (!value || value === '—') return '—';
    if (/market cap/i.test(label)) return fmtMoney(value);
    if (/^(eps|pe|book value)/i.test(label)) return fmtPrice(value);
    if (/maturity|nav date|as of/i.test(label)) return fmtDate(value);
    return value;
  }
  fmtPrice = fmtPrice; fmtPct = fmtPct; fmtDate = fmtDate;
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
        localization: { priceFormatter: fmtChartPrice },
      });
      this.series = this.chart.addSeries(AreaSeries, { lineColor: '#5b8dff', topColor: 'rgba(91,141,255,0.35)', bottomColor: 'rgba(91,141,255,0.02)', lineWidth: 2 });
    }
    const data = (this.detail()?.chart_data ?? []).map((p: any) => ({ time: p.date, value: Number(p.price) }));
    if (this.series) this.series.setData(data);
    this.chart?.timeScale().fitContent();
  }
}
