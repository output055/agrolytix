import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuditLogResponse } from '../models/audit-log.model';

@Injectable({
  providedIn: 'root'
})
export class AuditLogService {
  private apiUrl = `${environment.apiUrl}/audit-logs`;

  constructor(private http: HttpClient) {}

  getLogs(page: number = 1, filters: any = {}): Observable<AuditLogResponse> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('per_page', '50');

    Object.keys(filters).forEach(key => {
      if (filters[key]) {
        params = params.set(key, filters[key]);
      }
    });

    return this.http.get<AuditLogResponse>(this.apiUrl, { params });
  }

  exportLogs(format: 'csv' | 'json' = 'csv', filters: any = {}): void {
    let params = new HttpParams().set('format', format);

    Object.keys(filters).forEach(key => {
      if (filters[key]) {
        params = params.set(key, filters[key]);
      }
    });

    const exportUrl = `${this.apiUrl}/export?${params.toString()}`;
    window.open(exportUrl, '_blank');
  }
}
