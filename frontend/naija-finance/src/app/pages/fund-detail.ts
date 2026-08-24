import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { createChart, AreaSeries, ColorType, IChartApi, ISeriesApi } from 'lightweight-charts';
import { ApiService } from '../api.service';
import { ShareButton } from '../share-button';
import { LangService } from '../i18n';

const DISCLAIMER = 'All data on this page is provided for information and education only and does not constitute investment advice.';

const STRINGS = {
  en: {
    fund: 'Fund', loading: 'Loading fund…', notFound: 'Could not load this fund. It may not exist.',
    manager: 'Manager', cadence: 'Update cadence', navTrend: 'NAV history & trend',
    allInfo: 'All information', latestNav: 'Latest NAV', navDate: 'NAV date',
    assetClass: 'Asset class', totalReturn: 'Return since first snapshot',
    snapshots: 'Published NAV snapshots', firstDate: 'First NAV date', latestUpdate: 'Latest update',
    noNav: 'No NAV history published yet for this fund.', back: '← All funds',
    cadenceMissing: 'Not yet provided by the data source.',
    name: 'Name', id: 'ID', about: 'About',
    share: 'Share',
  },
  pcm: {
    fund: 'Fund', loading: 'We dey load di fund…', notFound: 'We no fit load dis fund. E fit no dey exist.',
    manager: 'Manager', cadence: 'How often dem dey update am', navTrend: 'How di NAV don dey go',
    allInfo: 'All di information', latestNav: 'Latest NAV price', navDate: 'NAV date',
    assetClass: 'Kind of asset', totalReturn: 'Gain since di first snapshot',
    snapshots: 'Number of NAV wey dem don publish', firstDate: 'First NAV date', latestUpdate: 'Last time wey dem update am',
    noNav: 'Dem never publish any NAV history for dis fund.', back: '← All funds',
    cadenceMissing: 'Di data source never give us dis one yet.',
    name: 'Name', id: 'ID', about: 'About am',
    share: 'Share',
  },
};

@Component({
  selector: 'app-fund-detail',
  imports: [CommonModule, RouterLink, ShareButton],
  template: `
    <a routerLink="/funds" class="muted" style="font-size:12px;text-decoration:none;">{{ t().back }}</a>
    <h2>{{ t().fund }} · {{ detail()?.name ?? (notFound() ? '—' : 'Loading…') }}</h2>
    <p class="sub">{{ detail()?.asset_type ?? ' ' }}</p>
    <p class="disclaimer">{{ disclaimer }}</p>

    <p class="loading" *ngIf="!detail() && !notFound()">{{ t().loading }}</p>
    <div class="card" *ngIf="notFound()" style="margin-bottom:20px;">
      <p style="padding:14px 16px;color:var(--txt2);">{{ t().notFound }}</p>
    </div>

    <div class="card" style="margin-bottom:20px;" *ngIf="detail()">
      <div class="stat-grid">
        <div class="stat-tile">
          <div class="label">{{ t().latestNav }}</div>
          <div class="value">{{ detail().price }}</div>
          <div class="delta" *ngIf="detail().changePct !== '—'" [class.up]="detail().isUp" [class.down]="!detail().isUp">{{ detail().isUp ? '▲' : '▼' }} {{ detail().changePct }}%</div>
        </div>
        <div class="stat-tile" *ngFor="let st of infoRows()">
          <div class="label">{{ st.label }}</div>
          <div class="value" style="font-size:16px;">{{ st.value }}</div>
        </div>
        <div class="stat-tile"><app-share-btn [text]="shareText()" [link]="shareLink()"></app-share-btn></div>
      </div>
      <div style="margin-top:10px;">
        <span class="pill" [class.g]="i18n.lang() === 'en'" style="cursor:pointer;" (click)="setLang('en')">EN</span>
        <span class="pill" [class.g]="i18n.lang() === 'pcm'" style="cursor:pointer;margin-left:6px;" (click)="setLang('pcm')">Pidgin</span>
      </div>
    </div>

    <div class="card" style="margin-bottom:20px;" *ngIf="detail()">
      <h3>{{ t().navTrend }}</h3>
      <div #chartRef style="width:100%;height:280px;display:none;"></div>
      <p class="loading" *ngIf="!hasNav()">{{ t().noNav }}</p>
    </div>

    <div class="table-wrap" *ngIf="detail()">
      <h3>{{ t().allInfo }}</h3>
      <table class="data">
        <tbody>
          <tr *ngFor="let row of allInfoRows()"><td style="width:220px;color:var(--txt2);font-weight:700;">{{ row.label }}</td><td>{{ row.value }}</td></tr>
        </tbody>
      </table>
    </div>
  `,
})
export class FundDetailPage implements OnInit, AfterViewInit {
  disclaimer = DISCLAIMER;
  detail = signal<any>(null);
  notFound = signal(false);
  @ViewChild('chartRef') chartRef!: ElementRef;
  private chart: IChartApi | null = null;
  private series: ISeriesApi<'Area'> | null = null;

