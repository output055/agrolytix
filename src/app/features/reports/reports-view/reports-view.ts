import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportService, FinancialReportData } from '../../../core/services/report.service';
import { ToastService } from '../../../core/services/toast.service';
import { AuthService } from '../../../core/services/auth.service';


@Component({
  selector: 'app-reports-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-6 max-w-7xl mx-auto">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 class="text-3xl font-bold tracking-tight" style="color: #f0fdf4;">Financial Reports</h1>
          <p class="text-sm mt-1" style="color: #9ca3af;">Comprehensive overview of platform transactions and inventory health</p>
        </div>
        
        <div class="flex flex-col md:flex-row items-end md:items-center gap-3">
          <select [(ngModel)]="selectedPreset" (change)="applyPreset()"
                  class="px-3 py-2.5 rounded-xl text-sm font-medium border outline-none cursor-pointer"
                  style="color: #f3f4f6; border-color: rgba(255,255,255,0.08); background: #0a150a;">
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="this_week">This Week</option>
            <option value="this_month">This Month</option>
            <option value="last_month">Last Month</option>
            <option value="this_year">This Year</option>
            <option value="custom">Custom Range</option>
          </select>

          @if (selectedPreset === 'custom') {
            <div class="flex items-center gap-3 p-2 rounded-2xl border" style="background: rgba(10,21,10,0.97); border-color: rgba(255,255,255,0.08);">
              <div class="flex items-center gap-2 px-2">
                <input type="date" [(ngModel)]="dateFrom" (change)="loadReport()"
                       class="bg-transparent border-none outline-none text-sm font-medium" style="color: #f3f4f6; color-scheme: dark;">
              </div>
              <span style="color: #6b7280;">to</span>
              <div class="flex items-center gap-2 px-2">
                <input type="date" [(ngModel)]="dateTo" (change)="loadReport()"
                       class="bg-transparent border-none outline-none text-sm font-medium" style="color: #f3f4f6; color-scheme: dark;">
              </div>
            </div>
          }
        </div>
      </div>

      @if (loading()) {
        <div class="flex flex-col items-center justify-center py-20 translate-y-4">
          <div class="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin" style="border-color: rgba(22,163,74,0.2); border-top-color: #16a34a;"></div>
          <p class="mt-4 text-sm font-medium" style="color: #9ca3af;">Analyzing financial data...</p>
        </div>
      } @else if (report()) {
        <!-- Summary Section -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <!-- Performance Summary (Large) -->
          <div class="lg:col-span-2 rounded-3xl p-7 border relative overflow-hidden"
               style="background: linear-gradient(135deg, rgba(74,222,128,0.05) 0%, rgba(10,21,10,0.98) 100%); border-color: rgba(74,222,128,0.15);">
            <div class="flex flex-col sm:flex-row justify-between gap-8 relative z-10">
              <div class="space-y-6">
                <div class="flex items-center gap-2">
                  <span class="p-2 rounded-lg bg-green-500/10 text-green-400">📊</span>
                  <h3 class="font-bold text-gray-200">Period Performance Summary</h3>
                </div>
                <div class="grid grid-cols-2 gap-x-12 gap-y-6">
                  <div>
                    <p class="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">Gross Revenue</p>
                    <div class="flex flex-col">
                      <span class="text-2xl font-black text-white">GH₵{{ formatCurrency(totalRevenue) }}</span>
                      <span class="text-[10px] text-gray-400 mt-1">Retail + Wholesale</span>
                    </div>
                  </div>
                  <div>
                    <p class="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">Gross Profit</p>
                    <div class="flex flex-col">
                      <span class="text-2xl font-black text-emerald-400">GH₵{{ formatCurrency(totalProfit) }}</span>
                      <span class="text-[10px] text-gray-400 mt-1">Before operational costs</span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="flex flex-col justify-between items-end text-right min-w-[200px]">
                <div class="space-y-1">
                  <p class="text-[10px] font-bold uppercase tracking-widest text-orange-400">Operational Expenses</p>
                  <div class="text-2xl font-black text-orange-500">- GH₵{{ formatCurrency(report()?.expenses?.total) }}</div>
                </div>
                <div class="pt-6 border-t border-white/5 w-full">
                  <p class="text-[10px] font-bold uppercase tracking-widest text-green-400">Net Period Balance</p>
                  <div class="text-4xl font-black text-white">
                    GH₵{{ formatCurrency(netRevenue) }}
                  </div>
                  <p class="text-[10px] text-gray-500 mt-2">Final cash position for period</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Net Profit Spotlight (Small) -->
          <div class="rounded-3xl p-7 border flex flex-col justify-center items-center text-center relative overflow-hidden"
               style="background: rgba(255,255,255,0.02); border-color: rgba(255,255,255,0.06);">
            <div class="absolute -right-10 -top-10 w-40 h-40 bg-emerald-500/5 rounded-full blur-3xl"></div>
            <div class="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">Actual Net Profit</div>
            <div class="text-5xl font-black text-white mb-2" [class.text-red-400]="netProfit < 0">
              GH₵{{ formatCurrency(netProfit) }}
            </div>
            <div class="text-xs text-gray-400 italic">Result after all costs</div>
            <div class="mt-6 px-4 py-1.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest border"
                 [style.color]="netProfit > 0 ? '#4ade80' : '#f87171'"
                 [style.borderColor]="netProfit > 0 ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'"
                 style="background: rgba(255,255,255,0.03);">
              {{ netProfit > 0 ? 'Period Profitable' : 'Period Loss' }}
            </div>
          </div>
        </div>

        <!-- Grouped Detailed Metrics -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          
          <!-- Revenue Streams Section -->
          <div class="space-y-6">
            <div class="flex items-center gap-3 px-2">
              <span class="w-1.5 h-6 bg-emerald-500 rounded-full"></span>
              <h3 class="text-sm font-bold uppercase tracking-widest text-gray-400">Core Revenue Streams</h3>
            </div>
            
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <!-- Retail Affairs -->
              <div class="rounded-3xl p-6 border transition-all hover:shadow-2xl hover:scale-[1.01] overflow-hidden relative group h-full"
                   style="background: linear-gradient(145deg, rgba(16,185,129,0.05) 0%, rgba(10,21,10,0.95) 100%); border-color: rgba(16,185,129,0.15);">
                <div class="absolute -right-6 -top-6 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-all"></div>
                
                <div class="flex items-center gap-3 mb-6 relative z-10">
                  <div class="p-3 rounded-xl" style="background: rgba(16,185,129,0.1); color: #34d399;">
                    <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                  </div>
                  <h2 class="text-lg font-bold text-gray-100">Retail Affairs</h2>
                </div>
                
                <div class="grid grid-cols-2 gap-4 relative z-10">
                  <div class="col-span-2">
                    <p class="text-[10px] font-bold uppercase tracking-wider mb-1" style="color: #9ca3af;">Revenue</p>
                    <div class="text-2xl font-extrabold" style="color: #f3f4f6;">GH₵{{ formatCurrency(report()?.retail?.revenue) }}</div>
                  </div>
                  @if (isAdmin) {
                    <div>
                      <p class="text-[10px] font-bold uppercase tracking-wider mb-1" style="color: #9ca3af;">Net Profit</p>
                      <div class="text-xl font-bold text-emerald-400">GH₵{{ formatCurrency(report()?.retail?.profit) }}</div>
                    </div>
                  }
                  <div>
                    <p class="text-[10px] font-bold uppercase tracking-wider mb-1" style="color: #9ca3af;">Sales</p>
                    <div class="text-xl font-medium" style="color: #d1d5db;">{{ report()?.retail?.count || 0 }}</div>
                  </div>
                </div>
              </div>

              <!-- Wholesale Affairs -->
              <div class="rounded-3xl p-6 border transition-all hover:shadow-2xl hover:scale-[1.01] overflow-hidden relative group h-full"
                   style="background: linear-gradient(145deg, rgba(59,130,246,0.05) 0%, rgba(10,21,10,0.95) 100%); border-color: rgba(59,130,246,0.15);">
                <div class="absolute -right-6 -top-6 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-all"></div>
                
                <div class="flex items-center gap-3 mb-6 relative z-10">
                  <div class="p-3 rounded-xl" style="background: rgba(59,130,246,0.1); color: #60a5fa;">
                    <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <h2 class="text-lg font-bold text-gray-100">Wholesale Affairs</h2>
                </div>
                
                <div class="grid grid-cols-2 gap-4 relative z-10">
                  <div class="col-span-2">
                    <p class="text-[10px] font-bold uppercase tracking-wider mb-1" style="color: #9ca3af;">Revenue</p>
                    <div class="text-2xl font-extrabold" style="color: #f3f4f6;">GH₵{{ formatCurrency(report()?.wholesale?.revenue) }}</div>
                  </div>
                  @if (isAdmin) {
                    <div>
                      <p class="text-[10px] font-bold uppercase tracking-wider mb-1" style="color: #9ca3af;">Net Profit</p>
                      <div class="text-xl font-bold text-blue-400">GH₵{{ formatCurrency(report()?.wholesale?.profit) }}</div>
                    </div>
                  }
                  <div>
                    <p class="text-[10px] font-bold uppercase tracking-wider mb-1" style="color: #9ca3af;">Sales</p>
                    <div class="text-xl font-medium" style="color: #d1d5db;">{{ report()?.wholesale?.count || 0 }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Outflows & Impacts Section -->
          <div class="space-y-6">
            <div class="flex items-center gap-3 px-2">
              <span class="w-1.5 h-6 bg-orange-500 rounded-full"></span>
              <h3 class="text-sm font-bold uppercase tracking-widest text-gray-400">Financial Impacts & Costs</h3>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <!-- Operational Expenses -->
              <div class="rounded-3xl p-6 border transition-all hover:shadow-2xl hover:scale-[1.01] overflow-hidden relative group h-full"
                   style="background: linear-gradient(145deg, rgba(251,146,60,0.05) 0%, rgba(10,21,10,0.95) 100%); border-color: rgba(251,146,60,0.15);">
                <div class="absolute -right-6 -top-6 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl group-hover:bg-orange-500/20 transition-all"></div>
                
                <div class="flex items-center gap-3 mb-6 relative z-10">
                  <div class="p-3 rounded-xl" style="background: rgba(251,146,60,0.1); color: #fb923c;">
                    <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <h2 class="text-lg font-bold text-gray-100">Operational Costs</h2>
                </div>
                
                <div class="space-y-4 relative z-10">
                  <div class="grid grid-cols-2 gap-4">
                    <div class="col-span-2">
                      <p class="text-[10px] font-bold uppercase tracking-wider mb-1" style="color: #9ca3af;">Total Outflow</p>
                      <div class="text-2xl font-extrabold text-orange-100">GH₵{{ formatCurrency(report()?.expenses?.total) }}</div>
                    </div>
                  </div>

                  @if (report()?.expenses?.by_category?.length) {
                    <div class="pt-2 border-t border-white/5 space-y-1.5">
                      @for (cat of report()?.expenses?.by_category?.slice(0, 3); track cat.category) {
                        <div class="flex items-center justify-between group/cat">
                          <span class="text-[11px] capitalize text-gray-400">{{ cat.category }}</span>
                          <span class="text-[11px] font-mono text-gray-300">GH₵{{ formatCurrency(cat.total) }}</span>
                        </div>
                      }
                    </div>
                  }
                </div>
              </div>

              <!-- Reversals -->
              <div class="rounded-3xl p-6 border transition-all hover:shadow-2xl hover:scale-[1.01] overflow-hidden relative group h-full"
                   style="background: linear-gradient(145deg, rgba(239,68,68,0.05) 0%, rgba(10,21,10,0.95) 100%); border-color: rgba(239,68,68,0.15);">
                <div class="absolute -right-6 -top-6 w-32 h-32 bg-red-500/10 rounded-full blur-3xl group-hover:bg-red-500/20 transition-all"></div>
                
                <div class="flex items-center gap-3 mb-6 relative z-10">
                  <div class="p-3 rounded-xl" style="background: rgba(239,68,68,0.1); color: #f87171;">
                    <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 15l-3-3m0 0l3-3m-3 3h8M3 12a9 9 0 1118 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h2 class="text-lg font-bold text-gray-100">Reversals</h2>
                </div>
                
                <div class="grid grid-cols-2 gap-4 relative z-10">
                  <div class="col-span-2">
                    <p class="text-[10px] font-bold uppercase tracking-wider mb-1" style="color: #9ca3af;">Amount</p>
                    <div class="text-2xl font-extrabold text-red-100">GH₵{{ formatCurrency(report()?.reversals?.amount) }}</div>
                  </div>
                  <div>
                    <p class="text-[10px] font-bold uppercase tracking-wider mb-1" style="color: #9ca3af;">Count</p>
                    <div class="text-xl font-medium" style="color: #d1d5db;">{{ report()?.reversals?.count || 0 }}</div>
                  </div>
                  <div>
                    <p class="text-[10px] font-bold uppercase tracking-wider mb-1" style="color: #9ca3af;">Impact</p>
                    <div class="text-[10px] font-bold text-red-400/80 uppercase">Profit Loss</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Secondary Metrics & Health -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Total Outstanding Debt -->
          @if (isAdmin) {
            <div class="lg:col-span-3 rounded-3xl p-6 border relative overflow-hidden"
                 style="background: linear-gradient(90deg, rgba(245,158,11,0.05) 0%, rgba(10,21,10,0.95) 100%); border-color: rgba(245,158,11,0.15);">
               <div class="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                  <div>
                    <div class="flex items-center gap-3 mb-2">
                      <div class="w-10 h-10 flex items-center justify-center rounded-xl" style="background: rgba(245,158,11,0.1); color: #fbbf24;">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <h3 class="text-xl font-bold" style="color: #f0fdf4;">Platform Outstanding Debt</h3>
                    </div>
                    <p class="text-sm ml-14 max-w-sm" style="color: #9ca3af;">
                      Total active debt across all registered wholesale clients.
                    </p>
                  </div>
                  <div class="text-right">
                    <div class="text-5xl font-extrabold tracking-tight" style="color: #fbbf24; text-shadow: 0 4px 20px rgba(245,158,11,0.2);">
                      GH₵{{ formatCurrency(report()?.total_outstanding_debt) }}
                    </div>
                  </div>
               </div>
            </div>
          }

          <!-- Replenishment Required -->
          <div class="lg:col-span-3 rounded-3xl p-6 border" style="background: rgba(10,21,10,0.95); border-color: rgba(255,255,255,0.08);">
            <div class="flex items-center gap-3 mb-6">
              <div class="p-2 rounded-xl" style="background: rgba(239,68,68,0.1); color: #f87171;">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 class="text-lg font-bold" style="color: #f0fdf4;">Inventory Replenishment Required</h2>
              <span class="ml-2 px-2.5 py-0.5 rounded-full text-xs font-bold" style="background: rgba(239,68,68,0.1); color: #f87171;">
                {{ report()?.low_stock_products?.length || 0 }} Items
              </span>
            </div>

            @if (report()?.low_stock_products?.length) {
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                @for (prod of report()?.low_stock_products; track prod.id) {
                  <div class="p-4 rounded-xl border flex flex-col justify-between transition-all hover:bg-white/[0.02]" 
                       style="background: rgba(0,0,0,0.2); border-color: rgba(255,255,255,0.05);">
                    <div class="font-semibold text-gray-200 mb-2 truncate">{{ prod.name }}</div>
                    <div class="flex items-end justify-between">
                      <div>
                        <div class="text-[10px] uppercase font-bold text-gray-500 mb-0.5">Current Stock</div>
                        <div class="font-bold text-red-400 flex items-baseline gap-1">
                          <span class="text-xl">{{ prod.quantity }}</span>
                          <span class="text-xs">{{ prod.base_unit }}</span>
                        </div>
                      </div>
                      <div class="text-right">
                        <div class="text-[10px] uppercase font-bold text-gray-500 mb-0.5">Alert Limit</div>
                        <div class="font-medium text-gray-400">{{ prod.low_stock_alert }}</div>
                      </div>
                    </div>
                  </div>
                }
              </div>
            } @else {
              <div class="py-12 text-center flex flex-col items-center justify-center">
                <div class="w-16 h-16 rounded-full mb-4 flex items-center justify-center" style="background: rgba(22,163,74,0.1); color: #4ade80;">
                  <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div class="text-gray-300 font-medium">Inventory Health Optimal</div>
                <div class="text-gray-500 text-sm mt-1">No products require restocking at this time.</div>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `
})
export class ReportsView implements OnInit {
  reportService = inject(ReportService);
  toast = inject(ToastService);
  private authService = inject(AuthService);

  loading = signal(true);
  report = signal<FinancialReportData | null>(null);

  get isAdmin(): boolean {
    return this.authService.currentUser()?.role === 'Admin';
  }

  get totalRevenue(): number {
    const r = this.report();
    return Number(r?.retail?.revenue ?? 0) + Number(r?.wholesale?.revenue ?? 0);
  }

  get totalProfit(): number {
    const r = this.report();
    return Number(r?.retail?.profit ?? 0) + Number(r?.wholesale?.profit ?? 0);
  }

  get netRevenue(): number {
    return this.totalRevenue - Number(this.report()?.expenses?.total ?? 0);
  }

  get netProfit(): number {
    return this.totalProfit - Number(this.report()?.expenses?.total ?? 0);
  }

  selectedPreset = 'today';
  dateFrom = '';
  dateTo = '';

  ngOnInit() {
    this.applyPreset();
  }

  applyPreset() {
    const today = new Date();
    
    if (this.selectedPreset === 'today') {
      this.dateFrom = this.formatDate(today);
      this.dateTo = this.formatDate(today);
    } else if (this.selectedPreset === 'yesterday') {
      const y = new Date(today);
      y.setDate(today.getDate() - 1);
      this.dateFrom = this.formatDate(y);
      this.dateTo = this.formatDate(y);
    } else if (this.selectedPreset === 'this_week') {
      const startOfWeek = new Date(today);
      const day = startOfWeek.getDay() || 7; 
      if(day !== 1) startOfWeek.setHours(-24 * (day - 1));
      this.dateFrom = this.formatDate(startOfWeek);
      this.dateTo = this.formatDate(today);
    } else if (this.selectedPreset === 'this_month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      this.dateFrom = this.formatDate(start);
      this.dateTo = this.formatDate(today);
    } else if (this.selectedPreset === 'last_month') {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      this.dateFrom = this.formatDate(start);
      this.dateTo = this.formatDate(end);
    } else if (this.selectedPreset === 'this_year') {
      const start = new Date(today.getFullYear(), 0, 1);
      this.dateFrom = this.formatDate(start);
      this.dateTo = this.formatDate(today);
    }

    if (this.selectedPreset !== 'custom') {
      this.loadReport();
    }
  }

  formatDate(d: Date): string {
    return d.toISOString().split('T')[0];
  }

  loadReport() {
    this.loading.set(true);
    this.reportService.getFinancialReport(this.dateFrom, this.dateTo).subscribe({
      next: (data) => {
        this.report.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.toast.error('Failed to load financial report');
        this.loading.set(false);
      }
    });
  }

  formatCurrency(value?: number | string | null): string {
    if (!value) return '0.00';
    return Number(value).toFixed(2);
  }
}
