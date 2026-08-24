import { Injectable, signal } from '@angular/core';

export type Lang = 'en' | 'pcm';

function readLang(): Lang {
  try { return localStorage.getItem('nf-lang') === 'pcm' ? 'pcm' : 'en'; } catch { return 'en'; }
}
function writeLang(lang: Lang) { try { localStorage.setItem('nf-lang', lang); } catch { /* noop */ } }

/**
 * Lightweight app-wide language state for EN/Pidgin localisation.
 * Persisted to localStorage so the choice survives reloads.
 */
@Injectable({ providedIn: 'root' })
export class LangService {
  readonly lang = signal<Lang>(readLang());
  toggle() {
    this.lang.set(this.lang() === 'en' ? 'pcm' : 'en');
    writeLang(this.lang());
  }
}
