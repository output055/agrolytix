import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuditLogService } from '../../../core/services/audit-log.service';
import { AuditLog, AuditLogResponse } from '../../../core/models/audit-log.model';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-audit-logs-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="p-6 min-h-screen" style="background: #050a05;">
      <!-- Header Area -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 class="text-2xl font-bold text-white tracking-tight">User Logs</h1>
          <p class="text-sm text-gray-400 mt-1">Audit trail and system activity monitoring</p>
        </div>
        <div class="flex items-center gap-3">
          <button (click)="exportLogs('csv')"
                  class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
                  style="background: rgba(255,255,255,0.05); color: #e5e7eb; border: 1px solid rgba(255,255,255,0.1);">
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            Export CSV
          </button>
          <button (click)="loadLogs()"
                  class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
                  style="background: linear-gradient(135deg, #16a34a, #4ade80); color: #050a05;">
            <svg class="h-4 w-4" [class.animate-spin]="loading()" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            Refresh
          </button>
        </div>
      </div>

      <!-- Filters Block -->
      <div class="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6 p-5 rounded-2xl border"
           style="background: rgba(255,255,255,0.02); border-color: rgba(255,255,255,0.05);">
        
        <div class="space-y-1.5 md:col-span-2">
          <label class="text-[11px] font-bold uppercase tracking-widest text-gray-500">Action Search</label>
          <input type="text" [(ngModel)]="filters.action_type" (keyup.enter)="loadLogs()"
                 placeholder="Search action keyword..."
                 class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-green-500 outline-none transition-all">
        </div>

        <div class="space-y-1.5">
          <label class="text-[11px] font-bold uppercase tracking-widest text-gray-500">Severity</label>
          <select [(ngModel)]="filters.severity" (change)="loadLogs()"
                  class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-green-500 outline-none transition-all cursor-pointer">
            <option value="">All Severities</option>
            <option value="INFO">Info</option>
            <option value="WARNING">Warning</option>
            <option value="CRITICAL">Critical</option>
          </select>
        </div>

        <div class="space-y-1.5">
          <label class="text-[11px] font-bold uppercase tracking-widest text-gray-500">Date Range</label>
          <select [(ngModel)]="selectedPreset" (change)="applyPreset()"
                  class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-green-500 outline-none transition-all cursor-pointer">
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="this_week">This Week</option>
            <option value="last_week">Last Week</option>
            <option value="this_month">This Month</option>
            <option value="last_month">Last Month</option>
            <option value="this_year">This Year</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>

        @if (selectedPreset === 'custom') {
          <div class="space-y-1.5">
            <label class="text-[11px] font-bold uppercase tracking-widest text-gray-500">Start Date</label>
            <input type="date" [(ngModel)]="filters.start_date" (change)="loadLogs()"
                   class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-green-500 outline-none transition-all">
          </div>
          <div class="space-y-1.5">
            <label class="text-[11px] font-bold uppercase tracking-widest text-gray-500">End Date</label>
            <input type="date" [(ngModel)]="filters.end_date" (change)="loadLogs()"
                   class="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-green-500 outline-none transition-all">
          </div>
        }
      </div>

      <!-- Logs Table -->
      <div class="rounded-2xl border overflow-hidden relative"
           style="background: rgba(255,255,255,0.02); border-color: rgba(255,255,255,0.05); backdrop-filter: blur(10px);">
        
        <!-- Loading Overlay -->
        @if (loading()) {
          <div class="absolute inset-0 z-10 flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
            <div class="flex flex-col items-center">
              <div class="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin" 
                   style="border-color: rgba(22,163,74,0.2); border-top-color: #16a34a;"></div>
              <p class="mt-4 text-xs font-medium text-gray-400 uppercase tracking-widest">Loading Logs...</p>
            </div>
          </div>
        }

        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr style="background: rgba(255,255,255,0.03);">
                <th class="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-gray-400 border-b border-white/5">Timestamp</th>
                <th class="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-gray-400 border-b border-white/5">User</th>
                <th class="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-gray-400 border-b border-white/5">Action</th>
                <th class="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-gray-400 border-b border-white/5">Severity</th>
                <th class="px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-gray-400 border-b border-white/5">Details</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-white/5">
              @for (log of response()?.data; track log.id) {
                <tr class="hover:bg-white/5 transition-colors group">
                  <td class="px-6 py-4">
                    <div class="text-sm text-white font-medium">{{ log.created_at | date:'MMM d, HH:mm:ss' }}</div>
                    <div class="text-[10px] text-gray-500 uppercase tracking-tighter">{{ log.created_at | date:'yyyy' }}</div>
                  </td>
                  <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                      <div class="h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold"
                           [style.background]="getUserColor(log.user?.name || 'System')"
                           [style.color]="'#050a05'">
                        {{ (log.user?.name || 'S')[0] }}
                      </div>
                      <div>
                        <div class="text-sm text-white font-medium">{{ log.user?.name || 'System' }}</div>
                        <div class="text-[11px] text-gray-500">{{ log.ip_address }}</div>
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4">
                    <span class="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider"
                          [style.background]="getActionColor(log.action_type)"
                          [style.color]="'#fff'">
                      {{ log.action_type.split('_').join(' ') }}
                    </span>
                    <div class="mt-1 text-[11px] text-gray-400">
                      {{ log.entity_type }} {{ log.entity_id ? '#' + log.entity_id : '' }}
                    </div>
                  </td>
                  <td class="px-6 py-4">
                    <div class="flex items-center gap-2">
                       <span class="h-2 w-2 rounded-full" [class.bg-green-500]="log.severity === 'INFO'"
                             [class.bg-amber-500]="log.severity === 'WARNING'"
                             [class.bg-red-500]="log.severity === 'CRITICAL'"></span>
                       <span class="text-xs font-medium"
                             [class.text-green-500]="log.severity === 'INFO'"
                             [class.text-amber-500]="log.severity === 'WARNING'"
                             [class.text-red-500]="log.severity === 'CRITICAL'">
                        {{ log.severity }}
                      </span>
                    </div>
                  </td>
                  <td class="px-6 py-4">
                    <button (click)="viewDetails(log)"
                            class="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all">
                      <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                      </svg>
                    </button>
                  </td>
                </tr>
              } @empty {
                @if (!loading()) {
                  <tr>
                    <td colspan="5" class="px-6 py-12 text-center">
                      <div class="text-gray-500 text-sm">No activity logs found for the selected criteria.</div>
                    </td>
                  </tr>
                } @else {
                  <tr>
                     <td colspan="5" class="px-6 py-24"></td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        @if (response() && response()!.last_page > 1) {
          <div class="px-6 py-4 border-t border-white/5 flex items-center justify-between"
               style="background: rgba(255,255,255,0.01);">
            <div class="text-xs text-gray-500">
              Showing {{ (response()!.current_page - 1) * response()!.per_page + 1 }} to
              {{ response()!.current_page * response()!.per_page > response()!.total ? response()!.total : response()!.current_page * response()!.per_page }}
              of {{ response()!.total }} logs
            </div>
            <div class="flex gap-2">
              <button (click)="changePage(response()!.current_page - 1)"
                      [disabled]="response()!.current_page === 1"
                      class="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-30 border border-white/10 text-white">
                Previous
              </button>
              <button (click)="changePage(response()!.current_page + 1)"
                      [disabled]="response()!.current_page === response()!.last_page"
                      class="px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-30 border border-white/10 text-white">
                Next
              </button>
            </div>
          </div>
        }
      </div>
    </div>

    <!-- Details Modal -->
    @if (selectedLog()) {
      @let log = selectedLog()!;
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" (click)="selectedLog.set(null)"></div>
        <div class="relative w-full max-w-2xl bg-[#0a150a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
          <div class="p-6 border-b border-white/10 flex items-center justify-between bg-black/20">
            <div>
              <h2 class="text-lg font-bold text-white tracking-tight">Log Entry Details</h2>
              <p class="text-[10px] uppercase tracking-widest text-green-500 mt-1">Ref: #{{ log.id }}</p>
            </div>
            <button (click)="selectedLog.set(null)" class="p-2 rounded-lg hover:bg-white/5 text-gray-500 hover:text-white transition-all">
               <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
          <div class="p-6 overflow-y-auto space-y-6">
            <div class="grid grid-cols-2 gap-4">
              <div class="p-4 rounded-xl bg-white/5 border border-white/5">
                <div class="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">User Agent</div>
                <div class="text-sm text-gray-300 break-words leading-relaxed">{{ log.user_agent }}</div>
              </div>
              <div class="p-4 rounded-xl bg-white/5 border border-white/5">
                <div class="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">IP Address</div>
                <div class="text-sm text-gray-300">{{ log.ip_address }}</div>
              </div>
            </div>

            @if (log.metadata) {
              <div class="space-y-4">
                <div class="text-[10px] font-bold uppercase tracking-widest text-green-500">Payload Metadata</div>

                @if (log.metadata.old && Object.keys(log.metadata.old).length > 0) {
                  <div class="space-y-2">
                    <div class="text-xs font-medium text-gray-400">Previous Values</div>
                    <pre class="p-4 rounded-xl bg-red-900/10 border border-red-900/20 text-red-200/80 text-[11px] overflow-x-auto">{{ formatJson(log.metadata.old) }}</pre>
                  </div>
                }

                @if (log.metadata.new && Object.keys(log.metadata.new).length > 0) {
                  <div class="space-y-2">
                    <div class="text-xs font-medium text-gray-400">Updated Values</div>
                    <pre class="p-4 rounded-xl bg-green-900/10 border border-green-900/20 text-green-200/80 text-[11px] overflow-x-auto">{{ formatJson(log.metadata.new) }}</pre>
                  </div>
                }

                @if (!log.metadata.old && !log.metadata.new) {
                   <pre class="p-4 rounded-xl bg-white/5 border border-white/5 text-gray-300 text-[11px] overflow-x-auto">{{ formatJson(log.metadata) }}</pre>
                }
              </div>
            }
          </div>
        </div>
      </div>
    }
  `
})
export class AuditLogsView implements OnInit {
  private auditLogService = inject(AuditLogService);

  response = signal<AuditLogResponse | null>(null);
  loading = signal(false);
  selectedLog = signal<AuditLog | null>(null);
  Object = Object;

  selectedPreset = 'today';
  filters = {
    action_type: '',
    severity: '',
    start_date: '',
    end_date: ''
  };

  ngOnInit(): void {
    this.applyPreset();
  }

  applyPreset() {
    const today = new Date();
    
    if (this.selectedPreset === 'all') {
      this.filters.start_date = '';
      this.filters.end_date = '';
    } else if (this.selectedPreset === 'today') {
      this.filters.start_date = this.formatDate(today);
      this.filters.end_date = this.formatDate(today);
    } else if (this.selectedPreset === 'yesterday') {
      const y = new Date(today);
      y.setDate(today.getDate() - 1);
      this.filters.start_date = this.formatDate(y);
      this.filters.end_date = this.formatDate(y);
    } else if (this.selectedPreset === 'this_week') {
      const startOfWeek = new Date(today);
      const day = startOfWeek.getDay() || 7; 
      if(day !== 1) startOfWeek.setHours(-24 * (day - 1));
      this.filters.start_date = this.formatDate(startOfWeek);
      this.filters.end_date = this.formatDate(today);
    } else if (this.selectedPreset === 'last_week') {
      const todayVal = new Date();
      const lastWeekEnd = new Date(todayVal);
      const day = lastWeekEnd.getDay() || 7;
      lastWeekEnd.setHours(-24 * day); // Last Sunday
      
      const lastWeekStart = new Date(lastWeekEnd);
      lastWeekStart.setHours(-24 * 6); // Last Monday
      
      this.filters.start_date = this.formatDate(lastWeekStart);
      this.filters.end_date = this.formatDate(lastWeekEnd);
    } else if (this.selectedPreset === 'this_month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      this.filters.start_date = this.formatDate(start);
      this.filters.end_date = this.formatDate(today);
    } else if (this.selectedPreset === 'last_month') {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      this.filters.start_date = this.formatDate(start);
      this.filters.end_date = this.formatDate(end);
    } else if (this.selectedPreset === 'this_year') {
      const start = new Date(today.getFullYear(), 0, 1);
      this.filters.start_date = this.formatDate(start);
      this.filters.end_date = this.formatDate(today);
    }

    if (this.selectedPreset !== 'custom') {
      this.loadLogs();
    }
  }

  formatDate(d: Date): string {
    return d.toISOString().split('T')[0];
  }

  loadLogs(page: number = 1): void {
    this.loading.set(true);
    this.auditLogService.getLogs(page, this.filters)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => this.response.set(res),
        error: (err) => console.error('Failed to load logs', err)
      });
  }

  changePage(page: number): void {
    this.loadLogs(page);
  }

  viewDetails(log: AuditLog): void {
    this.selectedLog.set(log);
  }

  formatJson(data: any): string {
    return JSON.stringify(data, null, 2);
  }

  exportLogs(format: 'csv' | 'json'): void {
    this.auditLogService.exportLogs(format, this.filters);
  }

  getUserColor(name: string): string {
    if (name === 'System') return '#3b82f6';
    const hash = name.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
    return `hsl(${hash % 360}, 60%, 70%)`;
  }

  getActionColor(action: string): string {
    if (action.includes('CREATED')) return 'rgba(16, 185, 129, 0.2)';
    if (action.includes('UPDATED')) return 'rgba(59, 130, 246, 0.2)';
    if (action.includes('DELETED')) return 'rgba(239, 68, 68, 0.2)';
    if (action.includes('LOGIN')) return 'rgba(139, 92, 246, 0.2)';
    return 'rgba(107, 114, 128, 0.2)';
  }
}
