import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { createChart, AreaSeries, ColorType, IChartApi, ISeriesApi } from 'lightweight-charts';
import { ApiService } from '../api.service';
import { LangService } from '../lang.service';
import { EduCard } from '../edu-card';
import { ShareButton } from '../share-button';
import { ChartImgShareButton } from '../chart-share-img';
import { EDU_CONTENT } from '../edu-content';

const PERF_NOTE = 'Past performance ≠ future returns. Shown for information only.';

interface BuilderRow {
  kind: 'bond' | 'cp' | 'fund' | 'stock';
  symbol: string | null;
  fundId: number | null;
  label: string;
  value: number;
}

@Component({
  selector: 'app-asset-mix',
  imports: [ChartImgShareButton, CommonModule, FormsModule, RouterLink, EduCard, ShareButton],
  template: `
    <h2>{{ t('My Asset Mix', 'My Aset Mix') }}</h2>
    <p class="sub" *ngIf="card()">{{ t('Shareable performance card · as of', 'Shareable performance card · as of') }} {{ card().asOf }}</p>
    <p class="error" *ngIf="error">{{ error }}</p>
    <p class="loading" *ngIf="loading">{{ t('Loading…', 'De load…') }}</p>

    <app-edu-card
      moduleLabel="Asset Mix"
      [questions]="edu['assetMix'].questions"
      [defaultExpanded]="edu['assetMix'].defaultExpanded"
    ></app-edu-card>

    <!-- Share card -->
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

    <div class="card" style="margin-bottom: 20px;" *ngIf="card()">
      <div class="form-row" style="margin-bottom: 10px;">
        <span class="pill" *ngFor="let p of periods" [class.g]="period === p.days" style="cursor:pointer;" (click)="loadPerformance(p.days)">{{ p.label }}</span>
        <span class="muted" style="font-size:11.5px;">{{ t('Mix value over time', 'Mix value over time') }}</span>
        <span style="flex:1"></span>
        <app-share-btn [text]="'Asset Mix — ' + (card()?.name ?? '')" [link]="'/asset-mix' + (token ? '?token=' + token : '')"></app-share-btn>
        <app-chart-img-share [chart]="chart" [title]="'Asset Mix — ' + (card()?.name ?? '')" [link]="'/asset-mix' + (token ? '?token=' + token : '')"></app-chart-img-share>
      </div>
      <div #chartRef style="width: 100%; height: 260px;"></div>
      <p class="disclaimer" style="margin:8px 0 0;">{{ perfNote }}</p>
    </div>

    <!-- Not signed in -->
    <div class="card" style="margin-bottom: 20px;" *ngIf="!isAuthed && !card()">
      <p style="margin:0 0 12px;">{{ t('Sign in to create and manage your Asset Mixes.', 'Sign in make you create and manage your Aset Mix.') }}</p>
      <button type="button" class="ghost" routerLink="/account" style="display:inline-flex;align-items:center;gap:8px;">👤 {{ t('Go to Account', 'Go to Account') }} →</button>
    </div>

    <!-- Builder (signed in) -->
    <div class="card" style="margin-bottom: 20px;" *ngIf="isAuthed && !card()">
      <h3 style="margin:0 0 10px;">{{ t('Create Asset Mix', 'Make Aset Mix') }}</h3>
      <div class="form-row" style="margin-bottom: 10px;">
        <input type="text" placeholder="{{ t('Mix name (e.g. My 2026 Growth Mix)', 'Mix name (e.g. My 2026 Growth Mix)') }}" [(ngModel)]="builder.name" name="bname" style="flex:1;min-width:180px;">
        <select [(ngModel)]="builder.visibility" name="bvis">
          <option value="public">🌍 {{ t('Public — anyone can view', 'Public — anybody fit see am') }}</option>
          <option value="private">🔒 {{ t('Private — only you', 'Private — only you') }}</option>
        </select>
        <button type="button" class="ghost" (click)="addRow()">+ {{ t('Add asset', 'Add aset') }}</button>
      </div>
      <div class="form-row" style="margin-bottom: 8px; flex-wrap: wrap;" *ngFor="let r of builder.rows; let i = index">
        <div style="position:relative; flex:1; min-width:200px;">
          <input type="text" placeholder="{{ t('Search bond, CP, fund or stock…', 'Sarch bond, CP, fund or stok…') }}" [(ngModel)]="r.label" [name]="'bq'+i" (input)="onRowQuery(i)" (focus)="onRowQuery(i)" (keydown)="onRowKey($event, i)" autocomplete="off">
          <div class="sugg-dd" *ngIf="activeRow() === i && suggestions().length">
            <button type="button" class="sugg" *ngFor="let sg of suggestions(); let j = index" [class.on]="j === activeIndex()" (mousedown)="pickRow(i, sg)">
              <span class="s">{{ sg.label }}</span><span class="n">{{ sg.sub }}</span><span class="t">{{ sg.kind }}</span>
            </button>
          </div>
        </div>
        <input type="number" step="any" min="1" placeholder="₦" [(ngModel)]="r.value" [name]="'bval'+i" style="width: 120px;">
        <button type="button" class="ghost" (click)="builder.rows.splice(i,1)" *ngIf="builder.rows.length > 1">✕</button>
      </div>
      <button type="button" (click)="createMix()" [disabled]="creating">{{ creating ? t('Creating…', 'De create…') : t('Create mix', 'Make mix') }}</button>
      <p class="muted" style="font-size:11.5px;margin-top:6px;">{{ t('Bonds, commercial papers, funds and stocks — values at the latest published price/NAV.', 'Bonds, commercial paper, funds and stoks — values at di latest price/NAV wey dem publish.') }}</p>
    </div>

    <!-- My Mixes (signed in) -->
    <div class="card" style="margin-bottom: 20px;" *ngIf="isAuthed && myMixes().length">
      <h3 style="margin:0 0 10px;">{{ t('My Mixes', 'My Mix-Dem') }} <span class="tag">{{ myMixes().length }}</span></h3>
      <div class="form-row" *ngFor="let m of myMixes()" style="justify-content:space-between;gap:8px;border-top:1px solid var(--line);padding:8px 0;">
        <div>
          <div class="label">{{ m.name }} <span class="pill" [class.g]="m.visibility === 'public'">{{ m.visibility === 'public' ? '🌍 ' + t('public', 'public') : '🔒 ' + t('private', 'private') }}</span></div>
          <div class="muted" style="font-size:11.5px;">{{ fmt(m.totalValue) }} · {{ m.itemCount }} {{ t('assets', 'asets') }} · {{ m.asOf }}</div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;">
          <a class="link" [routerLink]="'/asset-mix'" [queryParams]="{token: m.token}">{{ t('Open', 'Open') }}</a>
          <button type="button" class="ghost" (click)="toggleVis(m)">{{ m.visibility === 'public' ? t('Make private', 'Make am private') : t('Make public', 'Make am public') }}</button>
          <button type="button" class="ghost" style="color:var(--danger,#ef4444);" (click)="revoke(m)">{{ t('Revoke', 'Kanso') }}</button>
        </div>
      </div>
    </div>

    <!-- Public gallery -->
    <div class="card" style="margin-bottom: 20px;" *ngIf="pubMixes().length">
      <h3 style="margin:0 0 10px;">{{ t('Public mixes', 'Public mix-dem') }} <span class="tag">{{ pubMixes().length }}</span></h3>
      <div class="grid2" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div class="stat-tile" *ngFor="let m of pubMixes()" style="border:1px solid var(--line);border-radius:10px;padding:12px;">
          <div class="label">{{ m.name }}</div>
          <div class="muted" style="font-size:11.5px;">{{ t('by', 'by') }} {{ m.creator }} · {{ fmt(m.totalValue) }} · {{ m.asOf }}</div>
          <div style="margin:8px 0;display:flex;flex-direction:column;gap:4px;">
            <div *ngFor="let it of (m.items || [])" style="display:flex;justify-content:space-between;gap:8px;font-size:12px;">
              <span>{{ it.symbol }}</span><span class="muted">{{ it.pct ?? it.percent ?? '' }}{{ (it.pct !== undefined || it.percent !== undefined) ? '%' : '' }}</span>
            </div>
          </div>
          <a class="link" style="font-size:12px;" [routerLink]="'/asset-mix'" [queryParams]="{token: m.token}">{{ t('View mix →', 'See mix →') }}</a>
        </div>
      </div>
    </div>
  `,
})
export class AssetMixPage implements OnInit, AfterViewInit {
  edu = EDU_CONTENT;
  perfNote = PERF_NOTE;
  periods = [{ label: '1M', days: 30 }, { label: '3M', days: 90 }, { label: '6M', days: 180 }, { label: '1Y', days: 365 }];
  period = 90;
  card = signal<any>(null);
  yieldVal = signal<number | null>(null);
  error = '';
  loading = false;
  creating = false;
  token = '';
  bonds = signal<any[]>([]);
  cps = signal<any[]>([]);
  funds = signal<any[]>([]);
  stocks = signal<any[]>([]);
  myMixes = signal<any[]>([]);
  pubMixes = signal<any[]>([]);
  builder: { name: string; visibility: string; rows: BuilderRow[] } = { name: '', visibility: 'public', rows: [{ kind: 'bond', symbol: null, fundId: null, label: '', value: 0 }] };
  activeRow = signal<number | null>(null);
  suggestions = signal<any[]>([]);
  activeIndex = signal(-1);
  @ViewChild('chartRef') chartRef!: ElementRef;
  chart: IChartApi | null = null;
  private series: ISeriesApi<'Area'> | null = null;

