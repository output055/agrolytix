import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExpenseService } from '../../../core/services/expense.service';
import { ToastService } from '../../../core/services/toast.service';
import { AuthService } from '../../../core/services/auth.service';
import { Expense, EXPENSE_CATEGORIES, ExpenseCategory } from '../../../core/models/expense.model';

@Component({
  selector: 'app-expenses-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-6 max-w-7xl mx-auto pb-10">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 class="text-3xl font-bold tracking-tight text-white">Expenses</h1>
          <p class="text-sm mt-1" style="color: #9ca3af;">
            Log and manage operational costs
          </p>
        </div>
        <div class="flex flex-col items-end">
          <div class="text-[10px] font-bold uppercase tracking-widest text-gray-500">Remaining Today</div>
          <div class="text-xl font-black text-white" [class.text-red-400]="(todayStats()?.net_revenue < 0)">
            GH₵{{ fmt(todayStats()?.net_revenue) }}
          </div>
        </div>
      </div>

      <!-- Filters & Add -->
      <div class="flex flex-col sm:flex-row gap-4 items-end sm:items-center">
        <div class="flex-1 flex flex-wrap gap-3 items-center p-4 rounded-2xl border" style="background: rgba(255,255,255,0.02); border-color: rgba(255,255,255,0.06);">
          <!-- Filters Group -->
          <div class="flex flex-wrap gap-3 items-center">
            <div class="flex flex-col gap-1">
              <label class="text-[10px] font-bold uppercase tracking-wider" style="color: #6b7280;">From</label>
              <input type="date" [(ngModel)]="filter.date_from" (change)="loadExpenses()"
                    class="px-3 py-2 rounded-xl text-sm border outline-none"
                    style="background: rgba(0,0,0,0.3); border-color: rgba(255,255,255,0.08); color: #f3f4f6; color-scheme: dark;">
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-[10px] font-bold uppercase tracking-wider" style="color: #6b7280;">To</label>
              <input type="date" [(ngModel)]="filter.date_to" (change)="loadExpenses()"
                    class="px-3 py-2 rounded-xl text-sm border outline-none"
                    style="background: rgba(0,0,0,0.3); border-color: rgba(255,255,255,0.08); color: #f3f4f6; color-scheme: dark;">
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-[10px] font-bold uppercase tracking-wider" style="color: #6b7280;">Category</label>
              <select [(ngModel)]="filter.category" (change)="loadExpenses()"
                      class="px-3 py-2 rounded-xl text-sm border outline-none cursor-pointer"
                      style="background: #0a150a; border-color: rgba(255,255,255,0.08); color: #f3f4f6;">
                <option value="">All Categories</option>
                @for (cat of categories; track cat.value) {
                  <option [value]="cat.value">{{ cat.emoji }} {{ cat.label }}</option>
                }
              </select>
            </div>
            <div class="flex flex-col gap-1 flex-1 min-w-[180px]">
              <label class="text-[10px] font-bold uppercase tracking-wider" style="color: #6b7280;">Search</label>
              <input type="text" [(ngModel)]="filter.search" (input)="onSearchChange()"
                    placeholder="Search title or note..."
                    class="px-3 py-2 rounded-xl text-sm border outline-none"
                    style="background: rgba(0,0,0,0.3); border-color: rgba(255,255,255,0.08); color: #f3f4f6;">
            </div>
          </div>
        </div>
        
        <button (click)="openAddForm()"
                class="flex items-center gap-2 px-6 py-4 rounded-2xl font-bold text-sm transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-green-500/10"
                style="background: linear-gradient(135deg, #16a34a, #4ade80); color: #0a150a;">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/>
          </svg>
          Record Today's Expense
        </button>
      </div>

      <!-- Add Expense Form (inline) -->
      @if (showForm()) {
        <div class="rounded-2xl border p-6 relative overflow-hidden"
             style="background: linear-gradient(145deg, rgba(74,222,128,0.04) 0%, rgba(10,21,10,0.98) 100%); border-color: rgba(74,222,128,0.15);">
          <div class="absolute -right-10 -top-10 w-40 h-40 bg-green-500/5 rounded-full blur-3xl pointer-events-none"></div>
          <div class="flex items-center justify-between mb-5">
            <h2 class="text-lg font-bold" style="color: #f0fdf4;">Record New Expense ({{ todayStr() }})</h2>
            <div class="px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest"
                 style="background: rgba(255,255,255,0.03); color: #9ca3af;">
              Available Cash: GH₵{{ fmt(todayStats()?.net_revenue) }}
            </div>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <!-- Title -->
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-semibold" style="color: #9ca3af;">Expense Title*</label>
              <input type="text" [(ngModel)]="form.title" placeholder="e.g. Cleaning materials"
                     class="px-3 py-2.5 rounded-xl text-sm border outline-none focus:ring-1 focus:ring-green-500/50"
                     style="background: rgba(0,0,0,0.4); border-color: rgba(255,255,255,0.08); color: #f3f4f6;">
            </div>
            <!-- Amount -->
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-semibold" style="color: #9ca3af;">Amount (GH₵)*</label>
              <input type="number" [(ngModel)]="form.amount" min="0.01" step="0.01" placeholder="0.00"
                     class="px-3 py-2.5 rounded-xl text-sm border outline-none"
                     [style.border-color]="(form.amount && form.amount > todayStats()?.net_revenue ? '#f87171' : 'rgba(255,255,255,0.08)')"
                     style="background: rgba(0,0,0,0.4); color: #f3f4f6;">
              @if (form.amount && form.amount > todayStats()?.net_revenue) {
                <p class="text-[10px] text-red-400 font-medium">Warning: Amount exceeds today's available revenue</p>
              }
            </div>
            <!-- Category -->
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-semibold" style="color: #9ca3af;">Category*</label>
              <select [(ngModel)]="form.category"
                      class="px-3 py-2.5 rounded-xl text-sm border outline-none cursor-pointer"
                      style="background: #0a150a; border-color: rgba(255,255,255,0.08); color: #f3f4f6;">
                @for (cat of categories; track cat.value) {
                  <option [value]="cat.value">{{ cat.emoji }} {{ cat.label }}</option>
                }
              </select>
            </div>
            <!-- Note -->
            <div class="flex flex-col gap-1.5 lg:col-span-3">
              <label class="text-xs font-semibold" style="color: #9ca3af;">Brief Note (optional)</label>
              <textarea [(ngModel)]="form.note" placeholder="Any additional details..." rows="2"
                     class="px-3 py-2.5 rounded-xl text-sm border outline-none resize-none"
                     style="background: rgba(0,0,0,0.4); border-color: rgba(255,255,255,0.08); color: #f3f4f6;"></textarea>
            </div>
          </div>
          <div class="flex items-center gap-3 mt-5">
            <button (click)="submitExpense()" [disabled]="saving()"
                    class="px-5 py-2.5 rounded-xl font-semibold text-sm transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                    style="background: linear-gradient(135deg,#16a34a,#4ade80); color: #0a150a;">
              {{ saving() ? 'Saving...' : 'Save Expense' }}
            </button>
            <button (click)="closeForm()"
                    class="px-5 py-2.5 rounded-xl font-semibold text-sm border transition-colors hover:bg-white/5"
                    style="color: #9ca3af; border-color: rgba(255,255,255,0.08);">
              Cancel
            </button>
          </div>
        </div>
      }

      <!-- Expenses Table -->
      <div class="rounded-2xl border overflow-hidden"
           style="background: rgba(255,255,255,0.02); border-color: rgba(255,255,255,0.06);">

        @if (loading()) {
          <div class="flex items-center justify-center py-20">
            <div class="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin"
                 style="border-color: rgba(22,163,74,0.2); border-top-color: #16a34a;"></div>
          </div>
        } @else if (expenses().length === 0) {
          <div class="p-12 text-center flex flex-col items-center gap-3">
            <div class="w-14 h-14 rounded-full flex items-center justify-center"
                 style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);">
              <span class="text-2xl">🧾</span>
            </div>
            <p class="font-medium" style="color: #9ca3af;">No expenses found</p>
            <p class="text-sm" style="color: #6b7280;">Try adjusting filters or log a new expense.</p>
          </div>
        } @else {
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-sm">
              <thead>
                <tr style="background: rgba(255,255,255,0.03);">
                  <th class="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider" style="color: #6b7280;">Date</th>
                  <th class="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider" style="color: #6b7280;">Title</th>
                  <th class="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider" style="color: #6b7280;">Category</th>
                  @if (isAdmin) {
                    <th class="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider" style="color: #6b7280;">Logged By</th>
                  }
                  <th class="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-right" style="color: #6b7280;">Amount</th>
                  <th class="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider" style="color: #6b7280;">Note</th>
                  @if (isAdmin) {
                    <th class="px-5 py-3.5 text-[10px] font-bold uppercase tracking-wider text-center" style="color: #6b7280;">Action</th>
                  }
                </tr>
              </thead>
              <tbody class="divide-y divide-white/[0.04]">
                @for (exp of expenses(); track exp.id) {
                  <tr class="hover:bg-white/[0.02] transition-colors group">
                    <td class="px-5 py-3.5 font-mono text-xs" style="color: #9ca3af;">{{ exp.expense_date }}</td>
                    <td class="px-5 py-3.5 font-medium" style="color: #e5e7eb;">{{ exp.title }}</td>
                    <td class="px-5 py-3.5">
                      <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border"
                            [style.color]="getCategoryColor(exp.category)"
                            style="background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.06);">
                        {{ getCategoryEmoji(exp.category) }} {{ getCategoryLabel(exp.category) }}
                      </span>
                    </td>
                    @if (isAdmin) {
                      <td class="px-5 py-3.5 text-xs" style="color: #9ca3af;">{{ exp.recorder?.name ?? '—' }}</td>
                    }
                    <td class="px-5 py-3.5 text-right font-bold" style="color: #f59e0b;">GH₵{{ fmt(exp.amount) }}</td>
                    <td class="px-5 py-3.5 text-xs max-w-[200px] truncate" style="color: #6b7280;" [title]="exp.note || ''">
                      {{ exp.note || '—' }}
                    </td>
                    @if (isAdmin) {
                      <td class="px-5 py-3.5 text-center">
                        <button (click)="deleteExpense(exp)"
                                class="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all opacity-0 group-hover:opacity-100">
                          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                          </svg>
                        </button>
                      </td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          @if (totalPages() > 1) {
            <div class="flex items-center justify-between px-5 py-3 border-t" style="border-color: rgba(255,255,255,0.06);">
              <span class="text-xs" style="color: #6b7280;">
                Page {{ currentPage() }} of {{ totalPages() }} &bull; {{ totalCount() }} records
              </span>
              <div class="flex items-center gap-2">
                <button (click)="changePage(currentPage() - 1)" [disabled]="currentPage() === 1"
                        class="px-3 py-1.5 rounded-lg text-xs font-medium border disabled:opacity-40 transition-colors hover:bg-white/5"
                        style="border-color: rgba(255,255,255,0.08); color: #9ca3af;">← Prev</button>
                <button (click)="changePage(currentPage() + 1)" [disabled]="currentPage() === totalPages()"
                        class="px-3 py-1.5 rounded-lg text-xs font-medium border disabled:opacity-40 transition-colors hover:bg-white/5"
                        style="border-color: rgba(255,255,255,0.08); color: #9ca3af;">Next →</button>
              </div>
            </div>
          }
        }
      </div>
    </div>
  `
})
export class ExpensesView implements OnInit {
  private expenseService = inject(ExpenseService);
  private toast          = inject(ToastService);
  private auth           = inject(AuthService);

  expenses    = signal<Expense[]>([]);
  loading     = signal(true);
  saving      = signal(false);
  showForm    = signal(false);
  summary     = signal<{ category: string; total: number; count: number }[] | null>(null);
  todayStats  = signal<any>(null);

  currentPage = signal(1);
  totalPages  = signal(1);
  totalCount  = signal(0);

  readonly categories = EXPENSE_CATEGORIES;

  filter = {
    date_from: '',
    date_to:   '',
    category:  '',
    search:    '',
  };

  form = {
    title:        '',
    amount:       null as number | null,
    category:     'other' as ExpenseCategory,
    note:         '',
  };

  private searchTimer: any;

  get isAdmin(): boolean {
    return this.auth.currentUser()?.role === 'Admin';
  }

  ngOnInit() {
    // Default filter: this month
    const today = new Date();
    this.filter.date_from = new Date(today.getFullYear(), today.getMonth(), 1)
      .toISOString().split('T')[0];
    this.filter.date_to = today.toISOString().split('T')[0];
    
    this.loadExpenses();
    this.loadTodayStats();
  }

  loadTodayStats() {
    this.expenseService.getTodayStats().subscribe({
      next: stats => this.todayStats.set(stats),
      error: () => this.toast.error('Failed to load today\'s revenue stats')
    });
  }

  loadExpenses(page = 1) {
    this.loading.set(true);
    this.expenseService.getExpenses(this.filter, page).subscribe({
      next: (res) => {
        this.expenses.set(res.data);
        this.currentPage.set(res.current_page);
        this.totalPages.set(res.last_page);
        this.totalCount.set(res.total);

        // Build summary from response data (admin only)
        if (this.isAdmin) {
          const categoryMap: Record<string, { category: string; total: number; count: number }> = {};
          res.data.forEach(e => {
            if (!categoryMap[e.category]) categoryMap[e.category] = { category: e.category, total: 0, count: 0 };
            categoryMap[e.category].total += Number(e.amount);
            categoryMap[e.category].count++;
          });
          // Keep top 4
          const sorted = Object.values(categoryMap).sort((a, b) => b.total - a.total).slice(0, 4);
          this.summary.set(sorted.length ? sorted : null);
        }

        this.loading.set(false);
      },
      error: () => {
        this.toast.error('Failed to load expenses');
        this.loading.set(false);
      }
    });
  }

  topCategories() {
    return this.summary() ?? [];
  }

  changePage(page: number) {
    if (page < 1 || page > this.totalPages()) return;
    this.loadExpenses(page);
  }

  onSearchChange() {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.loadExpenses(), 400);
  }

  clearFilters() {
    this.filter = { date_from: '', date_to: '', category: '', search: '' };
    this.loadExpenses();
  }

  openAddForm() {
    this.form = {
      title:        '',
      amount:       null,
      category:     'other',
      note:         '',
    };
    this.showForm.set(true);
    // Refresh stats when opening form to ensure latest revenue balance
    this.loadTodayStats();
  }

  closeForm() {
    this.showForm.set(false);
  }

  submitExpense() {
    if (!this.form.title.trim()) { this.toast.error('Title is required'); return; }
    if (!this.form.amount || this.form.amount <= 0) { this.toast.error('Enter a valid amount'); return; }
    
    // Client-side validation: ensure amount doesn't exceed net revenue
    if (this.todayStats() && this.form.amount > this.todayStats().net_revenue) {
      this.toast.error('Insufficient funds: Expense exceeds remaining daily revenue.');
      return;
    }

    this.saving.set(true);
    this.expenseService.createExpense({
      title:        this.form.title.trim(),
      amount:       this.form.amount,
      category:     this.form.category,
      note:         this.form.note.trim() || undefined,
    }).subscribe({
      next: () => {
        this.toast.success('Expense recorded successfully');
        this.saving.set(false);
        this.closeForm();
        this.loadExpenses(this.currentPage());
        this.loadTodayStats(); // Refresh stats after new expense
      },
      error: (err) => {
        const msg = err.error?.message || 'Failed to record expense';
        this.toast.error(msg);
        this.saving.set(false);
      }
    });
  }

  deleteExpense(exp: Expense) {
    if (!confirm(`Delete "${exp.title}" (GH₵${this.fmt(exp.amount)})?`)) return;
    this.expenseService.deleteExpense(exp.id).subscribe({
      next: () => {
        this.toast.success('Expense deleted');
        this.loadExpenses(this.currentPage());
        this.loadTodayStats(); // Refresh stats after deletion
      },
      error: () => this.toast.error('Failed to delete expense')
    });
  }

  fmt(val?: number | string | null): string {
    return Number(val ?? 0).toLocaleString('en-GH', { minimumFractionDigits: 2 });
  }

  todayStr(): string {
    return new Date().toISOString().split('T')[0];
  }

  getCategoryLabel(cat: string): string {
    return EXPENSE_CATEGORIES.find(c => c.value === cat)?.label ?? cat;
  }

  getCategoryEmoji(cat: string): string {
    return EXPENSE_CATEGORIES.find(c => c.value === cat)?.emoji ?? '📌';
  }

  getCategoryColor(cat: string): string {
    const colors: Record<string, string> = {
      salary:      '#60a5fa',
      fuel:        '#f59e0b',
      rent:        '#a78bfa',
      utilities:   '#34d399',
      maintenance: '#fb923c',
      food:        '#4ade80',
      cleaning:    '#38bdf8',
      other:       '#9ca3af',
    };
    return colors[cat] ?? '#9ca3af';
  }
}
