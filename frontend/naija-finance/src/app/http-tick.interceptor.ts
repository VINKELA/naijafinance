import { HttpEvent, HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { ApplicationRef, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';

/**
 * Demo stopgap: force the view to refresh AFTER each HTTP response is
 * delivered to subscribers. Ticking synchronously in `tap` runs before the
 * component's `next()` handler, so we defer via microtask to guarantee the
 * assignment has landed before change detection runs.
 */
export function httpTickInterceptor(req: HttpRequest<unknown>, next: HttpHandlerFn): Observable<HttpEvent<unknown>> {
  const appRef = inject(ApplicationRef);
  return next(req).pipe(
    tap(() => {
      queueMicrotask(() => {
        try { appRef.tick(); } catch { /* noop */ }
      });
    }),
  );
}
