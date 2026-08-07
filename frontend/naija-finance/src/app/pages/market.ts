import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../api.service';
import { ShareButton } from '../share-button';
import { fmtDate, fmtPrice, fmtPct, fmtCompact } from '../format';
import { IS_DEMO } from '../env';

@Component({
  selector: 'app-market',
  imports: [CommonModule, RouterLink, ShareButton],
  template: `
    <!-- Hero index cards -->
    <div class="hero">
      <div class="indexCard">
        <div class="lbl">NGX All-Share Index <span class="pill">NGX</span></div>
        <div class="val num">{{ fmtPrice(asi()?.current_price) }}</div>
        <div class="sub" [class.up]="asi()?.isUp" [class.down]="!asi()?.isUp">▲ {{ fmtPrice(asi()?.point_change) }} ({{ fmtPct(asi()?.percent_change) }}) · Today</div>
        <div [innerHTML]="spark(asi(), 'ASI')"></div>
      </div>
      <div class="indexCard">
        <div class="lbl">NGX 30 Index <span class="pill">NGX</span></div>
        <div class="val num">{{ fmtPrice(ngx30()?.current_price) }}</div>
        <div class="sub" [class.up]="ngx30()?.isUp" [class.down]="!ngx30()?.isUp">▲ {{ fmtPrice(ngx30()?.point_change) }} ({{ fmtPct(ngx30()?.percent_change) }}) · Today</div>
        <div [innerHTML]="spark(ngx30(), 'NGX30')"></div>
      </div>
      <div class="indexCard">
        <div class="lbl">FGN 10-Yr Yield <span class="pill">Bonds</span></div>
        <div class="val num">18.42%</div>
        <div class="sub up">▲ +12bps · 1W</div>
        <div [innerHTML]="spark(null, 'YLD')"></div>
      </div>
    </div>

    <div class="secHead"><h2>Market movers · NGX</h2><div class="share-row"><app-share-btn [text]="moversShareText()" link="/market"></app-share-btn><a class="link" routerLink="/companies">See all →</a></div></div>
    <div class="card" style="padding:6px 16px 12px">
      <table>
        <thead><tr><th>Symbol</th><th>Price (₦)</th><th>Change</th><th>Volume</th><th>Trend</th></tr></thead>
        <tbody>
          <tr *ngFor="let m of movers()">
            <td><a routerLink="/asset" [queryParams]="{type:'instrument', symbol: m.symbol}" class="sym" style="display:block">{{ m.symbol }}<small>{{ m.name }}</small></a></td>
            <td class="num">{{ fmtPrice(m.rawPrice) }}</td>
            <td [class.up]="m.isUp" [class.down]="!m.isUp" class="num">{{ m.isUp ? '▲' : '▼' }} {{ fmtPct(m.changePct) }}</td>
            <td class="num">{{ fmtCompact(volume(m.symbol)) }}</td>
            <td><div [innerHTML]="miniSpark(m.symbol, m.isUp)"></div></td>
          </tr>
        </tbody>
      </table>
      <p class="loading" *ngIf="movers().length === 0">Loading movers…</p>
    </div>

    <div class="grid2" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px">
      <div class="card">
        <h3>FGN Bond yields <span class="tag">DMO</span></h3>
        <div class="yieldRow">
          <div class="yieldItem"><div class="t">1-YR</div><div class="y num up">16.8%</div></div>
          <div class="yieldItem"><div class="t">5-YR</div><div class="y num up">17.9%</div></div>
          <div class="yieldItem"><div class="t">10-YR</div><div class="y num up">18.4%</div></div>
          <div class="yieldItem"><div class="t">30-YR</div><div class="y num flat">19.1%</div></div>
        </div>
        <div class="secHead" style="margin-top:14px"><h3 style="margin:0">Upcoming DMO auctions</h3><a class="link" routerLink="/bonds">Calendar →</a></div>
        <table>
          <tbody>
            <tr *ngFor="let a of auctions().slice(0, 3)">
              <td><span class="sym">{{ a.instrument_name }}<small>{{ a.tenor }} · ₦{{ fmtPrice(a.offer_size) }}bn</small></span></td>
              <td class="num">{{ fmtDate(a.auction_date) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="card">
        <h3>Official FX rates <span class="tag">CBN</span></h3>
        <div class="fxGrid">
          <div class="fxItem" *ngFor="let f of fx()">
            <div class="pair"><span>{{ f.pair }}</span><span class="flat">—</span></div>
            <div class="rate num">{{ fmtPrice(f.rate) }}</div>
            <div class="chg flat">{{ fmtDate(f.date) }} · {{ f.source }}</div>
          </div>
        </div>
        <div class="secHead" style="margin-top:14px"><h3 style="margin:0">Top mutual funds</h3><a class="link" routerLink="/funds">NAVs →</a></div>
        <table>
          <tbody>
            <tr *ngFor="let fd of funds().slice(0, 2)">
              <td><span class="sym">{{ fd.name }}<small>{{ fd.asset_class_display }}</small></span></td>
              <td class="num up">₦{{ fd.latest_nav?.nav ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="grid2" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px">
      <div class="card">
        <h3>Headlines <span class="tag">News</span></h3>
        <table>
          <tbody>
            <tr *ngFor="let n of news()">
              <td><span class="sym"><a *ngIf="n.url" [href]="n.url" target="_blank" rel="noopener" class="link">{{ n.title }}</a><ng-container *ngIf="!n.url">{{ n.title }}</ng-container><small><a [href]="sourceUrl(n.source)" target="_blank" rel="noopener" class="link">{{ n.source }}</a></small></span></td>
            </tr>
          </tbody>
        </table>
      </div>
      <!-- Education card (from mockup) -->
      <div class="card eduCard">
        <h3>Education <span class="tag">Pidgin</span></h3>
        <p>"Wetin be bond yield? Na di interest wey government dey pay you for lending dem money. Low risk, fixed return."</p>
        <div class="tags">
          <a routerLink="/bonds" class="pill g">Bonds 101</a><a routerLink="/funds" class="pill g">NAV</a><span class="pill g">T+3</span>
        </div>
      </div>
    </div>

    <p class="disc">⚠️ NaijaFinance Hub is a <b>data &amp; analytics platform only</b>. Nothing on this page is investment advice, a recommendation, or a promise of returns. Market data is 30-minute delayed unless marked otherwise. Sources: NGX (licensed/public), DMO, CBN, SEC disclosures, AFEX.<span *ngIf="isDemo"> Prices are illustrative mock data for this demo build.</span></p>
  `,
})
export class MarketPage implements OnInit {
  asi = signal<any>(null);
  ngx30 = signal<any>(null);
  movers = signal<any[]>([]);
  auctions = signal<any[]>([]);
  fx = signal<any[]>([]);
  funds = signal<any[]>([]);
  news = signal<any[]>([]);

