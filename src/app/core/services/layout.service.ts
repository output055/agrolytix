import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LayoutService {
  private _sidebarOpen = signal(false);
  isMobileSidebarOpen = this._sidebarOpen.asReadonly();

  openSidebar()  { this._sidebarOpen.set(true); }
  closeSidebar() { this._sidebarOpen.set(false); }
  toggleSidebar() { this._sidebarOpen.update(v => !v); }
}
