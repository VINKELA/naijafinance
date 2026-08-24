import { Component, Input, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EduQuestion } from './edu-content';
import { LangService } from './lang.service';

/**
 * REQ-EDU-1 — Q&A Education Card (formerly TTC).
 * Displays per-module question bank with Pidgin hooks, English answers,
 * key term chips, and voice playback per question:
 *  - hosted asset via `audioUrl` when present,
 *  - otherwise browser Web Speech API (speechSynthesis) reads Q + A aloud
 *    (English content with an English voice; Pidgin content spoken as-is,
 *    since Pidgin TTS voices do not exist).
 * Graceful degradation: without speechSynthesis AND without audioUrl the
 * button renders disabled with an explanatory tooltip — never throws.
 * CCO-approved question bank, 08-08.
 */
@Component({
  selector: 'app-edu-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="edu-card-wrap">
      <div class="edu-card-header" (click)="toggleModule()" (keydown.enter)="toggleModule()" tabindex="0" role="button" [attr.aria-expanded]="moduleExpanded">
        <div class="edu-title-row">
          <span class="edu-icon">📚</span>
          <h3>{{ isPidgin ? 'Lan' : 'Learn' }} {{ isPidgin ? (labelPidgin(moduleLabel) || moduleLabel) : moduleLabel }}</h3>
          <span class="edu-count">{{ questions.length }} {{ isPidgin ? 'kweshon-dem' : 'questions' }}</span>
        </div>
        <span class="edu-arrow" [class.open]="moduleExpanded">{{ moduleExpanded ? '▾' : '▸' }}</span>
      </div>

      <div class="edu-body" *ngIf="moduleExpanded">
        <div class="edu-q" *ngFor="let q of questions; let i = index">
          <div class="edu-q-header" (click)="toggleQuestion(i)" (keydown.enter)="toggleQuestion(i)" tabindex="0" role="button" [attr.aria-expanded]="expandedQuestions()[i]">
            <div class="edu-q-title">
              <span class="edu-pidgin" *ngIf="isPidgin">{{ q.pidginHook }}</span>
              <span class="edu-english" *ngIf="!isPidgin">{{ q.englishTitle }}</span>
            </div>
            <span class="edu-q-arrow" [class.open]="expandedQuestions()[i]">{{ expandedQuestions()[i] ? '▾' : '▸' }}</span>
          </div>

          <div class="edu-q-body" *ngIf="expandedQuestions()[i]">
            <p class="edu-answer">{{ isPidgin ? (q.pidginAnswer || q.answer) : q.answer }}</p>

            <div class="edu-tags" *ngIf="q.keyTerms?.length">
              <span class="pill" *ngFor="let t of q.keyTerms">
                <span class="edu-chip-text">{{ isPidgin ? termPidgin(t.label) : t.label }}</span>
              </span>
            </div>

            <!-- Voice playback: hosted asset if audioUrl exists, else Web Speech API -->
            <button
              class="edu-play"
              type="button"
              (click)="toggleAudio(q, i); $event.stopPropagation()"
              [disabled]="!canPlay(q)"
              [title]="audioTooltip(q)"
              [attr.aria-label]="audioTooltip(q)">
              {{ speakingIndex() === i ? '⏹ ' + tt('Stop', 'Stopam') : '🔊 ' + tt('Listen', 'Hear am') }}
            </button>
          </div>
        </div>

        <p class="disc">{{ isPidgin ? 'Na educational information only. No be investment advice.' : disclaimer }}</p>
      </div>
    </div>
  `,
  styles: [`
    .edu-card-wrap {
      margin: 0 0 18px;
      border-radius: var(--radius);
      border: 1px solid var(--line);
      background: var(--edu-bg, linear-gradient(150deg, #12241c, #0e1522));
      overflow: hidden;
    }

    .edu-card-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 16px; cursor: pointer; user-select: none; outline: none;
    }
    .edu-card-header:focus-visible { box-shadow: inset 0 0 0 2px var(--accent); }
    .edu-card-header:hover { background: var(--edu-hover, rgba(255,255,255,.03)); }

    .edu-title-row { display: flex; align-items: center; gap: 10px; }
    .edu-icon { font-size: 18px; line-height: 1; }
    .edu-title-row h3 { font-size: 15px; font-weight: 700; margin: 0; color: var(--txt); }
    .edu-count { font-size: 11px; color: var(--txt3); background: var(--bg2); border: 1px solid var(--line); padding: 2px 7px; border-radius: 10px; }
    .edu-arrow { font-size: 14px; color: var(--txt2); }

    .edu-body { border-top: 1px solid var(--line); }

    .edu-q { border-bottom: 1px solid var(--line); }
    .edu-q:last-child { border-bottom: none; }

    .edu-q-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      padding: 10px 16px; cursor: pointer; outline: none; gap: 10px;
    }
    .edu-q-header:hover { background: rgba(255,255,255,.02); }
    .edu-q-header:focus-visible { box-shadow: inset 0 0 0 1px var(--accent); }

    .edu-q-title { flex: 1; min-width: 0; }
    .edu-pidgin, .edu-english { display: block; font-size: 13px; font-weight: 600; color: var(--txt); line-height: 1.4; }
    .edu-q-arrow { font-size: 13px; color: var(--txt3); flex-shrink: 0; margin-top: 2px; }

    .edu-q-body { padding: 0 16px 12px; }
    .edu-answer { font-size: 13px; color: var(--txt); line-height: 1.5; margin-bottom: 8px; }

    .edu-tags { display: flex; gap: 5px; flex-wrap: wrap; margin-bottom: 6px; }
    .edu-tags .pill { font-size: 10.5px; padding: 2px 8px; }
    .edu-tags .pill a { color: inherit; text-decoration: none; }

    .edu-play {
      background: var(--accent); color: var(--edu-play-fg, #04140c); border: none; border-radius: 8px;
      padding: 5px 12px; font-size: 12px; font-weight: 700; cursor: pointer;
      margin-top: 4px;
    }
    .edu-play:hover:not(:disabled) { filter: brightness(1.1); }
    .edu-play:disabled { opacity: .45; cursor: not-allowed; filter: grayscale(.6); }

    .disc { font-size: 11px; color: var(--txt3); line-height: 1.5; margin: 8px 16px 12px; }
  `]
})
export class EduCard implements OnInit, OnDestroy {
  @Input() moduleLabel = '';
  @Input() questions: EduQuestion[] = [];
  @Input() defaultExpanded = false;
  @Input() disclaimer = 'Educational information only. Not investment advice.';

  /** Index of the question currently being voiced (asset or TTS), else null. */
  readonly speakingIndex = signal<number | null>(null);

  /** Per-question expansion state (signal so zoneless CD reacts). */
  readonly expandedQuestions = signal<boolean[]>([]);

  private static readonly LABEL_PIDGIN: Record<string, string> = {
    'Market Overview': 'Maket Ova',
    'Bonds & Commercial Papers': 'Bonds & Komershial Papas',
    'Mutual Funds': 'Fands',
    'FX': 'FX',
    'Alerts': 'Alats',
    'Compare': 'Kompare',
    'Asset Mix': 'Aset Mix',
  };

  private static readonly TERM_PIDGIN: Record<string, string> = {
    'All-Share Index': 'All-Share Index', 'CBN': 'CBN', 'DMO': 'DMO', 'EPS': 'EPS', 'NAV': 'NAV', 'NGX': 'NGX', 'P/E': 'P/E', 'T-bill': 'T-bill',
    'bond': 'bond', 'broker': 'broka', 'compound interest': 'kompaund interest', 'coupon': 'kupon', 'devaluation': 'devaluation',
    'diversification': 'diversifikashon', 'dividend': 'dividend', 'earnings': 'earnings', 'equity': 'equity', 'exchange rate': 'exchange rate',
    'face value': 'face value', 'index': 'index', 'inflation': 'inflashon', 'interest rate': 'interest rate', 'liquidity': 'likwiditi',
    'market cap': 'maket kapital', 'maturity': 'machuriti', 'mutual fund': 'fand', 'portfolio': 'portfolio', 'return': 'return',
    'risk': 'risk', 'risk tolerance': 'risk tolerans', 'secondary market': 'sekondari maket', 'share': 'shia', 'stock': 'stok',
    'volatility': 'volatiliti', 'watchlist': 'watchlist', 'yield': 'yield',
  };

  /** Cached English voice lookup (undefined = not resolved yet). */
  private englishVoice: SpeechSynthesisVoice | null | undefined;
  private currentAudio: HTMLAudioElement | null = null;

  labelPidgin(label: string): string | undefined { return EduCard.LABEL_PIDGIN[label]; }
  termPidgin(label: string): string { return EduCard.TERM_PIDGIN[label] ?? label; }

  moduleExpanded = true;

  constructor(private lang: LangService) {}
  get isPidgin() { return this.lang.isPidgin; }

  /** Localized string for new UI chrome (follows LangService pattern). */
  tt(en: string, pidgin?: string) { return this.lang.t(en, pidgin); }

  ngOnInit() {
    this.moduleExpanded = this.defaultExpanded;
    this.expandedQuestions.set(this.questions.map(() => false));
  }

  ngOnDestroy() {
    this.stopAudio();
  }

  toggleModule() {
    this.moduleExpanded = !this.moduleExpanded;
  }

  toggleQuestion(index: number) {
    this.expandedQuestions.update(arr => arr.map((v, i) => (i === index ? !v : v)));
  }

  /** True when this question can be voiced at all (asset or speech synthesis). */
  canPlay(q: EduQuestion): boolean {
    return !!q.audioUrl || this.speechAvailable;
  }

  get speechAvailable(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  /** Tooltip / aria-label for the voice button (localized). */
  audioTooltip(q: EduQuestion): string {
    if (!this.canPlay(q)) return this.tt('Voice playback is not supported in this browser', 'Dis browser no sabi read aloud');
    if (q.audioUrl) return this.tt('Play audio', 'Play di audio');
    return this.tt('Read question and answer aloud', 'Read di kweshon and ansa loud');
  }

  /**
   * Voice toggle for one question: clicking a playing item stops it,
   * otherwise starts playback and marks it as the active one.
   */
  toggleAudio(q: EduQuestion, index: number) {
    if (this.speakingIndex() === index) {
      this.stopAudio();
      return;
    }
    this.playAudio(q, index);
  }

  /**
   * Existing playAudio path, extended: hosted asset wins when audioUrl is
   * populated; otherwise falls back to speechSynthesis reading Q + A.
   */
  playAudio(q: EduQuestion, index: number) {
    this.stopAudio();
    if (!this.canPlay(q)) return;

    if (q.audioUrl) {
      const audio = new Audio(q.audioUrl);
      audio.onended = () => { if (this.speakingIndex() === index) this.speakingIndex.set(null); };
      audio.onerror = () => { if (this.speakingIndex() === index) this.speakingIndex.set(null); };
      this.currentAudio = audio;
      this.speakingIndex.set(index);
      audio.play().catch(() => { if (this.speakingIndex() === index) this.speakingIndex.set(null); });
      return;
    }

    this.speak(q, index);
  }

  /** Web Speech API fallback: reads question + answer in the active language. */
  private speak(q: EduQuestion, index: number) {
    try {
      const synth = window.speechSynthesis;
      // English content -> English voice. Pidgin has no TTS voice anywhere,
      // so we speak the Pidgin text as-is through an English voice too.
      const text = this.isPidgin
        ? `${q.pidginHook}. ${q.pidginAnswer || q.answer}`
        : `${q.englishTitle}. ${q.answer}`;

      const utterance = new SpeechSynthesisUtterance(text);
      const voice = this.pickEnglishVoice(synth);
      if (voice) utterance.voice = voice;
      utterance.lang = voice?.lang ?? 'en-US';
      utterance.onend = () => { if (this.speakingIndex() === index) this.speakingIndex.set(null); };
      utterance.onerror = () => { if (this.speakingIndex() === index) this.speakingIndex.set(null); };

      synth.cancel();
      synth.speak(utterance);
      this.speakingIndex.set(index);
    } catch {
      // Never throw from UI: silently reset state if the engine misbehaves.
      if (this.speakingIndex() === index) this.speakingIndex.set(null);
    }
  }

  /** Prefer the default en voice, then en-US, then any English variant. */
  private pickEnglishVoice(synth: SpeechSynthesis): SpeechSynthesisVoice | null {
    if (this.englishVoice !== undefined) return this.englishVoice;
    let picked: SpeechSynthesisVoice | null = null;
    try {
      const english = synth.getVoices().filter(v => v.lang?.toLowerCase().startsWith('en'));
      picked = english.find(v => v.default) ?? english.find(v => /^en([-_]|$)/i.test(v.lang) && /us/i.test(v.lang)) ?? english[0] ?? null;
    } catch { picked = null; }
    this.englishVoice = picked;
    return picked;
  }

  stopAudio() {
    try {
      if (this.speechAvailable) window.speechSynthesis.cancel();
    } catch { /* noop */ }
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    this.speakingIndex.set(null);
  }
}
