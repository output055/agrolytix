import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RetailPosPayload, WholesalePosPayload } from '../models/pos.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PosService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  retailCheckout(payload: RetailPosPayload): Observable<any> {
    return this.http.post(`${this.apiUrl}/pos/retail/checkout`, payload);
  }

  wholesaleCheckout(payload: WholesalePosPayload): Observable<any> {
    return this.http.post(`${this.apiUrl}/pos/wholesale/checkout`, payload);
  }
}