  constructor(private api: ApiService, private route: ActivatedRoute, public i18n: LangService) {}

  t(): typeof STRINGS['en'] { return STRINGS[this.i18n.lang()]; }
  hasNav(): boolean { return (this.detail()?.chart_data?.length ?? 0) > 0; }
  setLang(l: 'en' | 'pcm') { if (this.i18n.lang() !== l) this.i18n.toggle(); }

  /** Key facts: Manager and Update cadence are required sections. */
  infoRows(): { label: string; value: string }[] {
    const d = this.detail();
    if (!d) return [];
    return [
      { label: this.t().manager, value: d.manager && d.manager !== '—' ? d.manager : '—' },
      { label: this.t().cadence, value: '—' },
    ];
  }

  /** Every field available in the /api/fund/<id>/ payload, rendered honestly. */
  allInfoRows(): { label: string; value: string }[] {
    const d = this.detail();
    if (!d) return [];
    const rows = [
      { label: this.t().name, value: d.name ?? '—' },
      { label: this.t().id, value: String(d.id ?? '—') },
      { label: this.t().assetClass, value: d.asset_type ?? '—' },
      { label: this.t().manager, value: d.manager && d.manager !== '—' ? d.manager : '—' },
      { label: this.t().latestNav, value: d.price ?? '—' },
      { label: this.t().totalReturn, value: d.changePct !== undefined ? (d.changePct === '—' ? '—' : `${d.changePct}%`) : '—' },
      { label: this.t().snapshots, value: Array.isArray(d.chart_data) ? String(d.chart_data.length) : '—' },
      { label: this.t().firstDate, value: d.chart_data?.[0]?.date ?? '—' },
      { label: this.t().latestUpdate, value: d.chart_data?.length ? d.chart_data[d.chart_data.length - 1].date : '—' },
      { label: this.t().cadence, value: `— (${this.t().cadenceMissing})` },
    ];
    if (d.about) rows.push({ label: this.t().about, value: d.about });
    return rows;
  }

  shareText(): string {
    const d = this.detail();
    return d ? `${d.name} — NAV ${d.price} (${d.asset_type})` : 'Naija Finance';
  }
  shareLink(): string {
    const d = this.detail();
    return d ? `/funds/${d.id}` : '/funds';
  }

  ngOnInit() {
    this.route.paramMap.subscribe(p => {
      const id = Number(p.get('id'));
      if (!id || !Number.isFinite(id)) { this.notFound.set(true); return; }
      this.api.fundDetail(id).subscribe({
        next: (d) => { this.detail.set(d); setTimeout(() => this.renderChart(), 0); },
        error: () => this.notFound.set(true),
      });
    });
  }
  ngAfterViewInit() { this.renderChart(); }

  private renderChart() {
    if (!this.hasNav() || !this.chartRef?.nativeElement) return;
    this.chartRef.nativeElement.style.display = 'block';
    if (!this.chart) {
      this.chart = createChart(this.chartRef.nativeElement, {
        layout: { background: { type: ColorType.Solid, color: '#121a2e' }, textColor: '#93a4c8' },
        grid: { vertLines: { color: '#1a2440' }, horzLines: { color: '#1a2440' } },
        width: this.chartRef.nativeElement.clientWidth, height: 280,
        timeScale: { borderColor: '#223053' }, rightPriceScale: { borderColor: '#223053' },
      });
      this.series = this.chart.addSeries(AreaSeries, { lineColor: '#16c784', topColor: 'rgba(22,199,132,0.35)', bottomColor: 'rgba(22,199,132,0.02)', lineWidth: 2 });
    }
    const pts = [...this.detail().chart_data].sort((a: any, b: any) => a.date.localeCompare(b.date));
    this.series?.setData(pts.map((p: any) => ({ time: p.date, value: Number(p.value) })));
    this.chart?.timeScale().fitContent();
  }
}
