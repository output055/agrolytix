import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportService, FinancialReportData, RevenueReportData, SalesInsightsData, ExpenseReportData, DebtAnalysisData, InventoryInsightsData } from '../../../core/services/report.service';
import { ToastService } from '../../../core/services/toast.service';
import { AuthService } from '../../../core/services/auth.service';
import { LineChartComponent, LineDataset } from '../../../shared/line-chart/line-chart';
import { BarChartComponent } from '../../../shared/bar-chart/bar-chart';
import { DonutChartComponent } from '../../../shared/donut-chart/donut-chart';

type Tab = 'revenue' | 'sales' | 'expenses' | 'debt' | 'inventory';

@Component({
  selector: 'app-reports-view',
  standalone: true,
  imports: [CommonModule, FormsModule, LineChartComponent, BarChartComponent, DonutChartComponent],
  templateUrl: './reports-view.html',
  styleUrls: ['./reports-view.css']
})
export class ReportsView implements OnInit {
  reportService = inject(ReportService);
  toast         = inject(ToastService);
  private authService = inject(AuthService);

  // ── State ──────────────────────────────────────────────────────────────────
  activeTab     = signal<Tab>('revenue');
  loading       = signal(false);

  // Legacy (kept for existing route compatibility)
  report = signal<FinancialReportData | null>(null);

  revenueData   = signal<RevenueReportData | null>(null);
  salesData     = signal<SalesInsightsData | null>(null);
  expenseData   = signal<ExpenseReportData | null>(null);
  debtData      = signal<DebtAnalysisData | null>(null);
  inventoryData = signal<InventoryInsightsData | null>(null);

  selectedPreset = 'this_month';
  dateFrom = '';
  dateTo   = '';

