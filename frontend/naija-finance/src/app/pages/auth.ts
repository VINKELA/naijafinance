import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../api.service';
import { track } from '../analytics';

@Component({
  selector: 'app-auth',
  imports: [CommonModule, FormsModule],
  template: `
    <h2>Account</h2>
    <p class="sub">Email + JWT onboarding — no KYC in v1.</p>

    <div class="card" style="max-width: 420px; margin-bottom: 16px;" *ngIf="!isAuthed">
      <p class="sub" style="margin-bottom: 10px;">Demo access (one click):</p>
      <button (click)="demoLogin()" [disabled]="busy">{{ busy ? 'Signing in…' : 'Log in with demo account' }}</button>
    </div>

    <div class="card" style="max-width: 420px;" *ngIf="!isAuthed">
      <div class="form-row" style="margin-bottom: 14px;">
        <button *ngIf="mode !== 'login'" class="ghost" (click)="mode = 'login'">Login</button>
        <button *ngIf="mode !== 'register'" class="ghost" (click)="mode = 'register'">Register</button>
      </div>

      <form (ngSubmit)="submit()">
        <div style="display: grid; gap: 10px;">
          <input *ngIf="mode === 'register'" type="text" placeholder="First name" [(ngModel)]="form.first_name" name="first_name">
          <input *ngIf="mode === 'register'" type="text" placeholder="Last name" [(ngModel)]="form.last_name" name="last_name">
          <input type="email" placeholder="Email" [(ngModel)]="form.email" name="email" required>
          <input type="password" placeholder="Password" [(ngModel)]="form.password" name="password" required>
          <input *ngIf="mode === 'register'" type="password" placeholder="Repeat password" [(ngModel)]="form.re_password" name="re_password">
          <label *ngIf="mode === 'register'" style="display:flex;gap:8px;align-items:flex-start;font-size:11.5px;color:var(--txt2);line-height:1.4;">
            <input type="checkbox" [(ngModel)]="form.consent" name="consent" style="margin-top:2px;width:auto;">
            <span>I accept the <a routerLink="/legal" target="_blank" style="text-decoration:underline">Terms &amp; Conditions</a> and the <a routerLink="/legal" target="_blank" style="text-decoration:underline">Privacy Policy</a> (required).</span>
          </label>
          <button type="submit" [disabled]="busy || (mode === 'register' && !form.consent)">{{ busy ? 'Working…' : (mode === 'login' ? 'Sign in' : 'Create account') }}</button>
        </div>
      </form>
      <p class="error" *ngIf="error">{{ error }}</p>
    </div>

    <div class="card" style="max-width: 420px;" *ngIf="isAuthed">
      <p class="sub" style="margin-bottom: 10px;">Signed in as <strong>{{ email }}</strong></p>
      <button class="danger" (click)="logout($event)">Sign out</button>
    </div>
  `,
})
export class AuthPage {
  mode: 'login' | 'register' = 'login';
  busy = false;
  error = '';
  email = '';
  form = { email: '', password: '', re_password: '', first_name: '', last_name: '', consent: false };
  constructor(private api: ApiService, private router: Router) {}

  get isAuthed() { return this.api.isAuthed; }

  submit() {
    this.busy = true; this.error = '';
    const done = () => this.busy = false;
    if (this.mode === 'login') {
      this.api.login(this.form.email, this.form.password).subscribe({
        next: (t) => { this.api.saveTokens(t); this.email = this.form.email; this.form.password = ''; this.router.navigate(['/market']); },
        error: (e) => { this.error = e?.error?.detail ?? 'Login failed — check credentials.'; done(); },
        complete: done,
      });
    } else {
      this.api.register(this.form).subscribe({
        next: () => { track('signup', { email: this.form.email }); this.mode = 'login'; this.error = 'Account created — sign in.'; },
        error: (e) => { this.error = Object.values(e?.error ?? {}).flat().join(' ') || 'Registration failed.'; done(); },
        complete: done,
      });
    }
  }

  logout(e: Event) { e.preventDefault(); this.api.clearTokens(); this.mode = 'login'; }

  demoLogin() {
    this.busy = true; this.error = '';
    this.api.login('demo@naijafinance.com', 'demo1234').subscribe({
      next: (t) => { this.api.saveTokens(t); this.email = 'demo@naijafinance.com'; this.mode = 'login'; this.router.navigate(['/market']); },
      error: (e) => { this.error = e?.error?.detail ?? 'Demo login failed.'; this.busy = false; },
      complete: () => this.busy = false,
    });
  }
}
