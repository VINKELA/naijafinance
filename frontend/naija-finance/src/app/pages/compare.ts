import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { createChart, LineSeries, ColorType, IChartApi, ISeriesApi } from 'lightweight-charts';
import { ApiService } from '../api.service';
import { LangService } from '../lang.service';
import { EduCard } from '../edu-card';
import { EDU_CONTENT } from '../edu-content';

const PERF_NOTE = 'Past performance ≠ future returns. Shown for information only.';

interface CmpItem {
  key: string;
  label: string;
  sub: string;
  kind: 'fund' | 'bond' | 'cp' | 'fx';
  points: { date: string; value: number }[];
  stats: { k: string; v: string }[];
}

@Component({
  selector: 'app-compare',
  imports: [CommonModule, FormsModule, RouterLink, EduCard],
  template: `
    <h2>{{ t('Compare', 'Kompare') }}</h2>
    <p class="sub">{{ t('Side-by-side NAV / price history overlay for funds, bonds, commercial papers &amp; FX.', 'NAV / price history wey dey side-by-side for fands, bonds, commercial paper &amp; FX.') }}</p>
    <p class="disclaimer">{{ perfNote }}</p>

    <app-edu-card
      moduleLabel="Compare"
      [questions]="edu['compare'].questions"
      [defaultExpanded]="edu['compare'].defaultExpanded"
    ></app-edu-card>

    <div class="card" style="margin-bottom: 20px;">
      <input type="search" placeholder="Search funds, bonds, commercial papers, FX…" [(ngModel)]="q" name="cmpSearch" style="width:100%;margin-bottom:10px;">
      <div class="form-row" style="margin-bottom: 10px;">
        <label style="font-size:12px;color:var(--txt2);font-weight:700;">Asset A:</label>
        <select [(ngModel)]="keyA" name="cmpA" style="flex:1;min-width:180px;" (ngModelChange)="rebuild()">
          <option *ngFor="let i of filteredItems()" [ngValue]="i.key">{{ i.label }} — {{ i.sub }}</option>
        </select>
        <label style="font-size:12px;color:var(--txt2);font-weight:700;margin-left:10px;">Asset B:</label>
        <select [(ngModel)]="keyB" name="cmpB" style="flex:1;min-width:180px;" (ngModelChange)="rebuild()">
          <option *ngFor="let i of filteredItems()" [ngValue]="i.key">{{ i.label }} — {{ i.sub }}</option>
        </select>
      </div>
      <div #chartRef style="width: 100%; height: 280px;"></div>
      <p class="loading" *ngIf="items().length === 0">Loading…</p>
    </div>

    <div class="grid2" style="display:grid;grid-template-columns:1fr 1fr;gap:16px" *ngIf="pair().length">
      <div class="card" *ngFor="let it of pair()">
        <h3 style="margin:0 0 10px;">{{ it.label }} <span class="tag">{{ it.kind }}</span></h3>
        <table class="data">
          <tbody>
            <tr *ngFor="let s of it.stats"><td class="muted">{{ s.k }}</td><td class="num">{{ s.v }}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
    <p class="disc">⚠️ Educational information only. Not investment advice.</p>
  `,
})
export class ComparePage implements OnInit, AfterViewInit {
  edu = EDU_CONTENT;
  perfNote = PERF_NOTE;
  items = signal<CmpItem[]>([]);
  q = '';
  keyA = '';
  keyB = '';
  @ViewChild('chartRef') chartRef!: ElementRef;
  private chart: IChartApi | null = null;
  private series: ISeriesApi<'Line'>[] = [];
  constructor(private api: ApiService, private lang: LangService) {}
  get isPidgin() { return this.lang.isPidgin; }
  t(en: string, pidgin: string): string { return this.lang.t(en, pidgin); }

  a(): CmpItem | null { return this.items().find(i => i.key === this.keyA) ?? null; }
  b(): CmpItem | null { return this.items().find(i => i.key === this.keyB) ?? null; }
  pair(): CmpItem[] { const a = this.a(), b = this.b(); return a && b ? [a, b] : []; }
  filteredItems(): CmpItem[] {
    const s = this.q.trim().toLowerCase();
    if (!s) return this.items();
    return this.items().filter(i => (i.label + ' ' + i.sub + ' ' + i.kind).toLowerCase().includes(s));
  }

