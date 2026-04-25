import { Component, inject, computed } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { Sidebar } from '../sidebar/sidebar';
import { Header } from '../header/header';
import { LayoutService } from '../../core/services/layout.service';
import { Toast } from '../../shared/toast/toast';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, Sidebar, Header, Toast, RouterLink],
  templateUrl: './app-layout.html',
})
export class AppLayout {
  layoutService = inject(LayoutService);
  private auth  = inject(AuthService);

  user = computed(() => this.auth.currentUser());

  /** Show warning banner when trial expires in ≤5 days */
  trialWarning = computed(() => {
    const business = this.user()?.business;
    if (!business || business.subscription_status !== 'trialing') return null;

    const trialEnd = business.trial_ends_at ? new Date(business.trial_ends_at) : null;
    if (!trialEnd) return null;

    const daysLeft = Math.ceil((trialEnd.getTime() - Date.now()) / 86400000);
    if (daysLeft > 5) return null;

    return daysLeft > 0
      ? `Your free trial expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. Subscribe to avoid losing access.`
      : 'Your free trial has expired. Subscribe now to restore access.';
  });
}
