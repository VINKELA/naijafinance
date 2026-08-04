import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-legal',
  imports: [CommonModule, RouterLink],
  template: `
    <h2>Terms &amp; Conditions</h2>
    <p class="sub">Effective 2026-08-04 · Naija Finance (data &amp; analytics platform)</p>
    <div class="card" style="margin-bottom:20px;">
      <h3>1. Service nature</h3>
      <p class="muted" style="font-size:13px;line-height:1.6;">Naija Finance is a data and analytics platform only. Nothing on this platform is investment advice, a recommendation, or an offer to buy or sell any security. Market data is delayed or indicative unless marked otherwise, and demo/simulated data is labelled as such.</p>
      <h3>2. Your account</h3>
      <p class="muted" style="font-size:13px;line-height:1.6;">You are responsible for keeping your credentials confidential and for activity under your account. You may use the service for lawful, personal purposes only.</p>
      <h3>3. No warranties</h3>
      <p class="muted" style="font-size:13px;line-height:1.6;">The service is provided "as is" without warranties of any kind. We do not guarantee accuracy, completeness, or timeliness of data.</p>
      <h3>4. Limitation of liability</h3>
      <p class="muted" style="font-size:13px;line-height:1.6;">To the fullest extent permitted by law, Naija Finance shall not be liable for any loss arising from use of the platform or reliance on its data.</p>
    </div>
    <div class="card" style="margin-bottom:20px;">
      <h2>Privacy Policy</h2>
      <h3>1. What we collect</h3>
      <p class="muted" style="font-size:13px;line-height:1.6;">Account data (email, name), and content you create (watchlists, portfolios, alerts). We also collect basic usage analytics events (page views, signups, share clicks) to measure adoption.</p>
      <h3>2. Third-party trackers</h3>
      <p class="muted" style="font-size:13px;line-height:1.6;">We currently use <strong>no third-party advertising or tracking pixels</strong>. Analytics are collected by our own service. If we add third-party trackers in future, this policy will be updated and consent will be requested where required.</p>
      <h3>3. Sharing</h3>
      <p class="muted" style="font-size:13px;line-height:1.6;">We do not sell personal data. Data is shared only with service providers needed to operate the platform, and as required by law.</p>
      <h3>4. Data protection</h3>
      <p class="muted" style="font-size:13px;line-height:1.6;">Personal data is treated as confidential and stored securely. You may request access or deletion of your data at any time.</p>
    </div>
    <p><a routerLink="/market" class="link">← Back to market</a></p>
  `,
})
export class LegalPage {}
