import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { createChart, AreaSeries, ColorType, IChartApi, ISeriesApi } from 'lightweight-charts';
import { ApiService } from '../api.service';
import { LangService } from '../lang.service';
import { EduCard } from '../edu-card';
import { ShareButton } from '../share-button';
import { ChartImgShareButton } from '../chart-share-img';
import { EDU_CONTENT } from '../edu-content';

const DISCLAIMER = 'All data on this page is provided for information and education only and does not constitute investment advice. Market data is 30-minute delayed unless marked otherwise.';
const PERF_NOTE = 'Past performance ≠ future returns. Shown for information only.';

@Component({
  selector: 'app-stocks',
  imports: [ChartImgShareButton, CommonModule, FormsModule, RouterLink, EduCard, ShareButton],
  template: `
    <h2>{{ t('Stocks', 'Stoks') }}</h2>
    <p class="sub">{{ t('NGX equities — prices, historicals and fundamentals. Display only, not advice.', 'NGX equities — prices, historicals and fundamentals. Display only, no be advice.') }}</p>
    <p class="disclaimer">{{ disclaimer }}</p>

    <app-edu-card
      moduleLabel="Stocks"
      [questions]="edu['stocks'].questions"
      [defaultExpanded]="edu['stocks'].defaultExpanded"
    ></app-edu-card>

    <div class="card" style="margin-bottom:20px;">
      <div style="position:relative;margin-bottom:12px;">
        <input type="search" placeholder="{{ t('Search stocks… e.g. MTNN, GTCO, Dangote', 'Sarch stoks… e.g. MTNN, GTCO, Dangote') }}" [(ngModel)]="q" name="stockSearch" style="width:100%;" (input)="onQuery()" autocomplete="off">
      </div>
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>{{ t('Symbol', 'Symbol') }}</th><th>{{ t('Company', 'Company') }}</th><th>{{ t('Sector', 'Sector') }}</th><th class="num">{{ t('Price (₦)', 'Price (₦)') }}</th><th class="num">{{ t('Change', 'Change') }}</th><th></th></tr></thead>
          <tbody>
            <tr *ngFor="let s of visibleStocks()" [class.on]="detail()?.symbol === s.symbol" style="cursor:pointer;" (click)="select(s.symbol)">
              <td class="sym"><b>{{ s.symbol }}</b></td>
              <td>{{ s.name }}</td>
              <td class="muted">{{ s.sector }}</td>
              <td class="num">{{ s.price }}</td>
              <td class="num" [class.up]="s.isUp" [class.down]="!s.isUp">{{ s.change }}</td>
              <td class="num"><a class="link" [routerLink]="'/asset'" [queryParams]="{type:'instrument', symbol: s.symbol}" (click)="$event.stopPropagation()">{{ t('View →', 'See →') }}</a></td>
            </tr>
          </tbody>
        </table>
        <p class="loading" *ngIf="stocks().length === 0">{{ t('Loading…', 'De dey load…') }}</p>
      </div>
    </div>

    <div class="card" style="margin-bottom:20px;" *ngIf="detail()">
      <div class="stat-grid" style="margin-bottom:0;">
        <div class="stat-tile">
          <div class="label">{{ detail().symbol }} · {{ detail().name }}</div>
          <div class="value">{{ detail().price }}</div>
          <div class="delta" [class.up]="detail().isUp" [class.down]="!detail().isUp">{{ detail().isUp ? '▲' : '▼' }} {{ detail().changePct }}%</div>
          <div style="margin-top:8px">
            <app-share-btn [text]="shareText()" [link]="'/stocks?symbol=' + detail().symbol"></app-share-btn>
            <app-chart-img-share [chart]="chart" [title]="'Price history — ' + detail().symbol" [link]="'/stocks?symbol=' + detail().symbol"></app-chart-img-share>
          </div>
        </div>
        <div class="stat-tile" *ngFor="let st of detail().stats">
          <div class="label">{{ st.label }}</div>
          <div class="value" style="font-size:15px;">{{ st.value }}</div>
        </div>
      </div>
      <p *ngIf="detail().about" class="muted" style="font-size:12.5px;margin:12px 0 0;">{{ detail().about }}</p>
    </div>

    <div class="card" style="margin-bottom:20px;" *ngIf="detail()">
      <div class="interval-row" style="margin-bottom:10px; display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
        <span class="muted" style="font-size:12px;font-weight:700;">{{ t('Period:', 'Period:') }}</span>
        <button type="button" *ngFor="let p of periods" class="pill interval" [class.active]="p.days === period" (click)="setPeriod(p.days)" style="cursor:pointer;">{{ p.label }}</button>
        <span style="flex:1"></span>
        <span class="muted" style="font-size:11px;">{{ t('Price history (₦) · as of', 'Price history (₦) · as of') }} {{ asOf() }}</span>
      </div>
      <div #chartRef style="width:100%; height:300px;"></div>
      <p class="disclaimer" style="margin:8px 0 0;">{{ perfNote }}</p>
    </div>

    <p class="disc">⚠️ {{ t('NaijaFinance Hub is a data &amp; analytics platform only. Nothing here is investment advice. Sources: NGX (public disclosures), company filings.', 'NaijaFinance Hub na data &amp; analytics platform only. Nothing here na investment advice. Sources: NGX, company filings.') }}</p>
  `,
})
export class StocksPage implements OnInit, AfterViewInit {
  disclaimer = DISCLAIMER;
  perfNote = PERF_NOTE;
  edu = EDU_CONTENT;
  stocks = signal<any[]>([]);
  detail = signal<any>(null);
  q = '';
  periods = [{ label: '1M', days: 30 }, { label: '3M', days: 90 }, { label: '6M', days: 180 }, { label: '1Y', days: 365 }];
  period = 365;
  private requested = '';
  @ViewChild('chartRef') chartRef!: ElementRef;
  chart: IChartApi | null = null;
  private series: ISeriesApi<'Area'> | null = null;

