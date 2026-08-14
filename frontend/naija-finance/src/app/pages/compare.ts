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
const INTERVALS = ['1W', '1M', '3M', '6M', '1Y'] as const;
type Interval = typeof INTERVALS[number];
const INTERVAL_DAYS: Record<Interval, number> = { '1W': 7, '1M': 30, '3M': 91, '6M': 182, '1Y': 365 };

interface CmpItem {
  key: string;
  label: string;
  sub: string;
  kind: 'fund' | 'bond' | 'cp' | 'fx';
  points: { date: string; value: number }[];
  stats: { k: string; v: string }[];
}

const PALETTE = ['#16c784', '#4e9bff', '#f59e0b', '#e0548b', '#a78bfa'];

@Component({
  selector: 'app-compare',
  imports: [CommonModule, FormsModule, RouterLink, EduCard],
  template: `
    <h2>{{ t('Compare', 'Kompare') }}</h2>
    <p class="sub">{{ t('Side-by-side yield (%) over a selected period — funds, bonds, commercial papers &amp; FX. Pick 2–5 assets.', 'Yield (%) wey dey side-by-side for di period wey you pick — fands, bonds, commercial paper &amp; FX. Pick 2–5 assets.') }}</p>
    <p class="sub" *ngIf="defaultHint()" style="color:var(--accent);font-size:12px;">{{ t('Showing a default comparison — search above to add or swap assets.', 'De dey show default komparison — sarch above make you add or swap assets.') }}</p>
    <p class="disclaimer">{{ perfNote }}</p>

    <div class="card" style="margin-bottom: 20px;">
      <div class="form-row" style="margin-bottom: 10px; position:relative;">
        <label style="font-size:12px;color:var(--txt2);font-weight:700;">{{ t('Add asset', 'Add asset') }}:</label>
        <input type="search" placeholder="{{ t('Type to search assets… e.g. Stanbic, FGN, USD/NGN', 'Type make e search assets… e.g. Stanbic, FGN, USD/NGN') }}" [(ngModel)]="q" name="cmpSearch" style="flex:1;min-width:220px;" (input)="onQuery()" (keydown)="onKey($event)" autocomplete="off">
        <div class="sugg-dd" *ngIf="suggestions().length" style="position:absolute; top:100%; left:0; right:0; z-index:20; background:var(--bg2,#121a2e); border:1px solid var(--line); border-radius:8px; margin-top:2px; max-height:260px; overflow:auto;">
          <button type="button" class="sugg" *ngFor="let s of suggestions(); let i = index" [class.on]="i === activeIndex()" (mousedown)="add(s.key)" style="display:flex; width:100%; justify-content:space-between; gap:10px; padding:8px 12px; background:none; border:0; cursor:pointer; color:inherit; font:inherit; text-align:left;">
            <span style="font-weight:700;">{{ s.label }}</span><span class="muted" style="font-size:11px;">{{ s.sub }} · {{ s.kind }}</span>
          </button>
        </div>
      </div>

      <div class="pill-row" style="margin-bottom: 10px; display:flex; gap:6px; flex-wrap:wrap;">
        <span class="pill" *ngFor="let k of selectedKeys(); let i = index" [style.border-color]="color(i)" style="cursor:pointer;" (click)="remove(k)" title="Remove">
          {{ labelOf(k) }} <span style="opacity:.6">✕</span>
        </span>
        <span class="muted" style="font-size:11.5px; align-self:center;" *ngIf="selectedKeys().length === 0">{{ t('No assets selected yet — add 2–5 above.', 'No asset wey you pick yet — add 2–5.') }}</span>
      </div>

      <div class="interval-row" style="margin-bottom: 10px; display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
        <span class="muted" style="font-size:12px;font-weight:700;">{{ t('Period:', 'Period:') }}</span>
        <button type="button" *ngFor="let iv of intervals()" class="pill interval" [class.active]="iv === interval()" (click)="setInterval(iv)" style="cursor:pointer;">{{ iv }}</button>
      </div>

      <div #chartRef style="width: 100%; height: 300px;"></div>
      <p class="loading" *ngIf="items().length === 0">{{ t('Loading…', 'De dey load…') }}</p>
    </div>

    <div class="table-wrap" *ngIf="pair().length >= 2">
      <h3>{{ t('Comparison table', 'Kompare table') }}</h3>
      <table class="data">
        <thead><tr><th>{{ t('Asset', 'Asset') }}</th><th class="num">{{ t('Yield (' + interval() + ')', 'Yield (' + interval() + ')') }}</th><th class="num">{{ t('Latest', 'Latest') }}</th><th class="num">{{ t('Yield/Coupon', 'Yield/Coupon') }}</th><th>{{ t('Class', 'Class') }}</th></tr></thead>
        <tbody>
          <tr *ngFor="let it of ranked()" [class]="rowClass(it)">
            <td class="sym">{{ it.label }} <small>{{ it.sub }}</small></td>
            <td class="num">{{ it.pct === null ? '—' : it.pct + '%' }}</td>
            <td class="num">{{ it.latest }}</td>
            <td class="num">{{ it.yieldStr }}</td>
            <td>{{ it.kind }}</td>
          </tr>
        </tbody>
      </table>
      <p class="muted" style="font-size:11px;">{{ t('Yield = % change over the selected period. Green = best, red = worst.', 'Yield na di % change for di period wey you pick. Green na best, red na worst.') }}</p>
      <p class="muted" style="font-size:11px;">{{ t('As of', 'As of') }} {{ asOf() }} — {{ t('sources: SEC NAV, DMO, CBN, fund publications.', 'sources: SEC NAV, DMO, CBN, fund publications.') }}</p>
    </div>

    <app-edu-card
      [moduleLabel]="t('Compare','Kompare')"
      [questions]="eduQuestions()"
      [defaultExpanded]="false"
      style="margin-top:18px; display:block;"
    ></app-edu-card>

    <p class="disc">⚠️ {{ t('Educational information only. Not investment advice.', 'Na educational information only. No be investment advice.') }}</p>
  `,
})
export class ComparePage implements OnInit, AfterViewInit {
  perfNote = PERF_NOTE;
  items = signal<CmpItem[]>([]);
  selected = signal<string[]>([]);
  q = '';
  suggestions = signal<CmpItem[]>([]);
  activeIndex = signal(-1);
  defaultsApplied = signal(false);
  interval = signal<Interval>('3M');
  intervals(): readonly Interval[] { return INTERVALS; }
  @ViewChild('chartRef') chartRef!: ElementRef;
  private chart: IChartApi | null = null;
  private series: ISeriesApi<'Line'>[] = [];
  constructor(private api: ApiService, private lang: LangService) {}

