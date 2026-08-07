import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private api: ApiService, private router: Router) {}
  canActivate(): boolean {
    if (this.api.isAuthed) return true;
    this.router.navigate(['/account']);
    return false;
  }
}
