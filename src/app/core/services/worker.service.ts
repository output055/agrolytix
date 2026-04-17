import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface Worker {
  id: number;
  name: string;
  email: string;
  status: 'active' | 'inactive';
  role: 'Admin' | 'Worker';
  contact: string | null;
  permissions: string[];
  last_login_at: string | null;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class WorkerService {
  private readonly apiUrl = environment.apiUrl + '/workers';

  constructor(private http: HttpClient) {}

  getWorkers() {
    return this.http.get<Worker[]>(this.apiUrl);
  }

  createWorker(data: any) {
    return this.http.post<Worker>(this.apiUrl, data);
  }

  updateWorker(id: number, data: any) {
    return this.http.put<Worker>(`${this.apiUrl}/${id}`, data);
  }

  updateStatus(id: number, status: 'active' | 'inactive') {
    return this.http.patch<Worker>(`${this.apiUrl}/${id}/status`, { status });
  }

  deleteWorker(id: number) {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/${id}`);
  }
}
