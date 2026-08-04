import { Component, OnInit, AfterViewInit, ViewChild, ElementRef, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { createChart, AreaSeries, ColorType, IChartApi, ISeriesApi } from 'lightweight-charts';
import { ApiService } from '../api.service';
import { fmtMoney, fmtPct } from '../format';

const PERF_NOTE = 'Past performance ≠ future returns. Shown for information only.';

@Component({
  selector: 'app-asset-mix',
  imports: [CommonModule, RouterLink],
  template: `
    <h2>Asset Mix</h2>
    <p class="sub" *ngIf="card()">{{ card().visibility === 'private' ? 'Private mix · only you can view' : 'Shareable performance card · as of ' + card().asOf }}</p>
    <p class="sub" style="margin-top:-12px;font-weight:600;color:var(--warn,#d97706);" *ngIf="card() && card().visibility === 'private'">🔒 This mix is private — only you can see it. Make it public to share the link.</p>
    <p class="error" *ngIf="error">{{ error }}</p>

    <div class="card" style="margin-bottom: 20px;" *ngIf="authed && !token">
      <h3>Asset Mixes</h3>
      <table class="data">
        <thead><tr><th>Name</th><th class="num">Value</th><th class="num">Holdings</th><th>As of</th><th>Visibility</th><th></th></tr></thead>
        <tbody>
          <tr *ngFor="let m of mixes()">
            <td class="sym">{{ m.name }}</td>
            <td class="num">{{ fmt(m.totalValue) }}</td>
            <td class="num">{{ m.itemCount }}</td>
            <td class="muted">{{ m.asOf }}</td>
            <td>
              <span class="pill" [style.background]="m.visibility === 'public' ? 'var(--up-bg, rgba(22,199,132,.12))' : 'var(--bg2)'">{{ m.visibility === 'public' ? '🌍 Public' : '🔒 Private' }}</span>
            </td>
            <td>
              <a class="link" [routerLink]="['/asset-mix']" [queryParams]="{token: m.token}" style="margin-right:10px;">View insights</a>
              <button type="button" class="ghost" (click)="copyMix(m)" *ngIf="m.visibility === 'public'">Share</button>
              <button type="button" class="ghost" (click)="toggleMix(m)">{{ m.visibility === 'public' ? 'Make private' : 'Make public' }}</button>
            </td>
          </tr>
        </tbody>
      </table>
      <p class="loading" *ngIf="!mixes().length">No mixes yet — create one from the Portfolio page.</p>
    </div>

    <div class="card" style="margin-bottom: 20px;" *ngIf="card()">
      <button type="button" class="ghost" *ngIf="authed && !revoked()" (click)="revoke()">Stop sharing</button>
      <p class="error" *ngIf="revoked()">This Asset Mix link has been deactivated — sharing stopped.</p>
      <div class="stat-grid" style="margin-bottom: 0;">
        <div class="stat-tile">
          <div class="label">{{ card().name }}</div>
          <div class="value">{{ fmt(card().totalValue) }}</div>
          <div class="delta" *ngIf="yield() !== null" [class.up]="yield()! >= 0" [class.down]="yield()! < 0">{{ yield()! >= 0 ? '▲' : '▼' }} {{ yield() }}% ({{ periodLabel() }})</div>
          <div class="muted" style="font-size:11.5px;margin-top:6px;" *ngIf="card().creator">Mix by {{ card().creator }}</div>
          <div class="form-row" style="margin-top:10px;">
            <button type="button" (click)="copyLink()">📤 Share this mix</button>
          </div>
        </div>
        <div class="stat-tile" *ngFor="let it of card().items">
          <div class="label">{{ it.symbol }}</div>
          <div class="value" style="font-size:16px;">{{ fmt(it.value) }}</div>
          <div class="delta">{{ it.pct }}%</div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom: 20px;">
      <div class="form-row" style="margin-bottom: 10px;">
        <span class="pill" *ngFor="let p of periods" [class.g]="period === p.days" style="cursor:pointer;" (click)="loadPerformance(p.days)">{{ p.label }}</span>
        <span class="muted" style="font-size:11.5px;">Mix value over time</span>
      </div>
      <div #chartRef style="width: 100%; height: 260px;"></div>
      <p class="loading" *ngIf="!card() && !error">Loading…</p>
      <p class="disclaimer" style="margin:8px 0 0;">{{ perfNote }}</p>
    </div>
  `,
})
export class AssetMixPage implements OnInit, AfterViewInit {
  perfNote = PERF_NOTE;
  periods = [{ label: '1M', days: 30 }, { label: '3M', days: 90 }, { label: '6M', days: 180 }, { label: '1Y', days: 365 }];
  period = 90;
  card = signal<any>(null);
  mixes = signal<any[]>([]);
  yieldVal = signal<number | null>(null);
  revokedFlag = signal(false);
  error = '';
  token = '';
  @ViewChild('chartRef') chartRef!: ElementRef;
  private chart: IChartApi | null = null;
  private series: ISeriesApi<'Area'> | null = null;

  constructor(private api: ApiService, private route: ActivatedRoute) {}
  get authed() { return this.api.isAuthed; }
  revoked() { return this.revokedFlag(); }
  revoke() {
    this.api.revokeMix(this.token).subscribe({
      next: () => { this.revokedFlag.set(true); this.error = ''; },
      error: () => this.error = 'Revoke failed — only the owner can stop sharing this mix.',
    });
  }

  ngOnInit() {
    this.route.queryParams.subscribe(p => {
      this.token = p['token'] ?? '';
      if (!this.token) {
        if (this.api.isAuthed) { this.loadMixes(); return; }
        this.error = 'No Asset Mix token in the link.';
        return;
      }
      this.api.mixCard(this.token).subscribe({
        next: (c) => { this.card.set(c); this.error = ''; },
        error: () => this.error = 'Mix not found — the link may be invalid or expired.',
      });
      this.loadPerformance(this.period);
    });
  }

  loadMixes() {
    this.api.myMixes().subscribe({
      next: (m) => this.mixes.set(m ?? []),
      error: () => this.error = 'Could not load your mixes.',
    });
  }

  copyLink() {
    const url = `${location.origin}/asset-mix?token=${this.token}`;
    try {
      navigator.clipboard.writeText(url).then(() => { this.error = 'Mix link copied — paste into WhatsApp.'; });
    } catch {
      window.open(`https://wa.me/?text=${encodeURIComponent(`Check my Asset Mix → ${url}`)}`, '_blank');
    }
  }

  toggleMix(m: any) {
    const next = m.visibility === 'public' ? 'private' : 'public';
    this.api.setMixVisibility(m.token, next).subscribe({
      next: () => {
        m.visibility = next;
        this.error = next === 'public' ? 'Mix is now public — anyone with the link can view it.' : 'Mix is now private — only you can view it.';
      },
      error: () => this.error = 'Could not update mix visibility.',
    });
  }

  copyMix(m: any) {
    const url = `${location.origin}/asset-mix?token=${m.token}`;
    try {
      navigator.clipboard.writeText(url).then(() => { this.error = 'Mix link copied — paste into WhatsApp.'; });
    } catch {
      window.open(`https://wa.me/?text=${encodeURIComponent(`Check my Asset Mix → ${url}`)}`, '_blank');
    }
  }

  ngAfterViewInit() { if (this.token) this.loadPerformance(this.period); }

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

  fmt(n: number): string { return fmtMoney(n); }
}
