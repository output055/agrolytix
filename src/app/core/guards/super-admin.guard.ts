import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const superAdminGuard = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isSuperAdmin()) {
    return true;
  }

  // Not a super admin — send them to the shop dashboard
  router.navigate(['/dashboard']);
  return false;
};