  constructor(private api: ApiService, private route: ActivatedRoute, private lang: LangService) {}
  get isPidgin() { return this.lang.isPidgin; }
  t(en: string, pidgin: string): string { return this.lang.t(en, pidgin); }

  get isAuthed() { return this.api.isAuthed; }
  bondCps(): any[] { return [...this.bonds(), ...this.cps()]; }

  ngOnInit() {
    // Load picker lists
    this.api.bonds().subscribe(bs => this.bonds.set(bs));
    this.api.commercialPapers().subscribe(cs => this.cps.set(cs));
    this.api.funds().subscribe(fs => this.funds.set(fs));
    this.api.instruments().subscribe(ins => this.stocks.set(ins.filter((x: any) => (x.asset_type ?? '').toLowerCase().includes('equity'))));
    // Public gallery always
    this.api.publicMixes('').subscribe(mx => this.pubMixes.set(mx), () => {});
    // My mixes when authed
    if (this.api.isAuthed) {
      this.api.myMixes('').subscribe(mx => this.myMixes.set(mx), () => {});
    }

    this.route.queryParams.subscribe(p => {
      this.token = p['token'] ?? '';
      if (this.token) {
        this.loading = false;
        this.api.mixCard(this.token).subscribe({
          next: (c) => { this.card.set(c); this.error = ''; },
          error: () => this.error = 'Mix not found — the link may be invalid or expired.',
        });
        this.loadPerformance(this.period);
      }
    });
  }

