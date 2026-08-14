import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EduQuestion } from './edu-content';
import { LangService } from './lang.service';

/**
 * REQ-EDU-1 — Q&A Education Card (formerly TTC).
 * Displays per-module question bank with Pidgin hooks, English answers,
 * key term chips, and optional voice playback.
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
          <h3>{{ isPidgin ? 'Lan' : 'Learn' }} {{ moduleLabel }}</h3>
          <span class="edu-count">{{ questions.length }} {{ isPidgin ? 'kweshon-dem' : 'questions' }}</span>
        </div>
        <span class="edu-arrow" [class.open]="moduleExpanded">{{ moduleExpanded ? '▾' : '▸' }}</span>
      </div>

      <div class="edu-body" *ngIf="moduleExpanded">
        <div class="edu-q" *ngFor="let q of questions; let i = index">
          <div class="edu-q-header" (click)="toggleQuestion(i)" (keydown.enter)="toggleQuestion(i)" tabindex="0" role="button" [attr.aria-expanded]="expandedQuestions[i]">
            <div class="edu-q-title">
              <span class="edu-pidgin">{{ isPidgin ? q.pidginHook : q.englishTitle }}</span>
              <span class="edu-english" *ngIf="!isPidgin">{{ q.pidginHook }}</span>
            </div>
            <span class="edu-q-arrow" [class.open]="expandedQuestions[i]">{{ expandedQuestions[i] ? '▾' : '▸' }}</span>
          </div>

          <div class="edu-q-body" *ngIf="expandedQuestions[i]">
            <p class="edu-answer">{{ isPidgin ? (q.pidginAnswer || q.answer) : q.answer }}</p>

            <div class="edu-tags" *ngIf="q.keyTerms?.length">
              <span class="pill" *ngFor="let t of q.keyTerms">
                <span class="edu-chip-text">{{ t.label }}</span>
              </span>
            </div>

            <!-- Voice playback placeholder — wired when audioUrl populated -->
            <button class="edu-play" *ngIf="q.audioUrl" (click)="playAudio(q); $event.stopPropagation()">
              🔊 Listen
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
      background: linear-gradient(150deg, #12241c, #0e1522);
      overflow: hidden;
    }
    :root[data-theme="light"] .edu-card-wrap {
      background: linear-gradient(150deg, #e8f5ef, #eef2f8);
    }

    .edu-card-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 16px; cursor: pointer; user-select: none; outline: none;
    }
    .edu-card-header:focus-visible { box-shadow: inset 0 0 0 2px var(--accent); }
    .edu-card-header:hover { background: rgba(255,255,255,.03); }
    :root[data-theme="light"] .edu-card-header:hover { background: rgba(0,0,0,.03); }

    .edu-title-row { display: flex; align-items: center; gap: 10px; }
    .edu-icon { font-size: 18px; line-height: 1; }
    .edu-title-row h3 { font-size: 15px; font-weight: 700; margin: 0; color: var(--txt); }
    .edu-count { font-size: 11px; color: var(--txt3); background: var(--bg2); border: 1px solid var(--line); padding: 2px 7px; border-radius: 10px; }
    .edu-arrow { font-size: 14px; color: var(--txt2); }

    .edu-body { border-top: 1px solid var(--line); }

    .edu-q { border-bottom: 1px solid rgba(30,42,61,.4); }
    :root[data-theme="light"] .edu-q { border-bottom-color: rgba(215,222,234,.8); }
    .edu-q:last-child { border-bottom: none; }

    .edu-q-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      padding: 10px 16px; cursor: pointer; outline: none; gap: 10px;
    }
    .edu-q-header:hover { background: rgba(255,255,255,.02); }
    .edu-q-header:focus-visible { box-shadow: inset 0 0 0 1px var(--accent); }

    .edu-q-title { flex: 1; min-width: 0; }
    .edu-pidgin { display: block; font-size: 14px; font-weight: 700; color: var(--accent); line-height: 1.35; }
    .edu-english { display: block; font-size: 12px; color: var(--txt2); margin-top: 2px; }
    .edu-q-arrow { font-size: 13px; color: var(--txt3); flex-shrink: 0; margin-top: 2px; }

    .edu-q-body { padding: 0 16px 12px; }
    .edu-answer { font-size: 13px; color: var(--txt); line-height: 1.5; margin-bottom: 8px; }

    .edu-tags { display: flex; gap: 5px; flex-wrap: wrap; margin-bottom: 6px; }
    .edu-tags .pill { font-size: 10.5px; padding: 2px 8px; }
    .edu-tags .pill a { color: inherit; text-decoration: none; }

    .edu-play {
      background: var(--accent); color: #04140c; border: none; border-radius: 8px;
      padding: 5px 12px; font-size: 12px; font-weight: 700; cursor: pointer;
      margin-top: 4px;
    }
    :root[data-theme="light"] .edu-play { color: #fff; }
    .edu-play:hover { filter: brightness(1.1); }

    .disc { font-size: 11px; color: var(--txt3); line-height: 1.5; margin: 8px 16px 12px; }
  `]
})
export class EduCard implements OnInit {
  @Input() moduleLabel = '';
  @Input() questions: EduQuestion[] = [];
  @Input() defaultExpanded = true;
  @Input() disclaimer = 'Educational information only. Not investment advice.';

  moduleExpanded = true;
  expandedQuestions: boolean[] = [];

  constructor(private lang: LangService) {}
  get isPidgin() { return this.lang.isPidgin; }

  ngOnInit() {
    this.moduleExpanded = this.defaultExpanded;
    this.expandedQuestions = this.questions.map(() => false);
  }

  toggleModule() {
    this.moduleExpanded = !this.moduleExpanded;
  }

  toggleQuestion(index: number) {
    this.expandedQuestions[index] = !this.expandedQuestions[index];
  }

  playAudio(q: EduQuestion) {
    if (q.audioUrl) {
      const audio = new Audio(q.audioUrl);
      audio.play().catch(() => {});
    }
  }
}
