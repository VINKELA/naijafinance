import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ApplicationRef } from '@angular/core';
import { ApiService } from './api.service';
import { LangService } from './i18n';
import { track } from './analytics';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  themeLabel = '🌙';
  query = '';
  asOf = signal('');
  suggestions = signal<any[]>([]);
  showSuggestions = signal(false);
  activeIndex = signal(-1);
  tape = signal<{ s: string; p: string; ch: string; up: boolean | null }[]>([]);
  tapeLoop = signal<{ s: string; p: string; ch: string; up: boolean | null }[]>([]);
  private timer: any;
  private cdTimer: any;
  private searchTimer: any;

  get isAuthed() { return this.api.isAuthed; }

  constructor(private api: ApiService, private appRef: ApplicationRef, private router: Router, private i18n: LangService) {}

  get langLabel() { return this.i18n.lang() === 'en' ? '🇳🇬 Pidgin' : '🇳🇬 English'; }

  ngOnInit() {
    track('visit', { path: location.pathname });
    this.initTheme();
    this.loadTape();
    this.timer = setInterval(() => this.loadTape(), 60000);
    // Demo stopgap: this Angular 22 zoneless build does not re-render on
    // HTTP completion reliably; tick every second so fetched data paints.
    // Remove once change detection is properly wired.
    this.cdTimer = setInterval(() => { try { this.appRef.tick(); } catch { /* noop */ } }, 1000);
  }
  ngOnDestroy() { clearInterval(this.timer); clearInterval(this.cdTimer); clearTimeout(this.searchTimer); }

  onSearchInput() {
    clearTimeout(this.searchTimer);
    const q = this.query.trim();
    if (!q) { this.suggestions.set([]); this.showSuggestions.set(false); return; }
    this.searchTimer = setTimeout(() => {
      this.api.searchStocks(q).subscribe({
        next: (res) => {
          this.suggestions.set((res ?? []).slice(0, 8));
          this.activeIndex.set(-1);
          this.showSuggestions.set(this.suggestions().length > 0);
        },
        error: () => { this.suggestions.set([]); this.showSuggestions.set(false); },
      });
    }, 250);
  }

  onSearchFocus() {
    if (this.query.trim() && this.suggestions().length) this.showSuggestions.set(true);
  }
  onSearchBlur() {
    setTimeout(() => this.showSuggestions.set(false), 150);
  }
  onSearchKey(e: KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const n = this.suggestions().length;
      if (!n) return;
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      let idx = this.activeIndex() + delta;
      if (idx < 0) idx = n - 1;
      if (idx >= n) idx = 0;
      this.activeIndex.set(idx);
      this.showSuggestions.set(true);
    } else if (e.key === 'Escape') {
      this.showSuggestions.set(false);
    } else if (e.key === 'Enter') {
      const list = this.suggestions();
      const idx = this.activeIndex();
      const target = idx >= 0 && list[idx] ? list[idx] : list[0];
      if (target) { e.preventDefault(); this.gotoSymbol(target.symbol); }
    }
  }
  selectSuggestion(s: any) {
    if (s?.symbol) this.gotoSymbol(s.symbol);
  }
  private gotoSymbol(symbol: string) {
    this.query = '';
    this.suggestions.set([]);
    this.showSuggestions.set(false);
    this.router.navigate(['/asset'], { queryParams: { type: 'instrument', symbol } });
  }

  search() {
    const list = this.suggestions();
    const idx = this.activeIndex();
    const target = idx >= 0 && list[idx] ? list[idx] : list[0];
    if (target) { this.gotoSymbol(target.symbol); return; }
    const q = this.query.trim();
    if (!q) return;
    this.api.searchStocks(q).subscribe({
      next: (res) => {
        if (res && res.length) this.gotoSymbol(res[0].symbol);
      },
      error: () => { /* noop */ },
    });
  }

  logout() {
    this.api.clearTokens();
    this.router.navigate(['/account']);
  }

  toggleLang() { this.i18n.toggle(); }

  initTheme() {
    const saved = localStorage.getItem('nf-theme');
    const theme = saved === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    this.themeLabel = theme === 'light' ? '☀️' : '🌙';
  }
  toggleTheme() {
    const cur = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    const next = cur === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('nf-theme', next);
    this.themeLabel = next === 'light' ? '☀️' : '🌙';
  }

  loadTape() {
    const items: { s: string; p: string; ch: string; up: boolean | null }[] = [];
    this.api.indexes().subscribe(idx => {
      const lu = idx[0]?.last_updated;
      if (lu) {
        try { this.asOf.set(new Date(lu).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })); } catch { /* noop */ }
      }
      for (const i of idx.slice(0, 3)) {
        items.push({ s: i.symbol, p: i.current_price, ch: `${i.percent_change}%`, up: i.isUp });
      }
      this.api.fxRates(true).subscribe(fx => {
        for (const f of fx.slice(0, 4)) {
          items.push({ s: f.pair, p: f.rate, ch: '0.00%', up: null });
        }
        this.tape.set(items);
        this.tapeLoop.set([...items, ...items]);
      });
    });
  }
}
