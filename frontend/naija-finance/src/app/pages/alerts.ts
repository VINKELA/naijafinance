import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, Alert, Bond, Fund } from '../api.service';
import { fmtPrice } from '../format';

const DISCLAIMER = 'All data on this page is provided for information and education only and does not constitute investment advice.';

@Component({
  selector: 'app-alerts',
  imports: [CommonModule, FormsModule],
  template: `
    <h2>Threshold Alerts</h2>
    <p class="sub">Create alerts; a triggered flag is set by <code>run_alert_eval</code>.</p>
    <p class="disclaimer">{{ disclaimer }}</p>

    <div class="card" style="margin-bottom: 20px;">
      <form class="form-row" (ngSubmit)="create()">
        <select [(ngModel)]="form.alert_type" name="alert_type" required>
          <option value="PRICE">Price</option>
          <option value="YIELD">Yield</option>
          <option value="NAV">NAV</option>
        </select>
        <select [(ngModel)]="form.instrument" name="instrument" *ngIf="form.alert_type !== 'NAV'">
          <option *ngFor="let b of bonds()" [ngValue]="b.id">{{ b.symbol }}</option>
        </select>
        <select [(ngModel)]="form.fund" name="fund" *ngIf="form.alert_type === 'NAV'">
          <option *ngFor="let f of funds()" [ngValue]="f.id">{{ f.name }}</option>
        </select>
        <input type="number" step="any" placeholder="threshold" [(ngModel)]="form.threshold" name="threshold" required>
        <select [(ngModel)]="form.direction" name="direction">
          <option value="ABOVE">above</option>
          <option value="BELOW">below</option>
        </select>
        <button type="submit">Create alert</button>
      </form>
    </div>

    <div class="table-wrap">
      <h3>Your alerts</h3>
      <table class="data">
        <thead><tr><th>Type</th><th>Target</th><th class="num">Threshold</th><th>Direction</th><th>Triggered</th><th class="num">Last value</th><th></th></tr></thead>
        <tbody>
          <tr *ngFor="let a of alerts()">
            <td>{{ a.alert_type_display }}</td>
            <td class="sym">{{ a.instrument_symbol ?? a.fund_name }}</td>
            <td class="num">{{ fmtPrice(a.threshold) }}</td><td>{{ a.direction_display }}</td>
            <td><span class="pill" [class.up]="a.triggered" [class.down]="!a.triggered">{{ a.triggered ? 'Triggered' : 'Active' }}</span></td>
            <td class="num muted">{{ a.last_value ?? '—' }}</td>
            <td><button class="ghost" (click)="remove(a.id!)">Delete</button></td>
          </tr>
        </tbody>
      </table>
      <p class="loading" *ngIf="alerts().length === 0 && !error">No alerts yet — create one above.</p>
    </div>
    <p class="error" *ngIf="error">{{ error }}</p>
  `,
})
export class AlertsPage implements OnInit {
  fmtPrice = fmtPrice;
  disclaimer = DISCLAIMER;
  alerts = signal<Alert[]>([]);
  bonds = signal<Bond[]>([]);
  funds = signal<Fund[]>([]);
  error = '';
  form = { alert_type: 'PRICE', instrument: null as number | null, fund: null as number | null, threshold: '', direction: 'ABOVE' };

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.api.alerts().subscribe(a => this.alerts.set(a), () => this.error = 'Could not load alerts — are you logged in?');
    this.api.bonds().subscribe(b => this.bonds.set(b));
    this.api.funds().subscribe(f => this.funds.set(f));
  }

  create() {
    const payload: Alert = {
      alert_type: this.form.alert_type,
      direction: this.form.direction,
      threshold: this.form.threshold,
      active: true,
      instrument: this.form.alert_type === 'NAV' ? null : this.form.instrument,
      fund: this.form.alert_type === 'NAV' ? this.form.fund : null,
    };
    this.api.createAlert(payload).subscribe(() => {
      this.error = '';
      this.api.alerts().subscribe(a => this.alerts.set(a));
    }, (e) => this.error = e?.error?.detail ?? JSON.stringify(e?.error ?? e));
  }

  remove(id: number) {
    this.api.deleteAlert(id).subscribe(() => this.alerts.set(this.alerts().filter(a => a.id !== id)));
  }
}
