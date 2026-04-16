import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SalesFilter } from '../models/sales.model';

@Injectable({ providedIn: 'root' })
export class SalesService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getRetailSales(filter: SalesFilter, page = 1): Observable<any> {
    let params = new HttpParams().set('page', page);
    if (filter.preset)         params = params.set('preset', filter.preset);
    if (filter.date_from)      params = params.set('date_from', filter.date_from);
    if (filter.date_to)        params = params.set('date_to', filter.date_to);
    if (filter.payment_method) params = params.set('payment_method', filter.payment_method);
    if (filter.status)         params = params.set('status', filter.status);
    if (filter.worker_id)      params = params.set('worker_id', String(filter.worker_id));
    return this.http.get(`${this.apiUrl}/sales/retail`, { params });
  }

  getRetailSale(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/sales/retail/${id}`);
  }

  getWholesaleSales(filter: SalesFilter, page = 1): Observable<any> {
    let params = new HttpParams().set('page', page);
    if (filter.preset)         params = params.set('preset', filter.preset);
    if (filter.date_from)      params = params.set('date_from', filter.date_from);
    if (filter.date_to)        params = params.set('date_to', filter.date_to);
    if (filter.payment_method) params = params.set('payment_method', filter.payment_method);
    if (filter.status)         params = params.set('status', filter.status);
    if (filter.worker_id)      params = params.set('worker_id', String(filter.worker_id));
    if (filter.client_id)      params = params.set('client_id', String(filter.client_id));
    return this.http.get(`${this.apiUrl}/sales/wholesale`, { params });
  }

  getWholesaleSale(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/sales/wholesale/${id}`);
  }

  payWholesaleDebt(id: number, payload: { amount_paid: number; note?: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/sales/wholesale/${id}/pay`, payload);
  }
}
