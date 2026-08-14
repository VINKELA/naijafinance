import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { createChart, AreaSeries, ColorType, IChartApi, ISeriesApi } from 'lightweight-charts';
import { ApiService } from '../api.service';
import { LangService } from '../lang.service';
import { EduCard } from '../edu-card';
import { EDU_CONTENT } from '../edu-content';

const PERF_NOTE = 'Past performance ≠ future returns. Shown for information only.';

interface BuilderRow {
  kind: 'bond' | 'cp' | 'fund';
  symbol: string | null;
  fundId: number | null;
  value: number;
}

@Component({
  selector: 'app-asset-mix',
  imports: [CommonModule, FormsModule, RouterLink, EduCard],
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
      </div>
      <div #chartRef style="width: 100%; height: 260px;"></div>
      <p class="disclaimer" style="margin:8px 0 0;">{{ perfNote }}</p>
    </div>

    <!-- Not signed in -->
    <div class="card" style="margin-bottom: 20px;" *ngIf="!isAuthed && !card()">
      <p>{{ t('Sign in to create and manage your Asset Mixes.', 'Sign in make you create and manage your Aset Mix.') }} <a routerLink="/account" class="link">{{ t('Go to Account →', 'Go to Account →') }}</a></p>
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
        <select [(ngModel)]="r.kind" [name]="'bkind'+i" style="width: 110px;">
          <option value="bond">{{ t('Bond', 'Bond') }}</option>
          <option value="cp">{{ t('CP', 'CP') }}</option>
          <option value="fund">{{ t('Fund', 'Fund') }}</option>
        </select>
        <select *ngIf="r.kind !== 'fund'" [(ngModel)]="r.symbol" [name]="'bsym'+i" style="flex:1;min-width:180px;">
          <option [ngValue]="null" disabled>{{ t('Select bond / CP…', 'Select bond / CP…') }}</option>
          <option *ngFor="let x of bondCps()" [ngValue]="x.symbol">{{ x.symbol }} — {{ x.name }}</option>
        </select>
        <select *ngIf="r.kind === 'fund'" [(ngModel)]="r.fundId" [name]="'bfund'+i" style="flex:1;min-width:180px;">
          <option [ngValue]="null" disabled>{{ t('Select fund…', 'Select fund…') }}</option>
          <option *ngFor="let f of funds()" [ngValue]="f.id">{{ f.name }} ({{ f.asset_class_display }})</option>
        </select>
        <input type="number" step="any" min="1" placeholder="₦" [(ngModel)]="r.value" [name]="'bval'+i" style="width: 120px;">
        <button type="button" class="ghost" (click)="builder.rows.splice(i,1)" *ngIf="builder.rows.length > 1">✕</button>
      </div>
      <button type="button" (click)="createMix()" [disabled]="creating">{{ creating ? t('Creating…', 'De create…') : t('Create mix', 'Make mix') }}</button>
      <p class="muted" style="font-size:11.5px;margin-top:6px;">{{ t('Bonds, commercial papers and funds only — no stocks (NGX licence pending).', 'Bonds, commercial paper and funds only — no stocks (NGX licence dey come).') }}</p>
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
        <div class="stat-tile" *ngFor="let m of pubMixes()" style="border:1px solid var(--line);border-radius:10px;padding:10px;">
          <div class="label">{{ m.name }}</div>
          <div class="muted" style="font-size:11.5px;">{{ t('by', 'by') }} {{ m.creator }} · {{ fmt(m.totalValue) }} · {{ m.itemCount }} {{ t('assets', 'asets') }}</div>
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
  myMixes = signal<any[]>([]);
  pubMixes = signal<any[]>([]);
  builder: { name: string; visibility: string; rows: BuilderRow[] } = { name: '', visibility: 'public', rows: [{ kind: 'bond', symbol: null, fundId: null, value: 0 }] };
  @ViewChild('chartRef') chartRef!: ElementRef;
  private chart: IChartApi | null = null;
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

  addRow() { this.builder.rows.push({ kind: 'bond', symbol: null, fundId: null, value: 0 }); }

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
          this.builder = { name: '', visibility: 'public', rows: [{ kind: 'bond', symbol: null, fundId: null, value: 0 }] };
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
        width: this.chartRef.nativeElement.clientWidth, height: 260,
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
