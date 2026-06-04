import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InventoryService } from '../../../core/services/inventory.service';
import { ToastService } from '../../../core/services/toast.service';
import { StockTransfer, PaginatedResponse } from '../../../core/models/inventory.model';

@Component({
  selector: 'app-transfer-history',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="mb-6">
      <h1 class="text-2xl font-bold" style="color: #f0fdf4;">Stock Transfer History</h1>
      <p class="text-sm" style="color: #9ca3af;">All inventory transfers between retail and wholesale.</p>
    </div>

    <!-- Table -->
    <div class="rounded-2xl border overflow-hidden" style="background: rgba(255,255,255,0.02); border-color: rgba(255,255,255,0.05);">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-sm" style="color: #d1d5db;">
          <thead class="text-xs uppercase border-b" style="background: rgba(255,255,255,0.03); border-color: rgba(255,255,255,0.05); color: #9ca3af;">
            <tr>
              <th class="px-6 py-4 font-medium">Date</th>
              <th class="px-6 py-4 font-medium">From</th>
              <th class="px-6 py-4 font-medium">To</th>
              <th class="px-6 py-4 font-medium">Qty</th>
              <th class="px-6 py-4 font-medium">Note</th>
              <th class="px-6 py-4 font-medium">By</th>
            </tr>
          </thead>
          <tbody class="divide-y" style="border-color: rgba(255,255,255,0.05);">
            @for (t of transfers; track t.id) {
              <tr class="hover:bg-white/5 transition-colors">
                <td class="px-6 py-4 whitespace-nowrap text-gray-400 text-xs">
                  {{ t.created_at | date:'dd MMM yyyy, HH:mm' }}
                </td>
                <td class="px-6 py-4">
                  <div class="flex flex-col">
                    <div class="flex items-center gap-2">
                      <span class="px-2 py-0.5 rounded text-[10px] font-semibold uppercase"
                            [style.background]="t.from_type === 'retail' ? 'rgba(74,222,128,0.15)' : 'rgba(251,191,36,0.15)'"
                            [style.color]="t.from_type === 'retail' ? '#4ade80' : '#fbbf24'">
                        {{ t.from_type }}
                      </span>
                      <span style="color: #f0fdf4;">{{ t.from_product_name }}</span>
                    </div>
                    @if (t.business) {
                      <span class="text-[10px] text-gray-400 mt-0.5">🏪 {{ t.business.name }}</span>
                    }
                  </div>
                </td>
                <td class="px-6 py-4">
                  <div class="flex flex-col">
                    <div class="flex items-center gap-2">
                      <span class="px-2 py-0.5 rounded text-[10px] font-semibold uppercase"
                            [style.background]="t.to_type === 'retail' ? 'rgba(74,222,128,0.15)' : 'rgba(251,191,36,0.15)'"
                            [style.color]="t.to_type === 'retail' ? '#4ade80' : '#fbbf24'">
                        {{ t.to_type }}
                      </span>
                      <span style="color: #f0fdf4;">{{ t.to_product_name }}</span>
                      @if (t.auto_created) {
                        <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                              style="background: rgba(139,92,246,0.2); color: #a78bfa;">
                          Auto-created
                        </span>
                      }
                    </div>
                    @if (t.to_business) {
                      <span class="text-[10px] text-amber-400 mt-0.5">🏪 {{ t.to_business.name }}</span>
                    } @else if (t.business) {
                      <span class="text-[10px] text-gray-400 mt-0.5">🏪 {{ t.business.name }}</span>
                    }
                  </div>
                </td>
                <td class="px-6 py-4 font-semibold" style="color: #c084fc;">
                  {{ t.quantity }}
                </td>
                <td class="px-6 py-4 text-gray-400 italic text-xs max-w-xs truncate">
                  {{ t.note || '—' }}
                </td>
                <td class="px-6 py-4 text-gray-400 text-xs">
                  {{ t.transferred_by_user?.name || 'Admin' }}
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="6" class="px-6 py-12 text-center text-gray-500">
                  <div class="flex flex-col items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                        d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"/>
                    </svg>
                    No stock transfers recorded yet.
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="px-6 py-4 flex items-center justify-between border-t border-white/5 bg-white/5">
        <div class="text-xs text-gray-400">
          Showing <span class="text-white">{{ (currentPage - 1) * perPage + 1 }}</span> to
          <span class="text-white">{{ Math.min(currentPage * perPage, totalItems) }}</span> of
          <span class="text-white">{{ totalItems }}</span> transfers
        </div>
        <div class="flex gap-2">
          <button (click)="changePage(currentPage - 1)"
                  [disabled]="currentPage === 1"
                  class="p-2 rounded-lg bg-black/20 text-gray-400 hover:text-white disabled:opacity-30 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
            </svg>
          </button>
          <button (click)="changePage(currentPage + 1)"
                  [disabled]="currentPage === lastPage"
                  class="p-2 rounded-lg bg-black/20 text-gray-400 hover:text-white disabled:opacity-30 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  `
})
export class TransferHistory implements OnInit {
  private inventoryService = inject(InventoryService);
  private toastService     = inject(ToastService);
  private cdr              = inject(ChangeDetectorRef);

  Math = Math;
  transfers: StockTransfer[] = [];
  currentPage = 1;
  totalItems  = 0;
  perPage     = 15;
  lastPage    = 1;

  ngOnInit() {
    this.loadTransfers();
  }

  loadTransfers() {
    this.inventoryService.getStockTransfers({ page: this.currentPage, per_page: this.perPage }).subscribe({
      next: (res: any) => {
        const p = res as PaginatedResponse<StockTransfer>;
        this.transfers   = p.data;
        this.totalItems  = p.total;
        this.currentPage = p.current_page;
        this.lastPage    = p.last_page;
        // Map the nested user relation: API returns `transferred_by` as object when loaded
        this.transfers = this.transfers.map((t: any) => ({
          ...t,
          transferred_by_user: t.transferred_by_user ?? (typeof t.transferred_by === 'object' ? t.transferred_by : null)
        }));
        this.cdr.detectChanges();
      },
      error: () => this.toastService.error('Failed to load transfer history')
    });
  }

  changePage(page: number) {
    if (page >= 1 && page <= this.lastPage) {
      this.currentPage = page;
      this.loadTransfers();
    }
  }
}
