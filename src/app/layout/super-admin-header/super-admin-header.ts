import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-super-admin-header',
  standalone: true,
  imports: [],
  templateUrl: './super-admin-header.html',
})
export class SuperAdminHeader {
  auth   = inject(AuthService);
  router = inject(Router);
  user   = this.auth.currentUser;

  logout() {
    this.auth.logout().subscribe(() => this.router.navigate(['/auth']));
  }
}
