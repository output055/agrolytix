import { Component, inject, computed } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LayoutService } from '../../core/services/layout.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
})
export class Sidebar {
  layoutService = inject(LayoutService);
  authService   = inject(AuthService);
  role = computed(() => this.authService.currentUser()?.role ?? 'Worker');
  isAdmin = computed(() => this.role() === 'Admin');

  hasPermission(permission: string): boolean {
    return this.authService.hasPermission(permission);
  }
}
