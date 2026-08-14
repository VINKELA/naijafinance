import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ApplicationRef } from '@angular/core';
import { ApiService } from './api.service';
import { LangService } from './lang.service';
import { track } from './analytics';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  themeLabel = '🌙';
  asOf = signal('');
  tape = signal<{ s: string; p: string; ch: string; up: boolean | null }[]>([]);
  tapeLoop = signal<{ s: string; p: string; ch: string; up: boolean | null }[]>([]);
  private timer: any;
  private cdTimer: any;

  get isAuthed() { return this.api.isAuthed; }
  get isPidgin() { return this.lang.isPidgin; }
  get langLabel() { return this.isPidgin ? '🇳🇬 Pidgin' : '🇳🇬 English'; }

  constructor(private api: ApiService, private appRef: ApplicationRef, private router: Router, private lang: LangService) {}

  /** Pick the active-language string: t(english, pidgin). */
  t(en: string, pidgin?: string): string { return this.lang.t(en, pidgin); }

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
  ngOnDestroy() { clearInterval(this.timer); clearInterval(this.cdTimer); }

  logout() {
    this.api.clearTokens();
    this.router.navigate(['/account']);
  }

  toggleLang() {
    this.lang.toggle();
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
    this.api.fxRates(true).subscribe(fx => {
      for (const f of fx.slice(0, 6)) {
        items.push({ s: f.pair, p: f.rate, ch: '0.00%', up: null });
      }
      this.tape.set(items);
      this.tapeLoop.set([...items, ...items]);
    });
  }
}
