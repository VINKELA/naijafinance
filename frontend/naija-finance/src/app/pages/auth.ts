import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../api.service';

@Component({
  selector: 'app-auth',
  imports: [CommonModule, FormsModule],
  template: `
    <h2>Account (F-09)</h2>
    <p class="sub">Email + JWT onboarding — no KYC in v1.</p>

    <div class="card" style="max-width: 420px;">
      <div class="form-row" style="margin-bottom: 14px;">
        <button *ngIf="mode !== 'login'" class="ghost" (click)="mode = 'login'">Login</button>
        <button *ngIf="mode !== 'register'" class="ghost" (click)="mode = 'register'">Register</button>
        <span class="muted" style="font-size: 13px; margin-left: auto;">{{ isAuthed ? 'Signed in' : 'Signed out' }}</span>
      </div>

      <form (ngSubmit)="submit()">
        <div style="display: grid; gap: 10px;">
          <input *ngIf="mode === 'register'" type="text" placeholder="First name" [(ngModel)]="form.first_name" name="first_name">
          <input *ngIf="mode === 'register'" type="text" placeholder="Last name" [(ngModel)]="form.last_name" name="last_name">
          <input type="email" placeholder="Email" [(ngModel)]="form.email" name="email" required>
          <input type="password" placeholder="Password" [(ngModel)]="form.password" name="password" required>
          <input *ngIf="mode === 'register'" type="password" placeholder="Repeat password" [(ngModel)]="form.re_password" name="re_password">
          <button type="submit" [disabled]="busy">{{ busy ? 'Working…' : (mode === 'login' ? 'Sign in' : 'Create account') }}</button>
        </div>
      </form>
      <p class="error" *ngIf="error">{{ error }}</p>
      <p class="muted" style="font-size: 13px; margin-top: 12px;" *ngIf="isAuthed">Signed in as <strong>{{ email }}</strong> — <a href="#" (click)="logout($event)">sign out</a></p>
    </div>
  `,
})
export class AuthPage {
  mode: 'login' | 'register' = 'login';
  busy = false;
  error = '';
  email = '';
  form = { email: '', password: '', re_password: '', first_name: '', last_name: '' };
  constructor(private api: ApiService, private router: Router) {}

  get isAuthed() { return this.api.isAuthed; }

  submit() {
    this.busy = true; this.error = '';
    const done = () => this.busy = false;
    if (this.mode === 'login') {
      this.api.login(this.form.email, this.form.password).subscribe({
        next: (t) => { this.api.saveTokens(t); this.email = this.form.email; this.form.password = ''; },
        error: (e) => { this.error = e?.error?.detail ?? 'Login failed — check credentials.'; done(); },
        complete: done,
      });
    } else {
      this.api.register(this.form).subscribe({
        next: () => { this.mode = 'login'; this.error = 'Account created — sign in.'; },
        error: (e) => { this.error = Object.values(e?.error ?? {}).flat().join(' ') || 'Registration failed.'; done(); },
        complete: done,
      });
    }
  }

  logout(e: Event) { e.preventDefault(); this.api.clearTokens(); }
}