  ngAfterViewInit() { if (this.token) setTimeout(() => this.loadPerformance(this.period), 0); }

  addRow() { this.builder.rows.push({ kind: 'bond', symbol: null, fundId: null, label: '', value: 0 }); }

  onRowQuery(i: number) {
    this.activeRow.set(i);
    const q = (this.builder.rows[i]?.label ?? '').trim().toLowerCase();
    const out: any[] = [];
    if (q) {
      for (const x of this.bondCps()) {
        if ((x.symbol ?? '').toLowerCase().includes(q) || (x.name ?? '').toLowerCase().includes(q)) {
          const at = (x.asset_type ?? '').toLowerCase();
          out.push({ label: x.symbol, sub: x.name, kind: at.includes('commercial paper') ? 'cp' : 'bond', symbol: x.symbol, fundId: null });
        }
      }
      for (const f of this.funds()) {
        if ((f.name ?? '').toLowerCase().includes(q) || (f.manager ?? '').toLowerCase().includes(q)) {
          out.push({ label: f.name, sub: f.asset_class_display, kind: 'fund', symbol: null, fundId: f.id });
        }
      }
      for (const s of this.stocks()) {
        if ((s.symbol ?? '').toLowerCase().includes(q) || (s.name ?? '').toLowerCase().includes(q)) {
          out.push({ label: s.symbol, sub: s.name, kind: 'stock', symbol: s.symbol, fundId: null });
        }
      }
    }
    this.suggestions.set(out.slice(0, 8));
    this.activeIndex.set(-1);
  }

