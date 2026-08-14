import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { track } from './analytics';

/**
 * Chart image share — renders the live chart to a PNG with NaijaFinanceHub
 * branding (logo + URL + title), then shares via the native sheet (mobile)
 * or downloads the image (desktop). Uses lightweight-charts takeScreenshot().
 */
@Component({
  selector: 'app-chart-img-share',
  imports: [CommonModule],
  template: `
    <button type="button" class="share-btn" (click)="shareImage()" title="Share chart image">
      <span class="ico">{{ status === 'Share image' ? '🖼️' : '✅' }}</span>
      <span *ngIf="!iconOnly" class="lbl">{{ status }}</span>
    </button>
  `,
})
export class ChartImgShareButton {
  @Input() chart: any = null; // IChartApi from lightweight-charts
  @Input() title = '';
  @Input() link = '';
  @Input() iconOnly = false;
  status = 'Share image';

  async shareImage() {
    try {
      const canvas = this.chart?.takeScreenshot?.(true, false) as HTMLCanvasElement | undefined;
      if (!canvas) throw new Error('chart not ready');
      track('share_img_click', { title: this.title, url: this.link || location.pathname });
      const img = this.composeBranded(canvas);
      const blob = await new Promise<Blob | null>(res => img.toBlob(res, 'image/png'));
      if (!blob) return;
      const file = new File([blob], 'naijafinancehub-chart.png', { type: 'image/png' });
      const shareUrl = this.link
        ? (this.link.startsWith('http') ? this.link : location.origin + this.link)
        : location.href.split('?')[0];
      // Native share with the image (WhatsApp/Telegram/iMessage on mobile, share menu on desktop).
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'NaijaFinanceHub — ' + this.title,
          text: `${this.title} — NaijaFinanceHub\n${shareUrl}`,
          url: shareUrl,
        });
        return;
      }
      // Desktop fallback: download the PNG.
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'naijafinancehub-chart.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      this.status = 'Saved ✓';
      setTimeout(() => (this.status = 'Share image'), 2500);
    } catch {
      /* share cancelled / clipboard blocked — do nothing noisy */
    }
  }

  /** Composite the chart canvas with a NaijaFinanceHub branding header + footer. */
  private composeBranded(chartCanvas: HTMLCanvasElement): HTMLCanvasElement {
    const pad = 14;
    const brandH = 44;
    const footH = 30;
    const W = Math.max(320, chartCanvas.width);
    const H = brandH + chartCanvas.height + footH;
    const out = document.createElement('canvas');
    out.width = W;
    out.height = H;
    const ctx = out.getContext('2d');
    if (!ctx) return chartCanvas;

    // Dark canvas background.
    ctx.fillStyle = '#0a0e14';
    ctx.fillRect(0, 0, W, H);

    // Branding header.
    const grad = ctx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, '#0d1f18');
    grad.addColorStop(1, '#0e1522');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, brandH);
    ctx.fillStyle = '#16c784';
    ctx.font = 'bold 17px Inter, system-ui, -apple-system, sans-serif';
    ctx.fillText('NaijaFinanceHub', pad, 28);
    ctx.fillStyle = '#8fa3bf';
    ctx.font = '11.5px Inter, system-ui, sans-serif';
    const sub = this.title || 'Nigerian markets, one dashboard';
    ctx.fillText(sub.length > 70 ? sub.slice(0, 67) + '…' : sub, pad, 44);

    // Chart image (scaled to width, centered).
    const scale = W / chartCanvas.width;
    const drawH = Math.round(chartCanvas.height * scale);
    ctx.drawImage(chartCanvas, 0, brandH, W, drawH);

    // Footer with URL.
    ctx.fillStyle = '#0d1f18';
    ctx.fillRect(0, brandH + drawH, W, footH);
    ctx.fillStyle = '#5c6f8c';
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.fillText('naijafinancehub.com', pad, brandH + drawH + 19);
    const date = new Date().toISOString().slice(0, 10);
    ctx.fillText(date, W - pad - 70, brandH + drawH + 19);
    return out;
  }
}
