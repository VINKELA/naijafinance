import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { createChart, LineSeries, ColorType, IChartApi, ISeriesApi } from 'lightweight-charts';
import { ApiService } from '../api.service';
import { fmtPct } from '../format';

const DISCLAIMER = 'All data on this page is provided for information and education only and does not constitute investment advice.';
const PALETTE = ['#16c784', '#4e9bff', '#f0b90b', '#ea3943', '#a78bfa', '#f97316', '#22d3ee', '#e879f9', '#84cc16', '#fb7185'];

@Component({
  selector: 'app-compare',
  imports: [CommonModule, FormsModule],
  template: `
    <h2>Compare Assets</h2>
    <p class="sub">Normalized % performance of any mix of stocks, bonds, funds over a period.</p>
    <p class="disclaimer">{{ disclaimer }}</p>
    <p class="error" *ngIf="error">{{ error }}</p>

    <div class="card" style="margin-bottom: 20px;">
      <form class="form-row" (ngSubmit)="addSymbols()">
        <input type="text" placeholder="Symbols, comma-separated (e.g. MTNN, DANGCEM, FGN-14.55-2029)" [(ngModel)]="symbolInput" name="symbols">
        <button type="submit">Add</button>
      </form>
      <form class="form-row" style="margin-top:8px" (ngSubmit)="addFund()">
        <select [(ngModel)]="fundId" name="fundId" style="flex:1;min-width:220px;">
          <option [ngValue]="null" disabled>Add a fund…</option>
          <option *ngFor="let f of funds()" [ngValue]="f.id">{{ f.name }} ({{ f.asset_class_display }})</option>
        </select>
        <button type="submit" [disabled]="!fundId">Add fund</button>
      </form>
      <div class="form-row" style="margin-top:10px;flex-wrap:wrap;" *ngIf="chips().length">
        <span class="pill" *ngFor="let c of chips(); let i = index" style="cursor:pointer;" (click)="removeChip(i)">{{ c.label }} ✕</span>
      </div>
      <div class="form-row" style="margin-top:12px;">
        <span class="pill" *ngFor="let p of periods" [class.g]="period === p.days" style="cursor:pointer;" (click)="load(p.days)">{{ p.label }}</span>
      </div>
    </div>

    <div class="card" style="margin-bottom: 20px;">
      <div #chartRef style="width: 100%; height: 340px;"></div>
      <p class="loading" *ngIf="!rows().length && !error">Add symbols or funds above to compare.</p>
    </div>

    <div class="table-wrap" *ngIf="rows().length">
      <h3>Performance over {{ periodLabel() }}</h3>
      <table class="data">
        <thead><tr><th>Asset</th><th>Class</th><th class="num">Change</th></tr></thead>
        <tbody>
          <tr *ngFor="let r of rows()">
            <td class="sym">{{ r.symbol }}</td><td>{{ r.asset_type }}</td>
            <td class="num" [class.up]="r.change_pct >= 0" [class.down]="r.change_pct < 0">{{ r.change_pct >= 0 ? '▲' : '▼' }} {{ fmtPct(r.change_pct) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `,
})
export class ComparePage implements OnInit, AfterViewInit {
  disclaimer = DISCLAIMER;
  periods = [{ label: '1W', days: 7 }, { label: '1M', days: 30 }, { label: '3M', days: 90 }, { label: '6M', days: 180 }, { label: '1Y', days: 365 }];
  period = 90;
  symbolInput = '';
  fundId = null as number | null;
  symbols = signal<string[]>([]);
  fundIds = signal<number[]>([]);
  funds = signal<any[]>([]);
  rows = signal<any[]>([]);
  error = '';
  @ViewChild('chartRef') chartRef!: ElementRef;
  private chart: IChartApi | null = null;
  private series: ISeriesApi<'Line'>[] = [];

  fmtPct = fmtPct;
  constructor(private api: ApiService) {}
  chips() {
    return [
      ...this.symbols().map(s => ({ label: s })),
      ...this.fundIds().map(id => {
        const f = this.funds().find(x => x.id === id);
        return { label: f ? f.name : `fund#${id}` };
      }),
    ];
  }
  periodLabel(): string { return this.periods.find(p => p.days === this.period)?.label ?? ''; }
  ngOnInit() { this.api.funds().subscribe(fs => this.funds.set(fs)); }
  ngAfterViewInit() {}

  addSymbols() {
    const parts = this.symbolInput.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    if (!parts.length) return;
    this.symbols.set([...new Set([...this.symbols(), ...parts])]);
    this.symbolInput = '';
    this.load(this.period);
  }
  addFund() {
    if (!this.fundId) return;
    this.fundIds.set([...new Set([...this.fundIds(), this.fundId as number])]);
    this.fundId = null;
    this.load(this.period);
  }
  removeChip(i: number) {
    const syms = [...this.symbols()], fids = [...this.fundIds()];
    if (i < syms.length) syms.splice(i, 1); else fids.splice(i - syms.length, 1);
    this.symbols.set(syms); this.fundIds.set(fids);
    this.load(this.period);
  }
  load(days: number) {
    this.period = days;
    this.error = '';
    this.api.compare(this.symbols(), this.fundIds(), days).subscribe({
      next: (r) => { this.rows.set(r.series ?? []); this.render(r.series ?? []); },
      error: () => { this.rows.set([]); this.render([]); this.error = 'Compare failed.'; },
    });
  }
  private render(rows: any[]) {
    if (!this.chartRef?.nativeElement) return;
    if (!this.chart) {
      this.chart = createChart(this.chartRef.nativeElement, {
        layout: { background: { type: ColorType.Solid, color: '#121a2e' }, textColor: '#93a4c8' },
        grid: { vertLines: { color: '#1a2440' }, horzLines: { color: '#1a2440' } },
        width: this.chartRef.nativeElement.clientWidth, height: 340,
        timeScale: { borderColor: '#223053' }, rightPriceScale: { borderColor: '#223053' },
      });
    }
    while (this.series.length) { this.chart.removeSeries(this.series.pop()!); }
    rows.forEach((r, i) => {
      const line = this.chart!.addSeries(LineSeries, { color: PALETTE[i % PALETTE.length], lineWidth: 2 });
      line.setData(r.points.map((p: any) => ({ time: p.date, value: Number(p.value) })));
      this.series.push(line);
    });
    this.chart?.timeScale().fitContent();
  }
}
