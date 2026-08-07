import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { createChart, AreaSeries, ColorType, IChartApi, ISeriesApi } from 'lightweight-charts';
import { ApiService, CompanyProfile } from '../api.service';
import { ShareButton } from '../share-button';
import { fmtMoney, fmtPrice, fmtCompactWords, fmtChartPrice } from '../format';

const DISCLAIMER = 'All data on this page is provided for information and education only and does not constitute investment advice.';

@Component({
  selector: 'app-companies',
  imports: [CommonModule, FormsModule, RouterLink, ShareButton],
  template: `
    <h2>Company Profiles &amp; Fundamentals</h2>
    <p class="sub">Public company profiles with key fundamentals and historical revenue, for display only.</p>
    <p class="disclaimer">{{ disclaimer }}</p>

    <div class="card" style="margin-bottom: 20px;">
      <div class="form-row" style="margin-bottom: 10px;">
        <label style="font-size:12px;color:var(--txt2);font-weight:700;">Company:</label>
        <select [ngModel]="selectedId()" (ngModelChange)="select($event)" name="coSelect" style="flex:1;min-width:220px;">
          <option *ngFor="let c of companies()" [ngValue]="c.id">{{ c.symbol }} — {{ c.name }}</option>
        </select>
      </div>
      <div *ngIf="selected()" class="stat-grid" style="margin-bottom: 10px;">
        <div class="stat-tile"><div class="label">{{ selected()!.symbol }} · {{ selected()!.name }}</div>
          <div class="value" style="font-size:15px;">{{ selected()!.sector ?? '—' }}</div></div>
        <div class="stat-tile"><div class="label">EPS</div><div class="value" style="font-size:16px;">{{ selected()!.eps ?? '—' }}</div></div>
        <div class="stat-tile"><div class="label">P/E</div><div class="value" style="font-size:16px;">{{ selected()!.pe_ratio ?? '—' }}</div></div>
        <div class="stat-tile"><div class="label">Book value</div><div class="value" style="font-size:16px;">{{ selected()!.book_value ?? '—' }}</div></div>
        <div class="stat-tile"><div class="label">Market cap</div><div class="value" style="font-size:16px;">{{ naira(selected()!.market_cap) }}</div></div>
      </div>
      <p *ngIf="selected()?.description" class="muted" style="font-size:12.5px;margin-bottom:10px;">{{ selected()!.description }}</p>
      <div #chartRef style="width: 100%; height: 240px;"></div>
      <p class="loading" *ngIf="!selected()">Loading companies…</p>
    </div>

    <div class="table-wrap">
      <h3>Profiles</h3>
      <table class="data">
        <thead><tr><th>Symbol</th><th>Name</th><th>Sector</th><th class="num">EPS</th><th class="num">P/E</th><th class="num">Book value</th><th class="num">Market cap (₦)</th><th></th></tr></thead>
        <tbody>
          <tr *ngFor="let c of companies()">
            <td class="sym"><a routerLink="/asset" [queryParams]="{type:'company', symbol: c.symbol}">{{ c.symbol }}</a></td><td>{{ c.name }}</td><td class="muted">{{ c.sector ?? '—' }}</td>
            <td class="num">{{ fmtPrice(c.eps) }}</td><td class="num">{{ fmtPrice(c.pe_ratio) }}</td>
            <td class="num">{{ fmtPrice(c.book_value) }}</td><td class="num">{{ naira(c.market_cap) }}</td>
            <td><app-share-btn [text]="shareText(c)" [link]="'/symbol?symbol=' + c.symbol"></app-share-btn></td>
          </tr>
        </tbody>
      </table>
      <p class="loading" *ngIf="companies().length === 0">Loading profiles…</p>
    </div>
  `,
})
export class CompaniesPage implements OnInit, AfterViewInit {
  disclaimer = DISCLAIMER;
  companies = signal<CompanyProfile[]>([]);
  selectedId = signal<number | null>(null);
  @ViewChild('chartRef') chartRef!: ElementRef;
  private chart: IChartApi | null = null;
  private series: ISeriesApi<'Area'> | null = null;

  fmtPrice = fmtPrice; fmtMoney = fmtMoney; fmtChartPrice = fmtChartPrice;
  constructor(private api: ApiService) {}
  selected(): CompanyProfile | null { return this.companies().find(c => c.id === this.selectedId()) ?? this.companies()[0] ?? null; }
  naira(v: string | null): string { return v ? '₦' + fmtCompactWords(v) : '—'; }
  shareText(c: CompanyProfile): string { return `${c.name} (${c.symbol}) — company profile`; }
  ngOnInit() {
    this.api.companies().subscribe(cs => {
      this.companies.set(cs);
      if (cs.length && this.selectedId() === null) this.selectedId.set(cs[0].id);
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
        width: this.chartRef.nativeElement.clientWidth, height: 240,
        timeScale: { borderColor: '#223053' }, rightPriceScale: { borderColor: '#223053' },
        localization: { priceFormatter: fmtChartPrice },
      });
      this.series = this.chart.addSeries(AreaSeries, { lineColor: '#f0b90b', topColor: 'rgba(240,185,11,0.3)', bottomColor: 'rgba(240,185,11,0.02)', lineWidth: 2 });
    }
    const c = this.selected();
    if (!c || !this.series) return;
    const pts = (c.revenue_history ?? []).map(r => ({ time: `${r.year}-01-01`, value: Number(r.revenue_ngn) }));
    this.series.setData(pts);
    this.chart?.timeScale().fitContent();
  }
}
