import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../api.service';
import { fmtDate } from '../format';

@Component({
  selector: 'app-blog',
  imports: [CommonModule, RouterLink, FormsModule],
  template: `
    <h2>Blog</h2>
    <p class="sub">NaijaFinanceHub — insights on Nigerian markets, with video + asset deep-dives.</p>
    <p><a *ngIf="authed" routerLink="/blog/new" class="link">✍️ Write a post</a></p>
    <div class="card" style="margin-bottom:20px;">
      <form class="form-row" (ngSubmit)="load()">
        <input type="text" placeholder="Search posts by title…" [(ngModel)]="q" name="q">
        <button type="submit">Search</button>
      </form>
    </div>
    <div class="table-wrap">
      <h3>Latest posts · latest 20 · search for more</h3>
      <table class="data">
        <thead><tr><th>Title</th><th>Author</th><th>Video</th><th>Asset</th><th>Posted</th></tr></thead>
        <tbody>
          <tr *ngFor="let p of posts()">
            <td class="sym"><a [routerLink]="['/blog', p.id]" class="link">{{ p.title }}</a></td>
            <td>{{ p.author_name }}</td>
            <td>{{ p.video_url ? '🎬' : '—' }}</td>
            <td>{{ p.asset_url ? '📈' : '—' }}</td>
            <td class="num">{{ fmtDate(p.created_at) }}</td>
          </tr>
        </tbody>
      </table>
      <p class="loading" *ngIf="!error && !posts().length">No posts yet — be the first to write.</p>
      <p class="error" *ngIf="error">{{ error }}</p>
    </div>
  `,
})
export class BlogPage implements OnInit {
  posts = signal<any[]>([]);
  fmtDate = fmtDate;
  q = '';
  error = '';
  constructor(private api: ApiService) {}
  get authed() { return this.api.isAuthed; }
  ngOnInit() { this.load(); }
  load() {
    this.api.posts(this.q.trim() || undefined).subscribe({
      next: (ps) => this.posts.set(ps),
      error: () => this.error = 'Could not load posts.',
    });
  }
}
