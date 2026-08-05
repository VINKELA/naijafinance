import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../api.service';

@Component({
  selector: 'app-blog-editor',
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <h2>Write a post</h2>
    <p class="sub">Only signed-up users can publish (same rule as Asset Mix).</p>
    <p class="error" *ngIf="error">{{ error }}</p>
    <div class="card">
      <form (ngSubmit)="save()">
        <input type="text" placeholder="Title (e.g. Why DANGCEM matters in 2026)" [(ngModel)]="form.title" name="title" required style="width:100%;margin-bottom:10px;">
        <textarea placeholder="Write your analysis here…" [(ngModel)]="form.body" name="body" rows="8" style="width:100%;margin-bottom:10px;"></textarea>
        <input type="url" placeholder="YouTube video URL (optional) — embeds automatically" [(ngModel)]="form.video_url" name="video_url" style="width:100%;margin-bottom:10px;">
        <input type="text" placeholder="Asset link (optional) — e.g. /symbol/DANGCEM — renders as an info card" [(ngModel)]="form.asset_url" name="asset_url" style="width:100%;margin-bottom:10px;">
        <button type="submit" [disabled]="busy || !form.title.trim()">{{ busy ? 'Publishing…' : 'Publish post' }}</button>
      </form>
    </div>
    <p style="margin-top:12px;"><a routerLink="/blog" class="link">← All posts</a></p>
  `,
})
export class BlogEditorPage {
  form = { title: '', body: '', video_url: '', asset_url: '' };
  busy = false;
  error = '';
  constructor(private api: ApiService, private router: Router) {}
  save() {
    if (!this.form.title.trim() || this.busy) return;
    this.busy = true;
    this.api.createPost({ ...this.form }).subscribe({
      next: (p) => this.router.navigate(['/blog', p.id]),
      error: (e) => { this.busy = false; this.error = e?.error?.detail || 'Could not publish — are you signed in?'; },
    });
  }
}