  constructor(private api: ApiService, private lang: LangService, private route: ActivatedRoute) {}
  get isPidgin() { return this.lang.isPidgin; }
  t(en: string, pidgin: string): string { return this.lang.t(en, pidgin); }

  visibleStocks(): any[] {
    const s = this.q.trim().toLowerCase();
    const list = this.stocks();
    if (!s) return list;
    return list.filter(x => (x.symbol ?? '').toLowerCase().includes(s) || (x.name ?? '').toLowerCase().includes(s) || (x.sector ?? '').toLowerCase().includes(s));
  }
  onQuery() { /* visibleStocks() is reactive */ }

  shareText(): string { const d = this.detail(); return d ? `${d.symbol} — ₦${d.price} (${d.changePct}%)` : 'Stocks — NaijaFinance Hub'; }

  ngOnInit() {
    this.route.queryParams.subscribe(p => {
      const sym = (p['symbol'] ?? '').toString().toUpperCase();
      if (sym) this.requested = sym;
    });
    this.api.movers('active', 60).subscribe({
      next: (rows) => {
        this.stocks.set(rows);
        if (rows.length) {
          const target = this.requested ? rows.find(r => (r.symbol ?? '').toUpperCase() === this.requested) : null;
          this.select((target ?? rows[0]).symbol);
        }
      },
      error: () => {},
    });
  }

  ngAfterViewInit() { this.render(); }

  select(symbol: string) {
    this.api.stockDetail(symbol).subscribe({
      next: (d) => { this.detail.set(d); this.render(); },
      error: () => {},
    });
  }

  setPeriod(days: number) { this.period = days; this.render(); }

  asOf(): string {
    const pts = this.detail()?.chart_data ?? [];
    return pts.length ? pts[pts.length - 1].date : '—';
  }

  private windowed(pts: any[]): any[] {
    if (!pts.length) return [];
    const cutoff = new Date(Date.now() - this.period * 86400000).toISOString().slice(0, 10);
    const w = pts.filter(p => p.date >= cutoff);
    return w.length >= 2 ? w : pts;
  }

  private render() {
    if (!this.chartRef?.nativeElement) return;
    if (!this.chart) {
      this.chart = createChart(this.chartRef.nativeElement, {
        layout: { attributionLogo: false, background: { type: ColorType.Solid, color: '#121a2e' }, textColor: '#93a4c8' },
        grid: { vertLines: { color: '#1a2440' }, horzLines: { color: '#1a2440' } },
        autoSize: true,
        height: 300,
        timeScale: { borderColor: '#223053' }, rightPriceScale: { borderColor: '#223053' },
      });
      this.series = this.chart.addSeries(AreaSeries, { lineColor: '#16c784', topColor: 'rgba(22,199,132,0.3)', bottomColor: 'rgba(22,199,132,0.02)', lineWidth: 2 });
    }
    const pts = this.windowed((this.detail()?.chart_data ?? []).map((p: any) => ({ date: p.date, value: Number(p.price) })));
    this.series?.setData(pts.map(p => ({ time: p.date, value: p.value })));
    this.chart?.timeScale().fitContent();
  }
}
