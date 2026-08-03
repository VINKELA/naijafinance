import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  marketOpen = false;
  lagosTime = '';
  private timer: any;

  ngOnInit() {
    this.tick();
    this.timer = setInterval(() => this.tick(), 1000);
  }
  ngOnDestroy() { clearInterval(this.timer); }

  private tick() {
    const now = new Date();
    const lagos = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Lagos' }));
    this.lagosTime = lagos.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WAT';
    const day = lagos.getDay();
    const mins = lagos.getHours() * 60 + lagos.getMinutes();
    this.marketOpen = day >= 1 && day <= 5 && mins >= 600 && mins <= 870; // Mon–Fri 10:00–14:30 Lagos
  }
}
