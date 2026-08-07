import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-legal',
  imports: [CommonModule, RouterLink],
  template: `
    <h2>Terms &amp; Conditions</h2>
    <p class="sub">Effective 4 Aug 2026 · NaijaFinance Hub (data &amp; analytics platform)</p>
    <div class="card" style="margin-bottom:20px;">
      <h3>1. Service nature</h3>
      <p class="muted" style="font-size:13px;line-height:1.6;">NaijaFinance Hub is a data and analytics platform only. Nothing on this platform is investment advice, a recommendation, or an offer to buy or sell any security. Market data is delayed or indicative unless marked otherwise, and demo/simulated data is labelled as such.</p>
      <h3>2. Your account</h3>
      <p class="muted" style="font-size:13px;line-height:1.6;">You are responsible for keeping your credentials confidential and for activity under your account. You may use the service for lawful, personal purposes only.</p>
      <h3>3. No warranties</h3>
      <p class="muted" style="font-size:13px;line-height:1.6;">The service is provided "as is" without warranties of any kind. We do not guarantee accuracy, completeness, or timeliness of data.</p>
      <h3>4. Limitation of liability</h3>
      <p class="muted" style="font-size:13px;line-height:1.6;">To the fullest extent permitted by law, NaijaFinance Hub shall not be liable for any loss arising from use of the platform or reliance on its data.</p>
    </div>
    <div class="card" style="margin-bottom:20px;">
      <h2>Privacy Policy</h2>
      <h3>1. What we collect</h3>
      <p class="muted" style="font-size:13px;line-height:1.6;">Account data (email, name), content you create (watchlists, portfolios, alerts, asset mixes), and — where you have consented — anonymized usage analytics events (page views, watchlist additions, share clicks) to measure adoption and improve the platform. Analytics events do not contain personal data.</p>
      <h3>2. Third-party trackers</h3>
      <p class="muted" style="font-size:13px;line-height:1.6;">We currently use <strong>no third-party advertising or tracking pixels</strong>. Analytics are collected by our own first-party service. If we add third-party trackers in future, this policy will be updated and consent will be requested where required.</p>
      <h3>3. Analytics &amp; consent</h3>
      <p class="muted" style="font-size:13px;line-height:1.6;">Usage analytics are <strong>opt-in</strong>: you are asked at signup whether you consent to anonymized analytics, and you can withdraw consent at any time from the Account page. No analytics are collected without your consent. Analytics logs are retained for a maximum of 90 days and are not shared with any third party. Your consent choices are recorded with a timestamp and shown on your Account page.</p>
      <h3>4. Sharing</h3>
      <p class="muted" style="font-size:13px;line-height:1.6;">We do not sell personal data. Data is shared only with service providers needed to operate the platform, and as required by law.</p>
      <h3>5. Data protection</h3>
      <p class="muted" style="font-size:13px;line-height:1.6;">Personal data is treated as confidential and stored securely. You may request access, correction, or deletion of your data at any time by contacting us through the platform.</p>
    </div>
    <p><a routerLink="/market" class="link">← Back to market</a></p>
  `,
})
export class LegalPage {}
