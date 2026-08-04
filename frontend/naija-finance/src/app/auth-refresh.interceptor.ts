import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { ApiService } from './api.service';

/** AUTH-1: on 401 from an auth-scoped call, refresh the access token once and retry; on refresh failure, sign out cleanly. */
export const authRefreshInterceptor: HttpInterceptorFn = (req, next) => {
  const api = inject(ApiService);
  const router = inject(Router);
  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status !== 401) return throwError(() => err);
      const url = req.url;
      if (url.includes('/auth/')) return throwError(() => err); // never loop on auth endpoints
      const refresh = localStorage.getItem('nf_refresh');
      if (!refresh) return throwError(() => err);
      return api.refreshTokens(refresh).pipe(
        switchMap((tokens) => {
          api.saveTokens(tokens);
          const retry = req.clone({ setHeaders: { Authorization: `Bearer ${tokens.access}` } });
          return next(retry);
        }),
        catchError((refreshErr) => {
          api.clearTokens();
          router.navigate(['/account']);
          return throwError(() => refreshErr);
        })
      );
    })
  );
};
