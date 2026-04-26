import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Expense, ExpenseFilter } from '../models/expense.model';

export interface PaginatedExpenses {
  data: Expense[];
  current_page: number;
  last_page: number;
  total: number;
  per_page: number;
}

@Injectable({ providedIn: 'root' })
export class ExpenseService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getExpenses(filter: ExpenseFilter = {}, page = 1): Observable<PaginatedExpenses> {
    let params = new HttpParams().set('page', page);
    if (filter.date_from)  params = params.set('date_from',  filter.date_from);
    if (filter.date_to)    params = params.set('date_to',    filter.date_to);
    if (filter.category)   params = params.set('category',   filter.category);
    if (filter.search)     params = params.set('search',     filter.search);
    if (filter.worker_id)  params = params.set('worker_id',  String(filter.worker_id));
    return this.http.get<PaginatedExpenses>(`${this.apiUrl}/expenses`, { params });
  }

  getTodayStats(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/expenses/today-stats`);
  }

  createExpense(payload: Omit<Expense, 'id' | 'recorder' | 'created_at' | 'recorded_by' | 'expense_date'>): Observable<Expense> {
    return this.http.post<Expense>(`${this.apiUrl}/expenses`, payload);
  }

  deleteExpense(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiUrl}/expenses/${id}`);
  }
}
