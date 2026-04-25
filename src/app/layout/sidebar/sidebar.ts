import { Component, inject, computed } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LayoutService } from '../../core/services/layout.service';
import { AuthService } from '../../core/services/auth.service';
import { UpperCasePipe } from '@angular/common';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, UpperCasePipe],
  templateUrl: './sidebar.html',
})
export class Sidebar {
  layoutService = inject(LayoutService);
  authService   = inject(AuthService);
  user = computed(() => this.authService.currentUser());
  role = computed(() => this.user()?.role ?? 'Worker');
  isAdmin = computed(() => this.role() === 'Admin');

  hasPermission(permission: string): boolean {
    return this.authService.hasPermission(permission);
  }
}