  readonly tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'revenue',   label: 'Revenue',   icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
    { id: 'sales',     label: 'Sales',     icon: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z' },
    { id: 'expenses',  label: 'Expenses',  icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
    { id: 'debt',      label: 'Debt',      icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { id: 'inventory', label: 'Inventory', icon: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4' },
  ];

  readonly PIE_COLORS = ['#4ade80','#f59e0b','#60a5fa','#f87171','#a78bfa','#34d399','#fb923c','#e879f9'];

  get isAdmin(): boolean { return this.authService.currentUser()?.role === 'Admin'; }

  ngOnInit() { this.applyPreset(); }

  setTab(tab: Tab) {
    this.activeTab.set(tab);
    this.loadCurrentTab();
  }

  applyPreset() {
    const today = new Date();
    switch (this.selectedPreset) {
      case 'today': {
        this.dateFrom = this.fmtDate(today);
        this.dateTo   = this.fmtDate(today); break;
      }
      case 'yesterday': {
        const y = new Date(today); y.setDate(today.getDate() - 1);
        this.dateFrom = this.fmtDate(y); this.dateTo = this.fmtDate(y); break;
      }
      case 'this_week': {
        const sw = new Date(today); sw.setDate(today.getDate() - ((today.getDay() + 6) % 7));
        this.dateFrom = this.fmtDate(sw); this.dateTo = this.fmtDate(today); break;
      }
      case 'this_month': {
        this.dateFrom = this.fmtDate(new Date(today.getFullYear(), today.getMonth(), 1));
        this.dateTo   = this.fmtDate(today); break;
      }
      case 'last_month': {
        this.dateFrom = this.fmtDate(new Date(today.getFullYear(), today.getMonth() - 1, 1));
        this.dateTo   = this.fmtDate(new Date(today.getFullYear(), today.getMonth(), 0)); break;
      }
      case 'this_year': {
        this.dateFrom = this.fmtDate(new Date(today.getFullYear(), 0, 1));
        this.dateTo   = this.fmtDate(today); break;
      }
    }
    if (this.selectedPreset !== 'custom') this.loadCurrentTab();
  }

  loadCurrentTab() {
    const tab = this.activeTab();
    if (tab === 'revenue')   this.loadRevenue();
    else if (tab === 'sales')     this.loadSales();
    else if (tab === 'expenses')  this.loadExpenses();
    else if (tab === 'debt')      this.loadDebt();
    else if (tab === 'inventory') this.loadInventory();
  }

  private loadRevenue() {
    this.loading.set(true);
    this.reportService.getRevenueReport(this.dateFrom, this.dateTo).subscribe({
      next: d => { this.revenueData.set(d); this.loading.set(false); },
      error: () => { this.toast.error('Failed to load revenue report'); this.loading.set(false); }
    });
  }
  private loadSales() {
    this.loading.set(true);
    this.reportService.getSalesInsights(this.dateFrom, this.dateTo).subscribe({
      next: d => { this.salesData.set(d); this.loading.set(false); },
      error: () => { this.toast.error('Failed to load sales insights'); this.loading.set(false); }
    });
  }
  private loadExpenses() {
    this.loading.set(true);
    this.reportService.getExpenseReport(this.dateFrom, this.dateTo).subscribe({
      next: d => { this.expenseData.set(d); this.loading.set(false); },
      error: () => { this.toast.error('Failed to load expense report'); this.loading.set(false); }
    });
  }
  private loadDebt() {
    this.loading.set(true);
    this.reportService.getDebtAnalysis().subscribe({
      next: d => { this.debtData.set(d); this.loading.set(false); },
      error: () => { this.toast.error('Failed to load debt analysis'); this.loading.set(false); }
    });
  }
  private loadInventory() {
    this.loading.set(true);
    this.reportService.getInventoryInsights().subscribe({
      next: d => { this.inventoryData.set(d); this.loading.set(false); },
      error: () => { this.toast.error('Failed to load inventory insights'); this.loading.set(false); }
    });
  }

  // ── Chart helpers ──────────────────────────────────────────────────────────
  barPct(value: number, data: number[]): number {
    const max = Math.max(...data, 1);
    return Math.max((value / max) * 100, 2);
  }

  // ── Chart.js dataset builders ───────────────────────────────────────────────
  revenueTrendDatasets(rv: any): LineDataset[] {
    if (!rv?.charts?.trend?.datasets) return [];
    const labels = [
      { label: 'Retail Revenue',    color: '#4ade80' },
      { label: 'Wholesale Revenue', color: '#f59e0b' },
      { label: 'Expenses',          color: '#fb923c', fill: false },
    ];
    return rv.charts.trend.datasets.map((ds: any, i: number) => ({
      label: labels[i]?.label ?? ds.label,
      data:  ds.data,
      color: labels[i]?.color,
      fill:  labels[i]?.fill ?? true,
    }));
  }


  buildLinePoints(data: number[], w = 600, h = 160): string {
    if (!data || data.length < 2) return '';
    const min = Math.min(...data);
    const max = Math.max(...data, min + 1);
    const pts = data.map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / (max - min)) * (h - 16) - 8;
      return `${x},${y}`;
    });
    return pts.join(' ');
  }

  buildLinePath(data: number[], w = 600, h = 160): string {
    if (!data || data.length < 2) return '';
    const min = Math.min(...data);
    const max = Math.max(...data, min + 1);
    const pts = data.map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / (max - min)) * (h - 16) - 8;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return pts.join(' ');
  }

  buildAreaPath(data: number[], w = 600, h = 160): string {
    if (!data || data.length < 2) return '';
    const linePts = this.buildLinePath(data, w, h);
    return `${linePts} L${w},${h} L0,${h} Z`;
  }

  getPieSegments(labels: string[], data: number[]): any[] {
    const total = data.reduce((a, b) => a + b, 0) || 1;
    let accumulated = 0;
    return data.map((v, i) => {
      const pct_display = (v / total) * 100;
      const dashoffset  = 25 - accumulated;
      accumulated      += pct_display;
      return {
        label:       labels[i],
        value:       v,
        pct:         Math.round(pct_display),
        pct_display,
        dashoffset,
        color:       this.PIE_COLORS[i % this.PIE_COLORS.length],
      };
    });
  }

  // ── Formatting ─────────────────────────────────────────────────────────────
  fmtDate(d: Date): string { return d.toISOString().split('T')[0]; }
  fmt(v?: number | string | null): string { return Number(v || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  fmtShort(label: string, maxLen = 14): string { return label?.length > maxLen ? label.substring(0, maxLen) + '\u2026' : (label ?? ''); }
  capitalize(s: string): string { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
}
