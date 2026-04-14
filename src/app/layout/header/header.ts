import { Component, inject, computed } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { LayoutService } from '../../core/services/layout.service';
import { Router, NavigationEnd } from '@angular/router';
import { filter, map } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [],
  templateUrl: './header.html',
})
export class Header {
  private auth    = inject(AuthService);
  private router  = inject(Router);
  layoutService   = inject(LayoutService);

  user    = computed(() => this.auth.currentUser());
  initials = computed(() => {
    const name = this.user()?.name ?? 'U';
    return name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  });

  logout() {
    this.auth.logout().subscribe();
  }
}
