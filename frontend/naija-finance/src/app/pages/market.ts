import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../api.service';
import { ShareButton } from '../share-button';
import { EduCard } from '../edu-card';
import { EDU_CONTENT } from '../edu-content';

@Component({
  selector: 'app-market',
  imports: [CommonModule, FormsModule, RouterLink, ShareButton, EduCard],
  template: `
    <!-- Bond yields hero -->
    <div class="hero">
      <div class="indexCard">
        <div class="lbl">FGN 10-Yr Yield <span class="pill">Bonds</span></div>
        <div class="val num">18.42%</div>
        <div class="sub up">▲ +12bps · 1W</div>
        <div [innerHTML]="spark(null, 'YLD')"></div>
      </div>
      <div class="indexCard">
        <div class="lbl">FGN 30-Yr Yield <span class="pill">Bonds</span></div>
        <div class="val num">19.10%</div>
        <div class="sub flat">— · 1W</div>
        <div [innerHTML]="spark(null, 'YLD30')"></div>
      </div>
      <div class="indexCard">
        <div class="lbl">Top Fund NAV <span class="pill">Funds</span></div>
        <div class="val num">{{ topNav()?.nav ?? '—' }}</div>
        <div class="sub up">{{ topFundName() }}</div>
        <div [innerHTML]="spark(null, 'NAV')"></div>
      </div>
    </div>

    <app-edu-card
      moduleLabel="Market Overview"
      [questions]="edu['market'].questions"
      [defaultExpanded]="edu['market'].defaultExpanded"
    ></app-edu-card>

    <div class="secHead"><h2>FGN Bond yields <span class="tag">DMO</span></h2></div>
    <input type="search" placeholder="Search funds, news, FX…" [(ngModel)]="q" name="marketSearch" style="width:100%;margin-bottom:14px;">
    <div class="grid2" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px">
      <div class="card">
        <div class="yieldRow">
          <div class="yieldItem"><div class="t">1-YR</div><div class="y num up">16.8%</div></div>
          <div class="yieldItem"><div class="t">5-YR</div><div class="y num up">17.9%</div></div>
          <div class="yieldItem"><div class="t">10-YR</div><div class="y num up">18.4%</div></div>
          <div class="yieldItem"><div class="t">30-YR</div><div class="y num flat">19.1%</div></div>
        </div>
        <div class="secHead" style="margin-top:14px"><h3 style="margin:0">Upcoming DMO auctions</h3><a class="link" routerLink="/bonds">Calendar →</a></div>
        <table>
          <tbody>
            <tr *ngFor="let a of visibleAuctions()">
              <td><span class="sym">{{ a.instrument_name }}<small>{{ a.tenor }} · ₦{{ a.offer_size ?? '—' }}bn</small></span></td>
              <td class="num">{{ a.auction_date }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="card">
        <h3>Official FX rates <span class="tag">CBN</span></h3>
        <div class="fxGrid">
          <div class="fxItem" *ngFor="let f of visibleFx()">
            <div class="pair"><span>{{ f.pair }}</span><span class="flat">—</span></div>
            <div class="rate num">{{ f.rate }}</div>
            <div class="chg flat">{{ f.date }} · {{ f.source }}</div>
          </div>
        </div>
        <div class="secHead" style="margin-top:14px"><h3 style="margin:0">Top mutual funds</h3><a class="link" routerLink="/funds">NAVs →</a></div>
        <table>
          <tbody>
            <tr *ngFor="let fd of visibleFunds().slice(0, 4)">
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
            <tr *ngFor="let n of visibleNews()">
              <td><span class="sym">{{ n.title }}<small>{{ n.source }}</small></span></td>
            </tr>
          </tbody>
        </table>
      </div>
      <!-- Education card (from mockup) -->
      <div class="card eduCard">
        <h3>Education <span class="tag">Pidgin</span></h3>
        <p>"Wetin be bond yield? Na di interest wey government dey pay you for lending dem money. Low risk, fixed return."</p>
        <div class="tags">
          <span class="pill g">Bonds 101</span><span class="pill g">NAV</span><span class="pill g">T+3</span>
        </div>
      </div>
    </div>

    <p class="disc">⚠️ Naija Finance is a <b>data &amp; analytics platform only</b>. Nothing on this page is investment advice, a recommendation, or a promise of returns. Sources: DMO, CBN, SEC disclosures, fund manager publications.</p>
  `,
})
export class MarketPage implements OnInit {
  edu = EDU_CONTENT;
  auctions = signal<any[]>([]);
  fx = signal<any[]>([]);
  funds = signal<any[]>([]);
  news = signal<any[]>([]);
  q = '';

  constructor(private api: ApiService) {}

  topNav() { return this.funds()?.[0]?.latest_nav ?? null; }
  topFundName() { return this.funds()?.[0]?.name ?? '—'; }

  private m(v: any): boolean {
    const s = this.q.trim().toLowerCase();
    if (!s) return true;
    return String(v ?? '').toLowerCase().includes(s);
  }
  visibleAuctions(): any[] { return this.auctions().filter(a => this.m(a.instrument_name) || this.m(a.tenor) || this.m(a.auction_date)); }
  visibleFx(): any[] { return this.fx().filter(f => this.m(f.pair)); }
  visibleFunds(): any[] { return this.funds().filter(f => this.m(f.name) || this.m(f.manager)); }
  visibleNews(): any[] { return this.news().filter(n => this.m(n.title) || this.m(n.source)); }

  ngOnInit() {
    this.api.auctions().subscribe(a => this.auctions.set(a));
    this.api.fxRates(true).subscribe(f => this.fx.set(f));
    this.api.funds().subscribe(fd => this.funds.set(fd));
    this.api.news(5).subscribe(n => this.news.set(n));
  }

  spark(idx: any, seedKey: string): string {
    return this.sparkline(seedKey, true);
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
