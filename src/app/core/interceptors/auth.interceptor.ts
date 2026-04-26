import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token  = localStorage.getItem('auth_token');
  const router = inject(Router);

  const cloned = req.clone({
    setHeaders: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      Accept: 'application/json',
    }
  });

  return next(cloned).pipe(
    catchError(err => {
      // 402 = subscription expired / trial ended — redirect to billing
      if (err.status === 402) {
        router.navigate(['/billing']);
      }
      return throwError(() => err);
    })
  );
};
