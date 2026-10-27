import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token  = localStorage.getItem('auth_token');
  const router = inject(Router);

  // Only attach Laravel session token to our backend API endpoints
  const isApiRequest = req.url.startsWith(environment.apiUrl) || req.url.startsWith('/api');

  let cloned = req;
  if (isApiRequest) {
    cloned = req.clone({
      setHeaders: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        Accept: 'application/json',
      }
    });
  }

  return next(cloned).pipe(
    catchError(err => {
      // 402 = subscription expired / trial ended — redirect to billing (only for API)
      if (err.status === 402 && isApiRequest) {
        router.navigate(['/billing']);
      }
      return throwError(() => err);
    })
  );
};
