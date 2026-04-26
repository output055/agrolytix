import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

// ─── Existing interface (preserved) ──────────────────────────────────────────
export interface FinancialReportData {
  period: { from: string; to: string };
  retail: { count: number; revenue: string; profit: string; cost: string } | null;
  wholesale: { count: number; revenue: string; profit: string; cost: string; outstanding_debt: string } | null;
  reversals: { count: number; amount: string; cost: string } | null;
  total_outstanding_debt: string;
  low_stock_products: any[];
  expenses: { total: number; count: number; by_category: any[] };
}

// ─── New interfaces ───────────────────────────────────────────────────────────
export interface ChartDataset { label: string; data: number[] }
export interface ChartData    { labels: string[]; datasets?: ChartDataset[]; data?: number[] }

export interface RevenueReportData {
  summary: {
    total_revenue: number; total_profit: number; total_expenses: number; net_profit: number;
    retail_revenue: number; retail_profit: number; retail_count: number;
    wholesale_revenue: number; wholesale_profit: number; wholesale_count: number;
  };
  charts: { trend: { labels: string[]; datasets: ChartDataset[] } };
}

export interface SalesInsightsData {
  summary: {
    top_retail_product: string | null; top_wholesale_product: string | null;
    top_retail_revenue: number; top_wholesale_revenue: number;
  };
  charts: {
    sales_trend: { labels: string[]; datasets: ChartDataset[] };
    top_retail:    { labels: string[]; data: number[] };
    top_wholesale: { labels: string[]; data: number[] };
  };
  tables: {
    top_retail:    { name: string; qty: number; revenue: number }[];
    top_wholesale: { name: string; qty: number; revenue: number }[];
  };
}

export interface ExpenseReportData {
  summary: { total: number; count: number; categories: number; avg_per_day: number };
  charts: {
    by_category: { labels: string[]; data: number[] };
    trend:       { labels: string[]; data: number[] };
  };
  tables: {
    by_category: { category: string; total: number; count: number; percent: number }[];
  };
}

export interface DebtAnalysisData {
  summary: { total_debt: number; debtors_count: number; highest_debt: number; top_debtor: string | null };
  charts: {
    aging:      { labels: string[]; data: number[] };
    per_client: { labels: string[]; data: number[] };
  };
  tables: {
    clients: { id: number; name: string; contact: string; location: string; debt: number }[];
  };
}

export interface InventoryInsightsData {
  summary: {
    retail_low_stock: number; retail_out_of_stock: number;
    wholesale_low_stock: number; wholesale_out_of_stock: number;
    retail_cost_value: number; retail_sell_value: number;
    wholesale_cost_value: number; wholesale_sell_value: number;
    total_inventory_value: number;
  };
  charts: {
    retail_by_category: { labels: string[]; data: number[] };
  };
  tables: {
    retail_low: any[]; retail_out: any[];
    wholesale_low: any[]; wholesale_out: any[];
  };
}

@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  private dateParams(dateFrom?: string, dateTo?: string): HttpParams {
    let p = new HttpParams();
    if (dateFrom) p = p.set('date_from', dateFrom);
    if (dateTo)   p = p.set('date_to',   dateTo);
    return p;
  }

  // Preserved existing method
  getFinancialReport(dateFrom?: string, dateTo?: string): Observable<FinancialReportData> {
    return this.http.get<FinancialReportData>(`${this.apiUrl}/reports/financial`, { params: this.dateParams(dateFrom, dateTo) });
  }

  getRevenueReport(dateFrom?: string, dateTo?: string): Observable<RevenueReportData> {
    return this.http.get<RevenueReportData>(`${this.apiUrl}/reports/revenue`, { params: this.dateParams(dateFrom, dateTo) });
  }

  getSalesInsights(dateFrom?: string, dateTo?: string): Observable<SalesInsightsData> {
    return this.http.get<SalesInsightsData>(`${this.apiUrl}/reports/sales-insights`, { params: this.dateParams(dateFrom, dateTo) });
  }

  getExpenseReport(dateFrom?: string, dateTo?: string): Observable<ExpenseReportData> {
    return this.http.get<ExpenseReportData>(`${this.apiUrl}/reports/expenses`, { params: this.dateParams(dateFrom, dateTo) });
  }

  getDebtAnalysis(): Observable<DebtAnalysisData> {
    return this.http.get<DebtAnalysisData>(`${this.apiUrl}/reports/debt-analysis`);
  }

  getInventoryInsights(): Observable<InventoryInsightsData> {
    return this.http.get<InventoryInsightsData>(`${this.apiUrl}/reports/inventory-insights`);
  }
}
