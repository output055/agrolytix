import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-super-admin-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './super-admin-sidebar.html',
})
export class SuperAdminSidebar {
  auth = inject(AuthService);
  user = this.auth.currentUser;
}
