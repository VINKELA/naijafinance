import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ApiService } from '../api.service';
import { fmtPrice, fmtPct } from '../format';

@Component({
  selector: 'app-blog-post',
  imports: [CommonModule, RouterLink],
  template: `
    <ng-container *ngIf="post()">
      <h2>{{ post().title }}</h2>
      <p class="sub">By {{ post().author_name }} · {{ (post().created_at || '').slice(0, 10) }}</p>
      <div class="card" style="margin-bottom:20px;">
        <p style="white-space:pre-wrap;">{{ post().body }}</p>
      </div>
      <div class="card" style="margin-bottom:20px;" *ngIf="embedUrl()">
        <h3>Video</h3>
        <iframe [src]="embedUrl()!" width="100%" height="360" frameborder="0" allowfullscreen
          style="border:none;border-radius:12px;" title="Embedded video"></iframe>
      </div>
      <div class="card" style="margin-bottom:20px;" *ngIf="asset()">
        <h3>Related asset</h3>
        <div class="stat-grid" style="margin-bottom:0;">
          <div class="stat-tile">
            <div class="label">{{ asset().name }}</div>
            <div class="value" style="font-size:16px;">{{ asset().price }}</div>
            <div class="delta" [class.up]="asset().isUp" [class.down]="!asset().isUp">{{ asset().change }}</div>
          </div>
        </div>
        <p style="margin:10px 0 0;"><a [routerLink]="[asset().link]" class="link">Open full information page →</a></p>
      </div>
      <a routerLink="/blog" class="link">← All posts</a>
    </ng-container>
    <p class="loading" *ngIf="!post() && !error">Loading post…</p>
    <p class="error" *ngIf="error">{{ error }}</p>
  `,
})
export class BlogPostPage implements OnInit {
  post = signal<any>(null);
  asset = signal<any>(null);
  error = '';
  constructor(private api: ApiService, private route: ActivatedRoute, private sanitizer: DomSanitizer) {}
  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.api.postDetail(id).subscribe({
      next: (p) => { this.post.set(p); this.resolveAsset(p.asset_url); },
      error: () => this.error = 'Post not found.',
    });
  }
  embedUrl(): SafeResourceUrl | null {
    const u = this.post()?.video_url || '';
    const m = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
    return m ? this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.youtube.com/embed/${m[1]}`) : null;
  }
  resolveAsset(url: string) {
    if (!url) return;
    const m = url.match(/\/symbol\/([A-Za-z0-9.-]+)/);
    if (m) {
      this.api.stockDetail(m[1]).subscribe({
        next: (d) => this.asset.set({
          name: d.name || m[1],
          price: '₦' + fmtPrice(d.price),
          change: `${d.isUp ? '▲' : '▼'} ${fmtPct(d.changePct)}`,
          isUp: !!d.isUp,
          link: '/symbol?symbol=' + m[1],
        }),
        error: () => this.asset.set({ name: m[1], price: '—', change: '', isUp: true, link: url }),
      });
    } else {
      this.asset.set({ name: 'View linked asset', price: '', change: '', isUp: true, link: url });
    }
  }
}
