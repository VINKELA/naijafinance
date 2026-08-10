import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../api.service';

@Component({
  selector: 'app-auth',
  imports: [CommonModule, FormsModule],
  template: `
    <h2>Account</h2>
    <div class="card" style="max-width: 420px;" *ngIf="!isAuthed && !showCodeInput && !showRegister">
      <h3>Sign in</h3>
      <p class="sub">Enter your email to receive a one-time code.</p>
      <form (ngSubmit)="requestSignInCode()">
        <div style="display: grid; gap: 10px;">
          <input type="email" placeholder="Email address" [(ngModel)]="signInEmail" name="signInEmail" required>
          <button type="submit" [disabled]="busy">{{ busy ? 'Sending...' : 'Send code' }}</button>
        </div>
      </form>
      <p class="error" *ngIf="error">{{ error }}</p>
    </div>
    <div class="card" style="max-width: 420px;" *ngIf="!isAuthed && showCodeInput">
      <h3>Check your email</h3>
      <p class="sub">We sent a 6-digit code to <strong>{{ codeEmail }}</strong></p>
      <p class="muted">Check your spam folder if you don't see it.</p>
      <form (ngSubmit)="verifyCode()">
        <div style="display: grid; gap: 10px;">
          <input type="text" placeholder="6-digit code" [(ngModel)]="codeInput" name="code" maxlength="6" required autocomplete="one-time-code" inputmode="numeric" style="font-size:20px;text-align:center;letter-spacing:8px;">
          <button type="submit" [disabled]="busy">{{ busy ? 'Verifying...' : 'Verify' }}</button>
        </div>
      </form>
      <p class="error" *ngIf="error">{{ error }}</p>
      <p style="margin-top: 12px;">
        <a (click)="resendCode()" style="cursor:pointer;text-decoration:underline;color:var(--txt3)">Resend code</a>
        &middot;
        <a (click)="resetAuth()" style="cursor:pointer;text-decoration:underline;color:var(--txt3)">Use a different email</a>
      </p>
    </div>
    <div class="card" style="max-width: 420px;" *ngIf="!isAuthed && !showCodeInput && showRegister">
      <h3>Create an account</h3>
      <form (ngSubmit)="register()">
        <div style="display: grid; gap: 10px;">
          <input type="text" placeholder="First name" [(ngModel)]="form.first_name" name="first_name" required>
          <input type="text" placeholder="Last name" [(ngModel)]="form.last_name" name="last_name" required>
          <input type="email" placeholder="Email address" [(ngModel)]="form.email" name="email" required>
          <button type="submit" [disabled]="busy">{{ busy ? 'Sending...' : 'Send verification code' }}</button>
        </div>
      </form>
      <p class="error" *ngIf="error">{{ error }}</p>
      <p style="margin-top: 10px;"><a (click)="showRegister = false; error = ''" style="cursor:pointer;text-decoration:underline;color:var(--blue)">Back to sign in</a></p>
    </div>
    <div class="card" style="max-width: 420px; margin-bottom: 16px;" *ngIf="!isAuthed && !showCodeInput">
      <p class="sub" *ngIf="!showRegister">New to NaijaFinance Hub? Register to track your portfolio and set alerts.<br>
      <button (click)="showRegister = true; error = ''" style="width:100%; margin-top: 8px;">Register</button></p>
    </div>
    <div class="card" style="max-width: 420px;" *ngIf="isAuthed">
      <p class="sub" style="margin-bottom: 10px;">Signed in as <strong>{{ email }}</strong></p>
      <button class="danger" (click)="logout($event)">Sign out</button>
    </div>
  `
})
export class AuthPage {
  busy = false;
  error = '';
  email = '';
  form = { email: '', first_name: '', last_name: '' };
  signInEmail = '';
  codeInput = '';
  codeEmail = '';
  showCodeInput = false;
  showRegister = false;
  isRegistering = false;

  constructor(private api: ApiService, private router: Router, private cdr: ChangeDetectorRef) {}

  get isAuthed() { return this.api.isAuthed; }

  requestSignInCode() {
    const email = this.signInEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) { this.error = 'Enter a valid email address.'; return; }
    this.busy = true; this.error = '';
    this.isRegistering = false; this.codeEmail = email;
    this.api.requestLoginCode(email).subscribe({
      next: (res: any) => {
        if (res.ok === false) { this.busy = false; this.error = res.error || 'Something went wrong.'; this.cdr.detectChanges(); }
        else { this.busy = false; this.showCodeInput = true; }
      },
      error: (e: any) => { this.busy = false; this.error = e?.error?.error || 'Failed to send code.'; this.cdr.detectChanges(); }
    });
  }

  register() {
    const { first_name, last_name, email } = this.form;
    if (!first_name || !last_name || !email || !email.includes('@')) { this.error = 'Please fill in all fields.'; return; }
    this.busy = true; this.error = '';
    this.api.checkEmail(email).subscribe({
      next: (res: any) => {
        if (res.exists) { this.busy = false; this.error = 'An account with this email already exists. Sign in instead.'; this.cdr.detectChanges(); return; }
        this.isRegistering = true; this.codeEmail = email;
        this.api.requestLoginCode(email, first_name, last_name).subscribe({
          next: (r2: any) => {
            if (r2.ok === false) { this.busy = false; this.error = r2.error || 'Failed.'; this.cdr.detectChanges(); }
            else { this.busy = false; this.showCodeInput = true; }
          },
          error: () => { this.busy = false; this.error = 'Failed to send code.'; this.cdr.detectChanges(); }
        });
      },
      error: () => { this.busy = false; this.error = 'Something went wrong.'; this.cdr.detectChanges(); }
    });
  }

  verifyCode() {
    const code = this.codeInput.trim();
    if (!code || code.length !== 6) { this.error = 'Enter the 6-digit code.'; return; }
    this.busy = true; this.error = '';
    this.api.verifyLoginCode(this.codeEmail, code).subscribe({
      next: (tokens: any) => { this.api.saveTokens(tokens); this.email = this.codeEmail; this.router.navigate(['/market']); },
      error: () => { this.busy = false; this.error = 'Invalid or expired code.'; this.cdr.detectChanges(); }
    });
  }

  resendCode() {
    this.busy = true; this.error = '';
    const req = this.isRegistering ? this.api.requestLoginCode(this.codeEmail, this.form.first_name, this.form.last_name) : this.api.requestLoginCode(this.codeEmail);
    req.subscribe({ next: () => { this.busy = false; }, error: () => { this.busy = false; this.error = 'Failed to resend.'; this.cdr.detectChanges(); } });
  }

  resetAuth() { this.showCodeInput = false; this.showRegister = false; this.isRegistering = false; this.codeInput = ''; this.signInEmail = ''; this.form = { email: '', first_name: '', last_name: '' }; this.error = ''; }
  logout(e: Event) { e.preventDefault(); this.api.clearTokens(); this.router.navigate(['/market']); }
}
