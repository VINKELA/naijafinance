import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiService } from './api.service';

/** Blocks every equities route while the product gate is closed. */
@Injectable({ providedIn: 'root' })
export class EquitiesGuard implements CanActivate {
  constructor(private api: ApiService, private router: Router) {}

  canActivate(): Observable<boolean | UrlTree> {
    return this.api.config().pipe(
      map(c => (c?.equities_enabled ? true : this.router.createUrlTree(['/market']))),
      catchError(() => of(this.router.createUrlTree(['/market']))),
    );
  }
}
