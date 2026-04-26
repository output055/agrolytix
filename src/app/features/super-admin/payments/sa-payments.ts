import { Component, inject, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DatePipe, DecimalPipe } from '@angular/common';
import { environment } from '../../../../environments/environment';

interface Transaction {
  reference: string;
  amount: number;
  currency: string;
  status: string;
  email: string;
  plan_type: string;
  paid_at: string;
}

@Component({
  selector: 'app-sa-payments',
  standalone: true,
  imports: [DatePipe, DecimalPipe],
  templateUrl: './sa-payments.html',
})
export class SaPayments implements OnInit {
  private http = inject(HttpClient);
  private api  = environment.apiUrl;

  data    = signal<{ total_revenue: number; total_count: number; transactions: Transaction[] } | null>(null);
  loading = signal(true);
  error   = signal(false);

  ngOnInit() {
    this.http.get<any>(`${this.api}/super-admin/payments`).subscribe({
      next: (d) => { this.data.set(d); this.loading.set(false); },
      error: ()  => { this.loading.set(false); this.error.set(true); },
    });
  }
}
