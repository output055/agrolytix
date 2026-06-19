import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Branch {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  parent_id?: number | null;
  created_at?: string;
}

@Injectable({ providedIn: 'root' })
export class BranchService {
  private readonly apiUrl = environment.apiUrl + '/branches';

  constructor(private http: HttpClient) {}

  getBranches(): Observable<Branch[]> {
    return this.http.get<Branch[]>(this.apiUrl);
  }

  createBranch(data: Partial<Branch>): Observable<Branch> {
    return this.http.post<Branch>(this.apiUrl, data);
  }

  updateBranch(id: number, data: Partial<Branch>): Observable<Branch> {
    return this.http.put<Branch>(`${this.apiUrl}/${id}`, data);
  }

  deleteBranch(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }
}
