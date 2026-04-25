import { Component, inject, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-sa-overview',
  standalone: true,
  imports: [DatePipe, DecimalPipe, RouterLink],
  templateUrl: './sa-overview.html',
})
export class SaOverview implements OnInit {
  private http = inject(HttpClient);
  private api  = environment.apiUrl;

  stats   = signal<any>(null);
  loading = signal(true);

  ngOnInit() {
    this.http.get<any>(`${this.api}/super-admin/stats`).subscribe({
      next: (data) => { this.stats.set(data); this.loading.set(false); },
      error: ()     => this.loading.set(false),
    });
  }
}
