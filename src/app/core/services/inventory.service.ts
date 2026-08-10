import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Product, WholesaleProduct, PaginatedResponse, StockTransferPayload, StockTransfer, EligibleBusiness } from '../models/inventory.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class InventoryService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // --- Retail Inventory ---

  getRetailProducts(params?: any): Observable<Product[] | PaginatedResponse<Product>> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null) {
          httpParams = httpParams.set(key, String(params[key]));
        }
      });
    }
    return this.http.get<any>(`${this.apiUrl}/products`, { params: httpParams });
  }

  getRetailCategories(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/products/categories`);
  }

  getRetailProduct(id: number): Observable<Product> {
    return this.http.get<Product>(`${this.apiUrl}/products/${id}`);
  }

  createRetailProduct(payload: Partial<Product>): Observable<Product> {
    return this.http.post<Product>(`${this.apiUrl}/products`, payload);
  }

  updateRetailProduct(id: number, payload: Partial<Product>): Observable<Product> {
    return this.http.put<Product>(`${this.apiUrl}/products/${id}`, payload);
  }

  deleteRetailProduct(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/products/${id}`);
  }

  restockRetailProduct(id: number, quantity: number): Observable<Product> {
    return this.http.patch<Product>(`${this.apiUrl}/products/${id}/restock`, { quantity });
  }

  // --- Wholesale Inventory ---

  getWholesaleProducts(params?: any): Observable<WholesaleProduct[] | PaginatedResponse<WholesaleProduct>> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null) {
          httpParams = httpParams.set(key, String(params[key]));
        }
      });
    }
    return this.http.get<any>(`${this.apiUrl}/wholesale-products`, { params: httpParams });
  }

  getWholesaleCategories(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/wholesale-products/categories`);
  }


  getWholesaleProduct(id: number): Observable<WholesaleProduct> {
    return this.http.get<WholesaleProduct>(`${this.apiUrl}/wholesale-products/${id}`);
  }

  createWholesaleProduct(payload: Partial<WholesaleProduct>): Observable<WholesaleProduct> {
    return this.http.post<WholesaleProduct>(`${this.apiUrl}/wholesale-products`, payload);
  }

  updateWholesaleProduct(id: number, payload: Partial<WholesaleProduct>): Observable<WholesaleProduct> {
    return this.http.put<WholesaleProduct>(`${this.apiUrl}/wholesale-products/${id}`, payload);
  }

  deleteWholesaleProduct(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/wholesale-products/${id}`);
  }

  restockWholesaleProduct(id: number, quantity: number): Observable<WholesaleProduct> {
    return this.http.patch<WholesaleProduct>(`${this.apiUrl}/wholesale-products/${id}/restock`, { quantity });
  }

  // --- Stock Transfers ---

  transferStock(payload: StockTransferPayload): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/stock-transfers`, payload);
  }

  getStockTransfers(params?: any): Observable<PaginatedResponse<StockTransfer>> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null) {
          httpParams = httpParams.set(key, String(params[key]));
        }
      });
    }
    return this.http.get<PaginatedResponse<StockTransfer>>(`${this.apiUrl}/stock-transfers`, { params: httpParams });
  }

  getEligibleBusinesses(): Observable<EligibleBusiness[]> {
    return this.http.get<EligibleBusiness[]>(`${this.apiUrl}/stock-transfers/eligible-businesses`);
  }

  getEligibleProducts(targetBusinessId: number, type: 'retail' | 'wholesale'): Observable<Product[]> {
    const params = new HttpParams()
      .set('target_business_id', String(targetBusinessId))
      .set('type', type);
    return this.http.get<Product[]>(`${this.apiUrl}/stock-transfers/eligible-products`, { params });
  }
}
