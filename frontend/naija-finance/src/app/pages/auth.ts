import { Component, OnInit, signal } from '@angular/core';
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
            <input type="checkbox" [(ngModel)]="form.consent_terms" name="consent_terms" style="margin-top:2px;width:auto;">
            <span>I accept the <a routerLink="/legal" target="_blank" style="text-decoration:underline">Terms &amp; Conditions</a> and the <a routerLink="/legal" target="_blank" style="text-decoration:underline">Privacy Policy</a> (required).</span>
          </label>

          <label *ngIf="mode === 'register'" style="display:flex;gap:8px;align-items:flex-start;font-size:11.5px;color:var(--txt2);line-height:1.4;">
            <input type="checkbox" [(ngModel)]="form.consent_analytics" name="consent_analytics" style="margin-top:2px;width:auto;">
            <span>I consent to basic, anonymized usage analytics (page views, watchlist, share clicks) to improve the platform. No third-party tracking, no personal data is collected for analytics.</span>
          </label>

          <button type="submit" [disabled]="busy || (mode === 'register' && !form.consent_terms)">{{ busy ? 'Working…' : (mode === 'login' ? 'Sign in' : 'Create account') }}</button>
        </div>
      </form>
      <p class="error" *ngIf="error">{{ error }}</p>
    </div>

    <div class="card" style="max-width: 420px;" *ngIf="isAuthed">
      <p class="sub" style="margin-bottom: 10px;">Signed in as <strong>{{ email() }}</strong></p>
      <p class="sub" *ngIf="consentTermsAt()" style="font-size:11.5px;color:var(--txt2);">Consent given: {{ consentTermsAt() }}</p>
      <p class="sub" *ngIf="consentAnalyticsAt()" style="font-size:11.5px;color:var(--txt2);">Analytics consent given: {{ consentAnalyticsAt() }}</p>
      <button *ngIf="consentAnalyticsAt()" class="ghost" (click)="revokeAnalytics()" style="margin-bottom:10px;display:block;">Revoke analytics consent</button>
      <button class="danger" (click)="logout($event)">Sign out</button>
    </div>
  `,
})
export class AuthPage implements OnInit {
  mode: 'login' | 'register' = 'login';
  busy = false;
  error = '';
  email = signal('');
  consentTermsAt = signal('');
  consentAnalyticsAt = signal('');
  form = { email: '', password: '', re_password: '', first_name: '', last_name: '', consent_terms: false, consent_analytics: false };
  constructor(private api: ApiService, private router: Router) {}

  get isAuthed() { return this.api.isAuthed; }

  ngOnInit() { this.loadConsent(); }

  loadConsent() {
    if (!this.isAuthed) return;
    this.api.getUserMe().subscribe({
      next: (u: any) => {
        this.email.set(u.email);
        if (u.consent_terms_at) this.consentTermsAt.set(new Date(u.consent_terms_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }));
        if (u.consent_analytics_at) {
          this.consentAnalyticsAt.set(new Date(u.consent_analytics_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }));
          this.api.setAnalyticsConsent(true);
        }
      },
    });
  }

  submit() {
    this.busy = true; this.error = '';
    const done = () => this.busy = false;
    if (this.mode === 'login') {
      this.api.login(this.form.email, this.form.password).subscribe({
        next: (t) => { this.api.saveTokens(t); this.email.set(this.form.email); this.form.password = ''; this.loadConsent(); this.router.navigate(['/market']); },
        error: (e) => { this.error = e?.error?.detail ?? 'Login failed — check credentials.'; done(); },
        complete: done,
      });
    } else {
      const now = new Date().toISOString();
      const payload: any = {
        email: this.form.email,
        password: this.form.password,
        re_password: this.form.re_password,
        first_name: this.form.first_name,
        last_name: this.form.last_name,
      };
      if (this.form.consent_terms) payload.consent_terms_at = now;
      if (this.form.consent_analytics) {
        payload.consent_analytics_at = now;
        this.api.setAnalyticsConsent(true);
      }
      this.api.register(payload).subscribe({
        next: () => { track('signup'); this.mode = 'login'; this.error = 'Account created — sign in.'; },
        error: (e) => { this.error = Object.values(e?.error ?? {}).flat().join(' ') || 'Registration failed.'; done(); },
        complete: done,
      });
    }
  }

  revokeAnalytics() {
    this.api.revokeAnalyticsConsent().subscribe({
      next: () => {
        this.api.setAnalyticsConsent(false);
        this.consentAnalyticsAt.set('');
      },
    });
  }

  logout(e: Event) { e.preventDefault(); this.api.clearTokens(); this.mode = 'login'; }

  demoLogin() {
    this.busy = true; this.error = '';
    this.api.login('demo@naijafinance.com', 'demo1234').subscribe({
      next: (t) => { this.api.saveTokens(t); this.email.set('demo@naijafinance.com'); this.mode = 'login'; this.router.navigate(['/market']); },
      error: (e) => { this.error = e?.error?.detail ?? 'Demo login failed.'; this.busy = false; },
      complete: () => this.busy = false,
    });
  }
}
