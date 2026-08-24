import { TestBed } from '@angular/core/testing';
import { afterEach, vi } from 'vitest';
import { EduCard } from './edu-card';
import { EduQuestion } from './edu-content';
import { LangService } from './lang.service';

const QUESTIONS: EduQuestion[] = [
  {
    pidginHook: 'Wetin be stock?',
    englishTitle: 'What is a stock?',
    answer: 'A share of ownership in a company.',
    pidginAnswer: 'Na small part of di company wey you own.',
    keyTerms: [],
  },
  {
    pidginHook: 'Wetin be bond?',
    englishTitle: 'What is a bond?',
    answer: 'A loan you give to a government or company.',
    pidginAnswer: 'Na loan wey you give government or company.',
    keyTerms: [],
  },
];

/** Minimal SpeechSynthesisUtterance stand-in (jsdom has none). */
class UtteranceMock {
  lang = '';
  voice: unknown = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public text: string) {}
}

function stubSpeechSynthesis() {
  const speak = vi.fn();
  const cancel = vi.fn();
  const getVoices = vi.fn(() => [
    { name: 'Fred', lang: 'en-GB', default: false },
    { name: 'Samantha', lang: 'en-US', default: true },
    { name: 'Amelie', lang: 'fr-FR', default: false },
  ]);
  vi.stubGlobal('speechSynthesis', { speak, cancel, getVoices });
  vi.stubGlobal('SpeechSynthesisUtterance', UtteranceMock);
  return { speak, cancel };
}

/** HTMLAudioElement stand-in with observable play()/pause(). */
function stubAudio() {
  const play = vi.fn(() => Promise.resolve());
  const pause = vi.fn();
  const instances: any[] = [];
  vi.stubGlobal('Audio', class {
    onended: (() => void) | null = null;
    onerror: (() => void) | null = null;
    pause = pause;
    play = play;
    constructor(public src: string) { instances.push(this); }
  });
  return { play, pause, instances };
}

describe('EduCard voice playback (S3)', () => {
  beforeEach(() => {
    // LangService persists to localStorage; keep every test starting in EN.
    try { localStorage.clear(); } catch { /* noop */ }
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function makeCard(questions: EduQuestion[] = QUESTIONS): { fixture: any; el: HTMLElement; cmp: EduCard } {
    const fixture = TestBed.createComponent(EduCard);
    const cmp = fixture.componentInstance;
    cmp.moduleLabel = 'Market Overview';
    cmp.questions = questions;
    cmp.defaultExpanded = true; // expand module so question bodies render
    fixture.detectChanges();
    for (let i = 0; i < questions.length; i++) cmp.toggleQuestion(i); // open each Q&A body
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement, cmp };
  }

  function buttons(el: HTMLElement): HTMLButtonElement[] {
    return Array.from(el.querySelectorAll<HTMLButtonElement>('.edu-play'));
  }

  it('renders one speaker button per Q&A item even when no question carries audioUrl', () => {
    const { el } = makeCard();
    const btns = buttons(el);
    expect(btns.length).toBe(QUESTIONS.length);
    for (const b of btns) expect(b.textContent).toContain('🔊 Listen');
  });

  it('disables the button with an explanatory tooltip when speechSynthesis is unavailable (jsdom default)', () => {
    const { el } = makeCard();
    const btns = buttons(el);
    expect(btns.length).toBeGreaterThan(0);
    for (const b of btns) {
      expect(b.disabled).toBe(true);
      expect(b.title).toBe('Voice playback is not supported in this browser');
    }
  });

  it('falls back to speechSynthesis reading question + answer when no audioUrl exists', () => {
    const synth = stubSpeechSynthesis();
    const { el, cmp, fixture } = makeCard();

    buttons(el)[0].click();
    fixture.detectChanges();

    const mock = window.speechSynthesis as any;
    void synth;
    expect(mock.cancel).toHaveBeenCalled();
    expect(mock.speak).toHaveBeenCalledTimes(1);
    const utterance = mock.speak.mock.calls[0][0] as UtteranceMock;
    expect(utterance.text).toContain('What is a stock?');
    expect(utterance.text).toContain('A share of ownership in a company.');
    // English content gets an English voice (default en-US one wins here)
    expect((utterance.voice as any)?.lang).toBe('en-US');
    expect(cmp.speakingIndex()).toBe(0);
    expect(buttons(el)[0].textContent).toContain('⏹ Stop');
  });

  it('plays the hosted asset when audioUrl is populated instead of TTS', () => {
    const audio = stubAudio();
    const q = { ...QUESTIONS[0], audioUrl: '/assets/audio/what-is-a-stock.mp3' };
    const { el } = makeCard([q]);

    buttons(el)[0].click();

    expect(audio.instances.length).toBe(1);
    expect(audio.instances[0].src).toBe('/assets/audio/what-is-a-stock.mp3');
    expect(audio.play).toHaveBeenCalledTimes(1);
    expect((window as any).speechSynthesis).toBeUndefined(); // TTS untouched
  });

  it('clicking a playing item stops it, cancels speech, and resets the visual state', () => {
    const synth = stubSpeechSynthesis();
    const { el, fixture } = makeCard();

    buttons(el)[1].click();
    fixture.detectChanges();
    expect(buttons(el)[1].textContent).toContain('⏹ Stop');

    buttons(el)[1].click();
    fixture.detectChanges();
    expect(synth.cancel).toHaveBeenCalled();
    expect(buttons(el)[1].textContent).toContain('🔊 Listen');
  });

  it('localizes button labels and tooltips through LangService in Pidgin mode', () => {
    stubSpeechSynthesis();
    TestBed.inject(LangService).setLang('pidgin');
    const { el, fixture } = makeCard();

    expect(buttons(el)[0].textContent).toContain('Hear am');
    buttons(el)[0].click();
    fixture.detectChanges();
    expect(buttons(el)[0].textContent).toContain('Stopam');
    expect(buttons(el)[0].title).toBe('Read di kweshon and ansa loud');
  });
});
