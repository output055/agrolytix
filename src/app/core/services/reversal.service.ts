import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Reversal } from '../models/reversal.model';

@Injectable({ providedIn: 'root' })
export class ReversalService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getReversals(): Observable<Reversal[]> {
    return this.http.get<Reversal[]>(`${this.apiUrl}/reversals`);
  }

  reverseSale(retailSaleId: number, items: {id: number, quantity: number}[], reason?: string): Observable<Reversal> {
    return this.http.post<Reversal>(`${this.apiUrl}/reversals`, {
      retail_sale_id: retailSaleId,
      items: items,
      reason: reason || null,
    });
  }
}
