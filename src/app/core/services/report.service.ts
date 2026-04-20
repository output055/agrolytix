import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface FinancialReportData {
  period: { from: string; to: string };
  retail: { count: number; revenue: string; profit: string; cost: string } | null;
  wholesale: { count: number; revenue: string; profit: string; cost: string; outstanding_debt: string } | null;
  reversals: { count: number; amount: string; cost: string } | null;
  total_outstanding_debt: string;
  low_stock_products: any[];
}

@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getFinancialReport(dateFrom?: string, dateTo?: string): Observable<FinancialReportData> {
    let params = new HttpParams();
    if (dateFrom) params = params.set('date_from', dateFrom);
    if (dateTo) params = params.set('date_to', dateTo);
    
    return this.http.get<FinancialReportData>(`${this.apiUrl}/reports/financial`, { params });
  }
}
