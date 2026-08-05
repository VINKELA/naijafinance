import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { track } from './analytics';

/**
 * REQ-4 shareable-everywhere button.
 * Web Share API (native sheet → WhatsApp/Telegram/X on mobile),
 * wa.me deep-link fallback (desktop), then clipboard copy.
 */
@Component({
  selector: 'app-share-btn',
  imports: [CommonModule],
  template: `
    <button type="button" class="share-btn" (click)="share()" title="Share">
      <span class="ico">📤</span><span *ngIf="!iconOnly" class="lbl">Share</span>
    </button>
  `,
})
export class ShareButton {
  @Input() text = '';
  @Input() link = '';
  @Input() iconOnly = false;
  copied = false;

  async share() {
    track('share_click', { url: this.link || location.pathname });
    const url = this.link || location.href.split('?')[0];
    const text = this.text ? `${this.text} — Naija Finance Hub` : 'Naija Finance Hub — Nigerian markets, one dashboard';
    try {
      if (navigator.share) { await navigator.share({ title: 'Naija Finance Hub', text, url }); return; }
    } catch { /* cancelled/failed — fall through */ }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    } catch {
      window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, '_blank');
    }
  }
}
