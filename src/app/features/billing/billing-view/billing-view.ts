import { Component, inject, signal, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { environment } from '../../../../environments/environment';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-billing-view',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './billing-view.html',
})
export class BillingView implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private auth  = inject(AuthService);
  private api   = environment.apiUrl;

  user         = this.auth.currentUser;
  status       = signal<any>(null);
  loading      = signal(true);
  subscribing  = signal(false);
  notification = signal<{ type: 'success' | 'error'; message: string } | null>(null);
  selectedPlan = signal<'monthly' | 'annual'>('monthly');

  ngOnInit() {
    // Show notification if redirected back from Paystack
    const payStatus = this.route.snapshot.queryParamMap.get('status');
    if (payStatus === 'success') {
      this.notification.set({ type: 'success', message: 'Payment successful! Your subscription is now active.' });
    } else if (payStatus === 'failed') {
      this.notification.set({ type: 'error', message: 'Payment was not completed. Please try again.' });
    }

    this.loadStatus();
  }

  loadStatus() {
    this.loading.set(true);
    this.http.get<any>(`${this.api}/subscription`).subscribe({
      next: s => { this.status.set(s); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  subscribe() {
    this.subscribing.set(true);
    this.http.post<any>(`${this.api}/subscription/initiate`, { plan: this.selectedPlan() }).subscribe({
      next: res => {
        // Redirect to Paystack hosted checkout
        window.location.href = res.authorization_url;
      },
      error: () => {
        this.notification.set({ type: 'error', message: 'Could not initiate payment. Please try again.' });
        this.subscribing.set(false);
      },
    });
  }

  get statusBadge(): { label: string; color: string } {
    const s = this.status()?.subscription_status;
    switch (s) {
      case 'active':    return { label: 'Active',    color: '#4ade80' };
      case 'trialing':  return { label: 'Trial',     color: '#f59e0b' };
      case 'past_due':  return { label: 'Past Due',  color: '#f87171' };
      case 'cancelled': return { label: 'Cancelled', color: '#9ca3af' };
      default:          return { label: 'Unknown',   color: '#9ca3af' };
    }
  }

  get canSubscribe(): boolean {
    const s = this.status()?.subscription_status;
    return s !== 'active';
  }
}