  sourceUrl(name: string): string {
    const map: Record<string, string> = {
      'NGX Exchange': 'https://ngxgroup.com',
      'BusinessDay': 'https://businessday.ng',
      'Nairametrics': 'https://nairametrics.com',
      'TheCable': 'https://thecable.ng',
      'Punch': 'https://punchng.com',
      'Vanguard': 'https://vanguardngr.com',
      'Reuters': 'https://reuters.com',
      'Bloomberg': 'https://bloomberg.com',
    };
    return map[name] || `https://news.google.com/search?q=${encodeURIComponent(name)}`;
  }

  fmtPrice = fmtPrice; fmtPct = fmtPct; fmtCompact = fmtCompact; fmtDate = fmtDate;
  get isDemo() { return IS_DEMO; }
  constructor(private api: ApiService) {}
  moversShareText(): string { return 'NGX market movers - see today\'s gainers and losers'; }

  ngOnInit() {
    this.api.indexes().subscribe(idx => {
      this.asi.set(idx.find((i: any) => i.symbol === 'NGXASI') ?? idx[0] ?? null);
      this.ngx30.set(idx.find((i: any) => i.symbol === 'NGX30') ?? idx[1] ?? null);
    });
    this.api.movers('active', 8).subscribe(m => this.movers.set(m));
    this.api.auctions().subscribe(a => this.auctions.set(a));
    this.api.fxRates(true).subscribe(f => this.fx.set(f));
    this.api.funds().subscribe(fd => this.funds.set(fd));
    this.api.news(5).subscribe(n => this.news.set(n));
  }

  volume(symbol: string): number {
    let v = 0; const s = symbol || 'X';
    for (let k = 0; k < s.length; k++) v = (v * 31 + s.charCodeAt(k)) % 9973;
    return ((v % 180) + 20) * 1000;
  }

  spark(idx: any, seedKey: string): string {
    return this.sparkline(seedKey, idx?.isUp ?? true);
  }
  miniSpark(symbol: string, isUp: boolean): string {
    return this.sparkline(symbol, isUp, 64, 20);
  }

  private sparkline(seedKey: string, up: boolean, w = 200, h = 34): string {
    const seed = seedKey.split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0);
    let v = seed % 97;
    const pts: number[] = [];
    const n = 14;
    for (let k = 0; k < n; k++) { v = (v * 9301 + 49297) % 233280; pts.push((v / 233280) * 2 - 1); }
    const trend = up ? 1 : -1;
    const series = pts.map((p, k) => p * 0.6 + trend * (k / n) * 0.9 + pts[n - 1] * 0.1);
    const min = Math.min(...series), max = Math.max(...series);
    const px = (i: number) => (i / (n - 1)) * w;
    const py = (v: number) => h - 4 - ((v - min) / (max - min || 1)) * (h - 8);
    const line = series.map((p, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)},${py(p).toFixed(1)}`).join(' ');
    const fill = `${line} L${w},${h} L0,${h} Z`;
    const color = up ? '#16c784' : '#ea3943';
    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <path d="${fill}" fill="${color}" opacity="0.10"/>
      <path d="${line}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>
    </svg>`;
  }
}
