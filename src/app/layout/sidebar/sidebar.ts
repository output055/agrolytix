import { Component, inject, computed } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LayoutService } from '../../core/services/layout.service';
import { AuthService } from '../../core/services/auth.service';
import { ChatService } from '../../core/services/chat.service';


@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
})
export class Sidebar {
  layoutService = inject(LayoutService);
  authService   = inject(AuthService);
  chatService   = inject(ChatService);

  user         = computed(() => this.authService.currentUser());
  role         = computed(() => this.user()?.role ?? 'Worker');
  isAdmin      = computed(() => this.role() === 'Admin');
  isMainBranch = computed(() => this.isAdmin() && !this.user()?.business?.parent_id);
  isSuperAdmin = computed(() => this.authService.isSuperAdmin());
  unreadChatCount = computed(() => this.chatService.unreadTotal());

  hasPermission(permission: string): boolean {
    return this.authService.hasPermission(permission);
  }
}

