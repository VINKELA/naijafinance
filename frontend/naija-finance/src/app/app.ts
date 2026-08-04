import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ApplicationRef } from '@angular/core';
import { ApiService } from './api.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  langLabel = '🇳🇬 Pidgin';
  themeLabel = '🌙';
  query = '';
  tape: { s: string; p: string; ch: string; up: boolean | null }[] = [];
  private timer: any;
  private cdTimer: any;

  constructor(private api: ApiService, private appRef: ApplicationRef, private router: Router) {}

  ngOnInit() {
    this.initTheme();
    this.loadTape();
    this.timer = setInterval(() => this.loadTape(), 60000);
    // Demo stopgap: this Angular 22 zoneless build does not re-render on
    // HTTP completion reliably; tick every second so fetched data paints.
    // Remove once change detection is properly wired.
    this.cdTimer = setInterval(() => { try { this.appRef.tick(); } catch { /* noop */ } }, 1000);
  }
  ngOnDestroy() { clearInterval(this.timer); clearInterval(this.cdTimer); }

  search() {
    const q = this.query.trim();
    if (!q) return;
    this.api.searchStocks(q).subscribe({
      next: (res) => {
        if (res && res.length) {
          this.router.navigate(['/symbol'], { queryParams: { symbol: res[0].symbol } });
        }
      },
      error: () => { /* noop */ },
    });
  }

  toggleLang() {
    this.langLabel = this.langLabel.includes('Pidgin') ? '🇳🇬 English' : '🇳🇬 Pidgin';
  }

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
      for (const i of idx.slice(0, 3)) {
        items.push({ s: i.symbol, p: i.current_price, ch: `▲ ${i.percent_change}%`, up: i.isUp });
      }
      this.api.fxRates(true).subscribe(fx => {
        for (const f of fx.slice(0, 4)) {
          items.push({ s: f.pair, p: f.rate, ch: '— 0.00%', up: null });
        }
        this.tape = items;
      });
    });
  }
}