  get isPidgin() { return this.lang.isPidgin; }
  t(en: string, pidgin: string): string { return this.lang.t(en, pidgin); }

  onQuery() {
    const s = this.q.trim().toLowerCase();
    const pool = this.items().filter(i => !this.selectedKeys().includes(i.key));
    const list = s
      ? pool.filter(i => (i.label + ' ' + i.sub + ' ' + i.kind).toLowerCase().includes(s)).slice(0, 8)
      : pool.slice(0, 8);
    this.suggestions.set(list);
    this.activeIndex.set(-1);
  }
  onKey(e: KeyboardEvent) {
    const n = this.suggestions().length;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!n) return;
      let idx = this.activeIndex() + (e.key === 'ArrowDown' ? 1 : -1);
      if (idx < 0) idx = n - 1;
      if (idx >= n) idx = 0;
      this.activeIndex.set(idx);
    } else if (e.key === 'Enter') {
      const list = this.suggestions();
      const idx = this.activeIndex();
      const target = idx >= 0 && list[idx] ? list[idx] : list[0];
      if (target) { e.preventDefault(); this.add(target.key); }
    } else if (e.key === 'Escape') {
      this.suggestions.set([]);
    }
  }

  selectedKeys(): string[] { return this.selected(); }
  pair(): CmpItem[] { return this.selectedKeys().map(k => this.items().find(i => i.key === k)).filter(Boolean) as CmpItem[]; }
  color(i: number): string { return PALETTE[i % PALETTE.length]; }
  labelOf(k: string): string { return this.items().find(i => i.key === k)?.label ?? k; }
  defaultHint(): boolean { return this.defaultsApplied(); }
  setInterval(iv: Interval) { this.interval.set(iv); this.render(); }
  asOf(): string {
    const dates = this.pair().map(it => this.windowed(it.points).map(p => p.date)).flat().filter(Boolean);
    return dates.length ? dates.sort()[dates.length - 1] : '—';
  }

  private windowed(pts: { date: string; value: number }[]): { date: string; value: number }[] {
    if (!pts.length) return [];
    const days = INTERVAL_DAYS[this.interval()];
    const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    return pts.filter(p => p.date >= cutoff);
  }

  private applyDefaultsIfEmpty() {
    if (this.defaultsApplied() || this.selected().length) return;
    const all = this.items();
    if (all.length < 2) return;
    const withHistory = all.filter(i => i.points.length >= 2).sort((a, b) => b.points.length - a.points.length);
    const picks = withHistory.slice(0, 3);
    if (picks.length < 2) {
      const rest = all.filter(i => !picks.includes(i));
      picks.push(...rest.slice(0, 3 - picks.length));
    }
    if (picks.length >= 2) {
      this.selected.set(picks.slice(0, 5).map(p => p.key));
      this.defaultsApplied.set(true);
      this.render();
    }
  }

  add(key: string) {
    if (!key) return;
    const cur = this.selected();
    if (cur.includes(key)) return;
    if (cur.length >= 5) return;
    this.selected.set([...cur, key]);
    this.q = '';
    this.suggestions.set([]);
    this.activeIndex.set(-1);
    this.render();
  }
  remove(key: string) {
    this.selected.set(this.selected().filter(k => k !== key));
    this.render();
  }

  eduQuestions() { return EDU_CONTENT['compare']?.questions ?? []; }

  ranked(): (CmpItem & { pct: number | null; latest: string; yieldStr: string })[] {
    const list = this.pair();
    return list.map(it => {
      const pts = this.windowed(it.points);
      let pct: number | null = null;
      let latest = '—';
      if (pts.length >= 2) {
        const first = Number(pts[0].value), last = Number(pts[pts.length - 1].value);
        pct = first ? Math.round((last / first - 1) * 10000) / 100 : null;
        latest = String(last);
      } else if (pts.length === 1) {
        latest = String(pts[0].value);
      } else {
        const s = it.stats.find(x => x.k.toLowerCase().includes('nav') || x.k.toLowerCase().includes('price') || x.k.toLowerCase().includes('rate'));
        if (s) latest = s.v;
      }
      const y = it.stats.find(x => x.k.toLowerCase().includes('yield') || x.k.toLowerCase().includes('coupon'));
      const yieldStr = y ? y.v : '—';
      return { ...it, pct, latest, yieldStr };
    });
  }
  rowClass(it: any): string {
    const r = this.ranked().filter(x => x.pct !== null);
    if (r.length < 2) return '';
    const best = Math.max(...r.map(x => x.pct as number));
    const worst = Math.min(...r.map(x => x.pct as number));
    if (it.pct === best && best !== worst) return 'row-best';
    if (it.pct === worst) return 'row-worst';
    return '';
  }

  ngOnInit() {
    const all: CmpItem[] = [];
    const push = () => { this.items.set([...all]); this.applyDefaultsIfEmpty(); };
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
            { k: 'Coupon/Yield', v: b.coupon_rate ? b.coupon_rate + '%' : '—' },
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
            { k: 'Coupon/Yield', v: c.coupon_rate ? c.coupon_rate + '%' : '—' },
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

  private normPct(pts: { date: string; value: number }[]): { time: string; value: number }[] {
    const win = this.windowed(pts);
    if (win.length < 2) return [];
    const base = Number(win[0].value);
    if (!base) return [];
    return win.map(p => ({ time: p.date, value: Math.round((Number(p.value) / base - 1) * 10000) / 100 }));
  }

  private render() {
    if (!this.chartRef?.nativeElement) return;
    if (!this.chart) {
      this.chart = createChart(this.chartRef.nativeElement, {
        layout: { attributionLogo: false, background: { type: ColorType.Solid, color: '#121a2e' }, textColor: '#93a4c8' },
        grid: { vertLines: { color: '#1a2440' }, horzLines: { color: '#1a2440' } },
        width: this.chartRef.nativeElement.clientWidth, height: 300,
        timeScale: { borderColor: '#223053' }, rightPriceScale: { borderColor: '#223053' },
      });
    }
    for (const s of this.series) { try { this.chart?.removeSeries(s); } catch { /* noop */ } }
    this.series = [];
    this.pair().forEach((it, i) => {
      const pts = this.normPct(it.points);
      if (!pts.length) return;
      const s = this.chart!.addSeries(LineSeries, { color: this.color(i), lineWidth: 2 });
      s.setData(pts);
      this.series.push(s);
    });
    this.chart?.timeScale().fitContent();
  }
}