  ngOnInit() {
    const all: CmpItem[] = [];
    const push = () => { this.items.set([...all]); this.defaultKeys(); };
    this.api.funds().subscribe(fs => {
      for (const f of fs) {
        const pts = (f.nav_history ?? []).slice().sort((x: any, y: any) => x.date.localeCompare(y.date)).map((p: any) => ({ date: p.date, value: Number(p.nav) }));
        all.push({
          key: 'fund:' + f.id, label: f.name, sub: f.asset_class_display, kind: 'fund', points: pts,
          stats: [
            { k: 'Manager', v: f.manager ?? '—' },
            { k: 'Class', v: f.asset_class_display },
            { k: 'Latest NAV', v: f.latest_nav?.nav ?? '—' },
            { k: 'NAV date', v: f.latest_nav?.date ?? '—' },
            { k: 'History points', v: String(pts.length) },
          ],
        });
      }
      push();
    });
    this.api.bonds().subscribe(bs => {
      for (const b of bs) {
        all.push({
          key: 'bond:' + b.symbol, label: b.symbol, sub: b.name, kind: 'bond', points: [],
          stats: [
            { k: 'Name', v: b.name },
            { k: 'Coupon', v: b.coupon_rate ? b.coupon_rate + '%' : '—' },
            { k: 'Maturity', v: b.maturity_date ?? '—' },
            { k: 'Price', v: b.last_price ?? '—' },
          ],
        });
      }
      push();
    });
    this.api.commercialPapers().subscribe(cs => {
      for (const c of cs) {
        all.push({
          key: 'cp:' + c.symbol, label: c.symbol, sub: c.name, kind: 'cp', points: [],
          stats: [
            { k: 'Name', v: c.name },
            { k: 'Discount rate', v: c.coupon_rate ? c.coupon_rate + '%' : '—' },
            { k: 'Maturity', v: c.maturity_date ?? '—' },
            { k: 'Price', v: c.last_price ?? '—' },
          ],
        });
      }
      push();
    });
    this.api.fxRates(true).subscribe(fs => {
      for (const r of fs) {
        all.push({
          key: 'fx:' + r.pair, label: r.pair, sub: r.source, kind: 'fx', points: [],
          stats: [
            { k: 'Pair', v: r.pair },
            { k: 'Rate', v: r.rate },
            { k: 'Date', v: r.date },
            { k: 'Source', v: r.source },
          ],
        });
      }
      push();
    });
  }

  ngAfterViewInit() { setTimeout(() => this.render(), 0); }

  private defaultKeys() {
    const all = this.items();
    if (!all.length) return;
    if (!this.keyA) this.keyA = all[0].key;
    if (!this.keyB) this.keyB = (all.find(i => i.kind !== all[0].kind) ?? all[1] ?? all[0]).key;
    this.render();
  }

  rebuild() { this.render(); }

  private norm(pts: { date: string; value: number }[]): { time: string; value: number }[] {
    const base = pts.length ? pts[0].value : 1;
    return pts.map(p => ({ time: p.date, value: base ? Math.round((p.value / base) * 10000) / 100 : 0 }));
  }

  private render() {
    if (!this.chartRef?.nativeElement) return;
    const a = this.a(), b = this.b();
    if (!this.chart) {
      this.chart = createChart(this.chartRef.nativeElement, {
        layout: { background: { type: ColorType.Solid, color: '#121a2e' }, textColor: '#93a4c8' },
        grid: { vertLines: { color: '#1a2440' }, horzLines: { color: '#1a2440' } },
        width: this.chartRef.nativeElement.clientWidth, height: 280,
        timeScale: { borderColor: '#223053' }, rightPriceScale: { borderColor: '#223053' },
      });
    }
    for (const s of this.series) { try { this.chart?.removeSeries(s); } catch { /* noop */ } }
    this.series = [];
    const colors = ['#16c784', '#4e9bff'];
    const add = (it: CmpItem | null, color: string) => {
      if (!it) return;
      const pts = this.norm(it.points);
      if (!pts.length) return;
      const s = this.chart!.addSeries(LineSeries, { color, lineWidth: 2 });
      s.setData(pts);
      this.series.push(s);
    };
    add(a, colors[0]);
    add(b, colors[1]);
    this.chart?.timeScale().fitContent();
  }
}
