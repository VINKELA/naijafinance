import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { createChart, AreaSeries, ColorType, IChartApi, ISeriesApi } from 'lightweight-charts';
import { ApiService } from '../api.service';
import { ShareButton } from '../share-button';

const DISCLAIMER = 'All data on this page is provided for information and education only and does not constitute investment advice.';

@Component({
  selector: 'app-asset',
  imports: [CommonModule, RouterLink, ShareButton],
  template: `
    <h2>{{ kindLabel() }} · {{ detail()?.name ?? 'Loading…' }}</h2>
    <p class="sub">{{ detail()?.asset_type ?? ' ' }}</p>
    <p class="disclaimer">{{ disclaimer }}</p>

    <div class="card" style="margin-bottom: 20px;" *ngIf="detail()">
      <div class="stat-grid" style="margin-bottom: 0;">
        <div class="stat-tile">
          <div class="label">{{ detail().symbol }}</div>
          <div class="value">{{ detail().price }}</div>
          <div class="delta" [class.up]="detail().isUp" [class.down]="!detail().isUp && detail().changePct !== '—'">{{ detail().isUp ? '▲' : '▼' }} {{ detail().changePct }}%</div>
          <div style="margin-top:8px"><app-share-btn [text]="shareText()" [link]="shareLink()"></app-share-btn></div>
        </div>
        <div class="stat-tile" *ngFor="let st of detail().stats">
          <div class="label">{{ st.label }}</div>
          <div class="value" style="font-size:16px;">{{ st.value }}</div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom: 20px;">
      <div class="form-row" style="margin-bottom: 10px;" *ngIf="periods().length">
        <span class="pill" *ngFor="let p of periods()" [class.g]="period === p.days" style="cursor:pointer;" (click)="setPeriod(p.days)">{{ p.label }}</span>
      </div>
      <div #chartRef style="width: 100%; height: 300px;"></div>
      <p class="loading" *ngIf="!detail()">Loading…</p>
    </div>

    <div class="table-wrap" *ngIf="detail()?.about">
      <h3>About</h3>
      <p style="padding:14px 16px;font-size:13px;color:var(--txt2);line-height:1.6;">{{ detail().about }}</p>
    </div>
  `,
})
export class AssetPage implements OnInit, AfterViewInit {
  disclaimer = DISCLAIMER;
  detail = signal<any>(null);
  kind = 'instrument';
  period = 90;
  @ViewChild('chartRef') chartRef!: ElementRef;
  private chart: IChartApi | null = null;
  private series: ISeriesApi<'Area'> | null = null;

  constructor(private api: ApiService, private route: ActivatedRoute) {}

  periods() {
    return this.kind === 'company'
      ? []
      : [{ label: '1W', days: 7 }, { label: '1M', days: 30 }, { label: '3M', days: 90 }, { label: '1Y', days: 365 }];
  }
  kindLabel(): string { return this.kind === 'fund' ? 'Fund' : this.kind === 'company' ? 'Company' : 'Asset'; }

  ngOnInit() {
    this.route.queryParams.subscribe(p => {
      this.kind = p['type'] ?? 'instrument';
      this.load(p);
    });
  }
  ngAfterViewInit() { this.renderChart(); }

  shareText(): string {
    const d = this.detail();
    return d ? `${d.name} — ${d.price} (${d.asset_type})` : 'Naija Finance';
  }
  shareLink(): string {
    const d = this.detail();
    if (!d) return '/market';
    if (this.kind === 'fund') return `/asset?type=fund&id=${d.id}`;
    return `/asset?type=${this.kind}&symbol=${d.symbol}`;
  }

  private load(p: any) {
    const sym = (p['symbol'] ?? '').toUpperCase();
    const id = p['id'] ? Number(p['id']) : null;
    if (this.kind === 'fund' && id) {
      this.api.fundDetail(id).subscribe({ next: (d) => { this.detail.set(d); this.renderChart(); }, error: () => this.detail.set(null) });
    } else if (this.kind === 'company' && sym) {
      this.api.companyDetail(sym).subscribe({ next: (d) => { this.detail.set(d); this.renderChart(); }, error: () => this.detail.set(null) });
    } else if (sym) {
      this.api.stockDetail(sym).subscribe({ next: (d) => { this.detail.set(d); this.renderChart(); }, error: () => this.detail.set(null) });
    }
  }

  setPeriod(days: number) {
    this.period = days;
    this.renderChart();
  }

  private renderChart() {
    if (!this.chartRef?.nativeElement) return;
    if (!this.chart) {
      this.chart = createChart(this.chartRef.nativeElement, {
        layout: { attributionLogo: false, background: { type: ColorType.Solid, color: '#121a2e' }, textColor: '#93a4c8' },
        grid: { vertLines: { color: '#1a2440' }, horzLines: { color: '#1a2440' } },
        width: this.chartRef.nativeElement.clientWidth, height: 300,
        timeScale: { borderColor: '#223053' }, rightPriceScale: { borderColor: '#223053' },
      });
      this.series = this.chart.addSeries(AreaSeries, { lineColor: '#16c784', topColor: 'rgba(22,199,132,0.3)', bottomColor: 'rgba(22,199,132,0.02)', lineWidth: 2 });
    }
    const all = (this.detail()?.chart_data ?? []).map((p: any) => ({ time: p.date, value: Number(p.price ?? p.value) }));
    const cutoff = this.kind === 'company' ? 0 : Date.now() - this.period * 86400000;
    const data = all.filter((p: any) => this.kind === 'company' || new Date(p.time).getTime() >= cutoff);
    this.series?.setData(data);
    this.chart?.timeScale().fitContent();
  }
}