  onRowKey(e: KeyboardEvent, i: number) {
    const n = this.suggestions().length;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!n) return;
      e.preventDefault();
      let idx = this.activeIndex() + (e.key === 'ArrowDown' ? 1 : -1);
      if (idx < 0) idx = n - 1;
      if (idx >= n) idx = 0;
      this.activeIndex.set(idx);
    } else if (e.key === 'Enter') {
      const list = this.suggestions();
      const idx = this.activeIndex();
      const target = idx >= 0 && list[idx] ? list[idx] : list[0];
      if (target) { e.preventDefault(); this.pickRow(i, target); }
    } else if (e.key === 'Escape') {
      this.suggestions.set([]);
    }
  }

  pickRow(i: number, sg: any) {
    const r = this.builder.rows[i];
    if (!r) return;
    r.kind = sg.kind;
    r.symbol = sg.symbol;
    r.fundId = sg.fundId;
    r.label = sg.label;
    this.activeRow.set(null);
    this.suggestions.set([]);
    this.activeIndex.set(-1);
  }

  createMix() {
    const name = this.builder.name.trim();
    if (!name) { this.error = 'Give your mix a name.'; return; }
    const items: any[] = [];
    for (const r of this.builder.rows) {
      const value = Number(r.value);
      if (!value || value <= 0) continue;
      if (r.kind === 'fund') {
        if (!r.fundId) continue;
        items.push({ fund_id: r.fundId, value });
      } else {
        if (!r.symbol) continue;
        items.push({ symbol: r.symbol, value });
      }
    }
    if (!items.length) { this.error = 'Add at least one asset with a value.'; return; }
    this.creating = true;
    this.error = '';
    this.api.createStandaloneMix({ name, visibility: this.builder.visibility, items }).subscribe({
      next: (r) => {
        this.creating = false;
        this.token = r?.token ?? '';
        if (this.token) {
          this.builder = { name: '', visibility: 'public', rows: [{ kind: 'bond', symbol: null, fundId: null, label: '', value: 0 }] };
          this.api.mixCard(this.token).subscribe({
            next: (c) => { this.card.set(c); this.error = ''; },
            error: () => this.error = 'Could not load your mix.',
          });
          this.loadPerformance(this.period);
          this.api.myMixes('').subscribe(mx => this.myMixes.set(mx), () => {});
        }
      },
      error: (e) => { this.creating = false; this.error = e?.error?.detail || 'Could not create your mix.'; },
    });
  }

  toggleVis(m: any) {
    const next = m.visibility === 'public' ? 'private' : 'public';
    this.api.setMixVisibility(m.token, next).subscribe({
      next: () => this.api.myMixes('').subscribe(mx => this.myMixes.set(mx), () => {}),
      error: () => this.error = 'Could not change visibility.',
    });
  }

  revoke(m: any) {
    if (!confirm('Revoke this Asset Mix? The share link will stop working.')) return;
    this.api.revokeMix(m.token).subscribe({
      next: () => this.api.myMixes('').subscribe(mx => this.myMixes.set(mx), () => {}),
      error: () => this.error = 'Could not revoke mix.',
    });
  }

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
        layout: { attributionLogo: false, background: { type: ColorType.Solid, color: '#121a2e' }, textColor: '#93a4c8' },
        grid: { vertLines: { color: '#1a2440' }, horzLines: { color: '#1a2440' } },
        autoSize: true,
        height: 260,
        timeScale: { borderColor: '#223053' }, rightPriceScale: { borderColor: '#223053' },
      });
      this.series = this.chart.addSeries(AreaSeries, { lineColor: '#4e9bff', topColor: 'rgba(78,155,255,0.3)', bottomColor: 'rgba(78,155,255,0.02)', lineWidth: 2 });
    }
    this.series?.setData(pts.map(p => ({ time: p.date, value: Number(p.value) })));
    this.chart?.timeScale().fitContent();
  }

  fmt(n: number): string {
    const v = Number(n ?? 0);
    return v >= 1e9 ? `₦${(v / 1e9).toFixed(2)}bn` : `₦${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }
}
