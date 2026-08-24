import { Injectable, signal } from '@angular/core';

export type AppLang = 'en' | 'pidgin';

const STORAGE_KEY = 'nf-lang';

/**
 * App-wide language state (English ⇄ Nigerian Pidgin).
 * Persisted in localStorage; components react via the `lang` signal.
 * The header toggle (app.ts) flips this; education cards and UI chrome
 * render the active language.
 */
@Injectable({ providedIn: 'root' })
export class LangService {
  readonly lang = signal<AppLang>('en');

  constructor() {
    // Storage can be unavailable (jsdom tests, privacy modes) — never crash boot.
    let saved: string | null = null;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch { /* noop */ }
    // Allow deep-link override: ?lang=pidgin / ?lang=en
    const qp = new URLSearchParams(location.search).get('lang');
    if (qp === 'pidgin' || qp === 'en') {
      this.lang.set(qp);
      this.persist(qp);
    } else {
      this.lang.set(saved === 'pidgin' ? 'pidgin' : 'en');
    }
  }

  get current(): AppLang { return this.lang(); }
  get isPidgin(): boolean { return this.lang() === 'pidgin'; }

  setLang(l: AppLang) {
    this.lang.set(l);
    this.persist(l);
  }

  toggle(): AppLang {
    const next: AppLang = this.isPidgin ? 'en' : 'pidgin';
    this.setLang(next);
    return next;
  }

  /** Pick the string for the active language. */
  t(en: string, pidgin?: string): string {
    return this.isPidgin ? (pidgin ?? en) : en;
  }

  private persist(v: string) {
    try { localStorage.setItem(STORAGE_KEY, v); } catch { /* noop */ }
  }
}
