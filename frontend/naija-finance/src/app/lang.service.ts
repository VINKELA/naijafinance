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
    const saved = localStorage.getItem(STORAGE_KEY);
    this.lang.set(saved === 'pidgin' ? 'pidgin' : 'en');
  }

  get current(): AppLang { return this.lang(); }
  get isPidgin(): boolean { return this.lang() === 'pidgin'; }

  setLang(l: AppLang) {
    this.lang.set(l);
    localStorage.setItem(STORAGE_KEY, l);
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
}
