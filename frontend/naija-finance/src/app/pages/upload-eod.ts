import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../api.service';

@Component({
  selector: 'app-upload-eod',
  imports: [CommonModule, FormsModule],
  template: `
    <h2>EOD Price Upload</h2>
    <p class="sub">Upload a CSV of end-of-day stock prices. Requires sign-in.</p>

    <p class="error" *ngIf="!authed">Sign in to use the upload tool (Account page).</p>

    <ng-container *ngIf="authed">
      <div class="card" style="margin-bottom: 20px;">
        <h3>Upload CSV</h3>
        <p class="sub" style="margin-bottom: 10px;">
          Format: <code>symbol,date,open,high,low,close,volume</code><br>
          Example: <code>MTNN,2026-08-07,215.00,218.50,214.00,217.30,1523400</code>
        </p>
        <textarea [(ngModel)]="csvText" name="csvText" rows="10" 
          placeholder="symbol,date,open,high,low,close,volume&#10;MTNN,2026-08-07,215.00,218.50,214.00,217.30,1523400&#10;GTCO,2026-08-07,48.50,49.20,48.10,48.95,8500000"
          style="width:100%;font-family:monospace;font-size:13px;background:var(--bg2);color:var(--txt);border:1px solid var(--border);border-radius:6px;padding:12px;"></textarea>
        <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">
          <button (click)="upload()" [disabled]="busy || !csvText().trim()">{{ busy ? 'Uploading…' : 'Upload' }}</button>
          <button class="ghost" (click)="downloadTemplate()">📄 Download template CSV</button>
        </div>
      </div>

      <p class="error" *ngIf="error()">{{ error() }}</p>
      <p class="error" style="color: var(--up, #16C784);" *ngIf="ok()">{{ ok() }}</p>

      <div class="card" style="margin-bottom: 20px;" *ngIf="history().length">
        <h3>Upload history</h3>
        <table class="data">
          <thead><tr><th>Date</th><th class="num">Records</th></tr></thead>
          <tbody>
            <tr *ngFor="let h of history()">
              <td>{{ h.date }}</td><td class="num">{{ h.count }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </ng-container>
  `,
})
export class UploadEodPage {
  csvText = signal('');
  error = signal('');
  ok = signal('');
  busy = false;
  history = signal<{ date: string; count: number }[]>([]);

  get authed() { return this.api.isAuthed; }

  constructor(private api: ApiService) {}

  upload() {
    const csv = this.csvText().trim();
    if (!csv) return;
    this.busy = true; this.error.set(''); this.ok.set('');
    this.api.uploadEod(csv).subscribe({
      next: (r: any) => {
        this.busy = false;
        if (r.updated > 0) {
          this.ok.set(`✅ Updated ${r.updated} instruments.${r.errors?.length ? ` ${r.errors.length} errors.` : ''}`);
          this.csvText.set('');
        } else {
          this.error.set('No records updated. Check CSV format.');
        }
      },
      error: (e) => { this.busy = false; this.error.set(e?.error?.error || e?.error?.detail || 'Upload failed.'); },
    });
  }

  downloadTemplate() {
    const tpl = 'symbol,date,open,high,low,close,volume\nMTNN,2026-08-07,215.00,218.50,214.00,217.30,1523400\nGTCO,2026-08-07,48.50,49.20,48.10,48.95,8500000\nZENITHBANK,2026-08-07,42.00,42.80,41.50,42.35,6700000';
    const blob = new Blob([tpl], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'eod_template.csv'; a.click();
    URL.revokeObjectURL(url);
  }
}
