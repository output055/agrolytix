import { Component, inject, signal, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { KpiCard } from '../../../shared/kpi-card/kpi-card';
import { AuthService } from '../../../core/services/auth.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-dashboard-view',
  standalone: true,
  imports: [KpiCard],
  templateUrl: './dashboard-view.html',
})
export class DashboardView implements OnInit {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private api  = environment.apiUrl;

  user    = this.auth.currentUser;
  stats   = signal<any>(null);
  loading = signal(true);

  formatCurrency(val: number) {
    return '₦' + (val ?? 0).toLocaleString('en-NG', { minimumFractionDigits: 2 });
  }

  ngOnInit() {
    this.http.get<any>(`${this.api}/dashboard/stats`).subscribe({
      next:  s => { this.stats.set(s); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }
}
