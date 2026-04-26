import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SuperAdminSidebar } from '../super-admin-sidebar/super-admin-sidebar';
import { SuperAdminHeader } from '../super-admin-header/super-admin-header';

@Component({
  selector: 'app-super-admin-layout',
  standalone: true,
  imports: [RouterOutlet, SuperAdminSidebar, SuperAdminHeader],
  templateUrl: './super-admin-layout.html',
})
export class SuperAdminLayout {
  sidebarOpen = signal(false);

  toggleSidebar() {
    this.sidebarOpen.update(v => !v);
  }

  closeSidebar() {
    this.sidebarOpen.set(false);
  }
}
