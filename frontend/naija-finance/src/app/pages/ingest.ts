import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ApiService, API_BASE } from '../api.service';

@Component({
  selector: 'app-ingest',
  imports: [CommonModule, FormsModule],
  template: `
    <h2>Data Ingest</h2>
    <p class="sub">Upload CSV files to update live data. Auth required.</p>

    <div *ngIf="dataStatus()" class="card" style="margin-bottom:16px;font-size:11.5px;background:var(--card2);">
      <p style="margin-bottom:4px;"><strong>Pipeline status</strong> · Last run: {{ dataStatus()?.last_run ? (dataStatus()?.last_run | slice:0:19) : 'never' }}</p>
      <p style="font-size:11px;color:var(--txt2);">
        🟢 {{ dataStatus()?.summary?.live ?? 0 }} live ·
        🟡 {{ dataStatus()?.summary?.stale ?? 0 }} stale ·
        🔴 {{ dataStatus()?.summary?.gated ?? 0 }} gated
      </p>
    </div>

    <div class="card" style="max-width: 540px;" *ngIf="isAuthed">
      <div style="display:grid;gap:12px;">
        <div class="form-row">
          <label style="font-weight:700;font-size:12px;">Data type:</label>
          <select [(ngModel)]="ingestType" name="type">
            <option value="fx">FX Rates (pair,date,rate)</option>
            <option value="nav">Fund NAVs (fund_name,date,nav)</option>
            <option value="bonds">Bond Auctions (symbol,date,tenor,offer_size,stop_rate)</option>
            <option value="instruments">Instruments (symbol,last_price)</option>
          </select>
        </div>
        <div>
          <input type="file" (change)="onFile($event)" accept=".csv" style="width:100%;">
        </div>
        <div *ngIf="preview().length" class="table-wrap" style="max-height:200px;overflow:auto;">
          <table class="data"><thead><tr><th *ngFor="let h of headers()">{{ h }}</th></tr></thead>
            <tbody><tr *ngFor="let r of preview()"><td *ngFor="let h of headers()">{{ r[h] }}</td></tr></tbody>
          </table>
        </div>
        <button (click)="upload()" [disabled]="!file || busy">
          {{ busy ? 'Uploading…' : 'Upload & Ingest' }}
        </button>
      </div>
      <div *ngIf="result()" class="card" style="margin-top:12px;background:var(--card2);">
        <p><strong>{{ result()?.type }}</strong>: {{ result()?.rows }} rows, {{ result()?.created }} created, {{ result()?.updated }} updated</p>
        <p *ngIf="result()?.errors?.length" class="error">{{ result().errors.length }} errors: {{ result().errors.join(', ') }}</p>
      </div>
      <p class="error" *ngIf="error">{{ error }}</p>
    </div>

    <div class="card" *ngIf="!isAuthed">
      <p class="sub">Sign in to upload data.</p>
    </div>
  `,
})
export class IngestPage {
  ingestType = 'fx';
  file: File | null = null;
  busy = false;
  error = '';
  result = signal<any>(null);
  preview = signal<Record<string, string>[]>([]);
  headers = signal<string[]>([]);

    dataStatus = signal<any>(null);
  constructor(private http: HttpClient, private api: ApiService) {}
  get isAuthed() { return this.api.isAuthed; }
  ngOnInit() { if (this.isAuthed) this.loadDataStatus(); }
  loadDataStatus() {
    this.http.get(API_BASE + '/data-status/').subscribe((d: any) => this.dataStatus.set(d));
  }

  onFile(e: Event) {
    const input = e.target as HTMLInputElement;
    this.file = input.files?.[0] ?? null;
    this.preview.set([]);
    this.headers.set([]);
    if (this.file) {
      const reader = new FileReader();
      reader.onload = () => {
        const lines = (reader.result as string).split('\n').filter(l => l.trim());
        if (lines.length > 1) {
          this.headers.set(lines[0].split(',').map(h => h.trim()));
          this.preview.set(lines.slice(1, 6).map(l => {
            const vals = l.split(',');
            const obj: Record<string, string> = {};
            this.headers().forEach((h, i) => obj[h] = (vals[i] || '').trim());
            return obj;
          }));
        }
      };
      reader.readAsText(this.file);
    }
  }

  upload() {
    if (!this.file) return;
    this.busy = true; this.error = ''; this.result.set(null);
    const form = new FormData();
    form.append('file', this.file);
    form.append('type', this.ingestType);
    this.http.post(`${API_BASE}/ingest/csv/`, form, {
      headers: { Authorization: `Bearer ${this.api.token}` }
    }).subscribe({
      next: (r: any) => { this.result.set(r); this.busy = false; },
      error: (e) => { this.error = e?.error?.error ?? e?.error?.detail ?? 'Upload failed'; this.busy = false; },
    });
  }
}
