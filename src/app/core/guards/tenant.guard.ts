import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const tenantGuard = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isSuperAdmin()) {
    router.navigate(['/super-admin/dashboard']);
    return false;
  }

  return true;
};
