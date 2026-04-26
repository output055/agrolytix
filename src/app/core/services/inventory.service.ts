import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Product, WholesaleProduct, PaginatedResponse } from '../models/inventory.model';
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
}
