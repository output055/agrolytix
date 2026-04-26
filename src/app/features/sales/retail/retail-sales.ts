import { Component, OnInit, inject, computed, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SalesService } from '../../../core/services/sales.service';
import { ReversalService } from '../../../core/services/reversal.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { RetailSale, RetailSummary, SalesMeta, SalesFilter } from '../../../core/models/sales.model';

type Preset = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'this_year' | 'custom' | '';

@Component({
  selector: 'app-retail-sales',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="sales-page">

      <!-- Header -->
      <div class="page-header">
        <div>
          <h1 class="page-title">Retail Sales History</h1>
          <p class="page-subtitle">Track and analyse retail transactions</p>
        </div>
      </div>

      <!-- Filter Bar -->
      <div class="filter-card">
        <!-- Preset Chips -->
        <div class="preset-chips">
          @for (p of presets; track p.value) {
            <button class="chip" [class.chip-active]="filter.preset === p.value"
                    (click)="setPreset(p.value)">{{ p.label }}</button>
          }
        </div>

        <!-- Custom Date Range -->
        <div class="filter-row" style="margin-top: 1rem;">
          <div class="field-group">
            <label class="field-label">From Date</label>
            <input type="date" class="field-input" [(ngModel)]="filter.date_from" (change)="onCustomDateChange()">
          </div>
          <div class="field-group">
            <label class="field-label">To Date</label>
            <input type="date" class="field-input" [(ngModel)]="filter.date_to" (change)="onCustomDateChange()">
          </div>
        </div>

        <!-- Secondary Filters -->
        <div class="filter-row">
          <div class="field-group">
            <label class="field-label">Payment</label>
            <select class="field-input" [(ngModel)]="filter.payment_method" (change)="load()">
              <option value="">All</option>
              <option value="Cash">Cash</option>
              <option value="MoMo">MoMo</option>
            </select>
          </div>
          <div class="field-group">
            <label class="field-label">Status</label>
            <select class="field-input" [(ngModel)]="filter.status" (change)="load()">
              <option value="">All</option>
              <option value="completed">Completed</option>
              <option value="reversed">Reversed</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Summary Cards -->
      @if (summary) {
        <div class="summary-grid">
          <div class="summary-card">
            <div class="summary-label">Transactions</div>
            <div class="summary-value text-white">{{ summary.total_transactions }}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Total Revenue</div>
            <div class="summary-value text-green">GH₵{{ summary.total_revenue | number:'1.2-2' }}</div>
          </div>
          @if (isAdmin) {
            <div class="summary-card">
              <div class="summary-label">Total Cost</div>
              <div class="summary-value text-blue">GH₵{{ summary.total_cost | number:'1.2-2' }}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label">Total Profit</div>
              <div class="summary-value" [class.text-green]="summary.total_profit >= 0" [class.text-red]="summary.total_profit < 0">
                GH₵{{ summary.total_profit | number:'1.2-2' }}
              </div>
            </div>
          }
        </div>
      }

      <!-- Table -->
      <div class="table-card">
        @if (loading) {
          <div class="empty-state">
            <div class="spinner"></div>
            <p>Loading sales...</p>
          </div>
        } @else if (sales.length === 0) {
          <div class="empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" class="empty-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p>No sales found for the selected period.</p>
          </div>
        } @else {
          <div class="table-scroll">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Receipt #</th>
                  <th>Date & Time</th>
                  <th>Items</th>
                  <th>Payment</th>
                  <th>Revenue (GH₵)</th>
                  @if (isAdmin) {
                    <th>Cost (GH₵)</th>
                    <th>Profit (GH₵)</th>
                  }
                  <th>Status</th>
                  <th>Worker</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (sale of sales; track sale.id) {
                  <tr class="table-row" (click)="openReceipt(sale)">
                    <td>
                      <span class="receipt-badge">{{ sale.receipt_number }}</span>
                    </td>
                    <td class="text-muted">{{ sale.created_at | date:'d MMM y, h:mm a' }}</td>
                    <td class="text-muted">{{ sale.items?.length ?? 0 }} item(s)</td>
                    <td>
                      <span class="pill" [class.pill-green]="sale.payment_method === 'Cash'"
                            [class.pill-blue]="sale.payment_method === 'MoMo'">
                        {{ sale.payment_method }}
                      </span>
                    </td>
                    <td class="text-green font-bold">{{ sale.total_amount | number:'1.2-2' }}</td>
                    @if (isAdmin) {
                      <td class="text-blue">{{ sale.total_cost | number:'1.2-2' }}</td>
                      <td [class.text-green]="sale.profit >= 0" [class.text-red]="sale.profit < 0" class="font-bold">
                        {{ sale.profit | number:'1.2-2' }}
                      </td>
                    }
                    <td>
                      <span class="pill" [class.pill-green]="sale.status === 'completed'"
                            [class.pill-red]="sale.status === 'reversed'"
                            [class.pill-orange]="sale.status === 'partial_reversal'">
                        {{ sale.status === 'partial_reversal' ? 'Partial' : (sale.status | titlecase) }}
                      </span>
                    </td>
                    <td class="text-muted">{{ sale.worker?.name ?? '—' }}</td>
                    <td>
                      <button class="action-btn" (click)="openReceipt(sale); $event.stopPropagation()">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        View
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          @if (meta && meta.last_page > 1) {
            <div class="pagination">
              <button class="page-btn" [disabled]="meta.current_page === 1" (click)="goToPage(meta.current_page - 1)">‹ Prev</button>
              <span class="page-info">Page {{ meta.current_page }} of {{ meta.last_page }} &nbsp;·&nbsp; {{ meta.total }} records</span>
              <button class="page-btn" [disabled]="meta.current_page === meta.last_page" (click)="goToPage(meta.current_page + 1)">Next ›</button>
            </div>
          }
        }
      </div>
    </div>

    <!-- Receipt Modal -->
    @if (selectedSale) {
      <div class="modal-backdrop" (click)="closeReceipt()">
        <div class="receipt-modal" (click)="$event.stopPropagation()">
          <div class="receipt-header">
            <div>
              <h2 class="receipt-title">Sales Receipt</h2>
              <p class="receipt-sub">{{ selectedSale.receipt_number }}</p>
            </div>
            <button class="close-btn" (click)="closeReceipt()">✕</button>
          </div>

          <div class="receipt-meta-grid">
            <div>
              <div class="meta-label">Date</div>
              <div class="meta-value">{{ selectedSale.created_at | date:'d MMM yyyy, h:mm a' }}</div>
            </div>
            <div>
              <div class="meta-label">Worker</div>
              <div class="meta-value">{{ selectedSale.worker?.name ?? 'N/A' }}</div>
            </div>
            <div>
              <div class="meta-label">Payment</div>
              <div class="meta-value">{{ selectedSale.payment_method }}
                @if (selectedSale.momo_number) { <span class="text-muted">({{ selectedSale.momo_number }})</span> }
              </div>
            </div>
            <div>
              <div class="meta-label">Status</div>
              <div class="meta-value">
                <span class="pill" [class.pill-green]="selectedSale.status === 'completed'"
                      [class.pill-red]="selectedSale.status === 'reversed'">
                  {{ selectedSale.status | titlecase }}
                </span>
              </div>
            </div>
          </div>

          @if (selectedSale.reversal) {
            <div class="reversal-notice">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M12 3C7.03 3 3 7.03 3 12s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9z" />
              </svg>
              <div>
                <div class="font-semibold">Reversed</div>
                <div class="text-sm">{{ selectedSale.reversal.reason }}</div>
              </div>
            </div>
          }

          <!-- Items Table -->
          <div class="items-section">
            <table class="items-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Unit</th>
                  <th class="text-right">Qty</th>
                  <th class="text-right">Unit Price</th>
                  @if (isAdmin) { <th class="text-right">Cost</th> }
                  <th class="text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                @for (item of selectedSale.items; track item.id) {
                  <tr>
                    <td>{{ item.product_name }}</td>
                    <td class="text-muted">{{ item.unit_name }}</td>
                    <td class="text-right">{{ item.quantity }}</td>
                    <td class="text-right">GH₵{{ item.unit_price | number:'1.2-2' }}</td>
                    @if (isAdmin) { <td class="text-right text-blue">GH₵{{ item.cost_price | number:'1.2-2' }}</td> }
                    <td class="text-right font-bold text-green">GH₵{{ item.subtotal | number:'1.2-2' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Totals -->
          <div class="totals-section">
            <div class="total-row">
              <span class="total-label">Total Revenue</span>
              <span class="total-value text-green">GH₵{{ selectedSale.total_amount | number:'1.2-2' }}</span>
            </div>
            @if (isAdmin) {
              <div class="total-row">
                <span class="total-label">Total Cost</span>
                <span class="total-value text-blue">GH₵{{ selectedSale.total_cost | number:'1.2-2' }}</span>
              </div>
              <div class="total-row profit-row">
                <span class="total-label font-bold">Profit</span>
                <span class="total-value font-bold"
                      [class.text-green]="selectedSale.profit >= 0"
                      [class.text-red]="selectedSale.profit < 0">
                  GH₵{{ selectedSale.profit | number:'1.2-2' }}
                </span>
              </div>
            }
          </div>

          <!-- Reverse Sale -->
          @if (selectedSale.status !== 'reversed') {
            <div class="reverse-section">
              @if (canReverse(selectedSale)) {
                @if (!showReverseForm) {
                  <button class="reverse-btn" (click)="initReverseForm()">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                    </svg>
                    Reverse Items
                  </button>
                } @else {
                  <div class="reverse-form">
                    <p class="reverse-warning">⚠ Select items to reverse. Stock will be restored for selected items and sale totals will be adjusted.</p>

                    <!-- Item selection -->
                    <div class="reverse-items">
                      <label class="reverse-item select-all" (click)="toggleAll()">
                        <div class="reverse-item-toggle">
                          <input type="checkbox" [checked]="allSelected" class="item-checkbox">
                          <span class="select-all-text">{{ allSelected ? 'Deselect All' : 'Select All' }}</span>
                        </div>
                      </label>
                      @for (item of selectedSale.items; track item.id) {
                        <div class="reverse-item" [class.reverse-item-selected]="!!selectedItems[item.id]">
                          <label class="reverse-item-toggle">
                            <input type="checkbox" [checked]="!!selectedItems[item.id]" (change)="toggleItem(item.id)" class="item-checkbox">
                            <div class="reverse-item-info">
                              <span class="reverse-item-name">{{ item.product_name }}</span>
                              <span class="reverse-item-detail">{{ item.quantity }} × {{ item.unit_name }} @ GH₵{{ item.unit_price | number:'1.2-2' }}</span>
                            </div>
                          </label>
                          <div class="reverse-item-actions">
                            @if (selectedItems[item.id]) {
                              <div class="reverse-qty-control">
                                <span class="qty-label">Qty:</span>
                                <input type="number" class="qty-input" 
                                       min="1" [max]="item.quantity" 
                                       [(ngModel)]="selectedItems[item.id]" 
                                       (input)="checkQty(item.id, item.quantity)">
                              </div>
                              <span class="reverse-item-amount">GH₵{{ (item.unit_price * selectedItems[item.id]) | number:'1.2-2' }}</span>
                            } @else {
                              <span class="reverse-item-amount">GH₵{{ item.subtotal | number:'1.2-2' }}</span>
                            }
                          </div>
                        </div>
                      }
                    </div>

                    <!-- Reversal summary -->
                    @if (selectedCount > 0) {
                      <div class="reverse-summary">
                        <div class="reverse-summary-row">
                          <span>Items to reverse</span>
                          <span class="font-bold">{{ selectedCount }} of {{ selectedSale.items.length }}</span>
                        </div>
                        <div class="reverse-summary-row">
                          <span>Revenue to reverse</span>
                          <span class="text-red font-bold">-GH₵{{ reverseAmount | number:'1.2-2' }}</span>
                        </div>
                        <div class="reverse-summary-row">
                          <span>Cost to reverse</span>
                          <span class="text-blue">-GH₵{{ reverseCost | number:'1.2-2' }}</span>
                        </div>
                        <div class="reverse-summary-row">
                          <span>Profit impact</span>
                          <span class="text-red">-GH₵{{ reverseProfit | number:'1.2-2' }}</span>
                        </div>
                      </div>
                    }

                    <div class="reverse-field">
                      <label class="reverse-label">Reason for reversal</label>
                      <input type="text" class="reverse-input" [(ngModel)]="reverseReason" placeholder="e.g. Customer returned items">
                    </div>
                    <div class="reverse-actions">
                      <button class="reverse-cancel" (click)="cancelReverse()">Cancel</button>
                      <button class="reverse-confirm" [disabled]="reversing || selectedCount === 0" (click)="executeReversal()">
                        {{ reversing ? 'Reversing...' : 'Reverse Selected' }}
                      </button>
                    </div>
                  </div>
                }
              } @else {
                <div class="reversal-notice" style="margin: 0; background: rgba(248,113,113,0.05); border-color: rgba(248,113,113,0.15);">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <div class="font-bold" style="color: #fca5a5;">Reversal period has expired</div>
                    <div class="text-sm" style="color: #f87171; opacity: 0.8;">Reversals are only allowed within 24 hours of the original transaction.</div>
                  </div>
                </div>
              }
            </div>
          }

        </div>
      </div>
    }
  `,
  styles: [`
    .sales-page { padding: 0; }

    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
    .page-title  { font-size: 1.5rem; font-weight: 700; color: #f0fdf4; }
    .page-subtitle { font-size: 0.875rem; color: #9ca3af; margin-top: 0.25rem; }

    /* Filter card */
    .filter-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.07); border-radius: 1rem; padding: 1.25rem; margin-bottom: 1.25rem; display: flex; flex-direction: column; gap: 1rem; }

    .preset-chips { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .chip { padding: 0.375rem 0.875rem; border-radius: 9999px; font-size: 0.8125rem; font-weight: 500; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); color: #9ca3af; cursor: pointer; transition: all .2s; }
    .chip:hover { border-color: #4ade80; color: #4ade80; }
    .chip-active { background: rgba(74,222,128,0.15); border-color: #4ade80; color: #4ade80; }

    .date-range-row { display: flex; gap: 1rem; flex-wrap: wrap; }
    .filter-row     { display: flex; gap: 1rem; flex-wrap: wrap; }
    .field-group    { display: flex; flex-direction: column; gap: 0.25rem; flex: 1; min-width: 140px; }
    .field-label    { font-size: 0.75rem; color: #9ca3af; font-weight: 500; }
    .field-input    { background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 0.625rem; padding: 0.4rem 0.75rem; color: #f0fdf4; font-size: 0.875rem; outline: none; transition: border-color .2s; }
    .field-input:focus { border-color: #4ade80; }
    .field-input option { background: #1a2e1a; }

    /* Summary */
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 1.25rem; }
    .summary-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.07); border-radius: 1rem; padding: 1.25rem; }
    .summary-label { font-size: 0.75rem; color: #9ca3af; font-weight: 500; margin-bottom: 0.5rem; }
    .summary-value { font-size: 1.5rem; font-weight: 700; }
    .text-white  { color: #f0fdf4; }
    .text-green  { color: #4ade80; }
    .text-blue   { color: #60a5fa; }
    .text-red    { color: #f87171; }
    .text-muted  { color: #9ca3af; }
    .font-bold   { font-weight: 700; }

    /* Table */
    .table-card  { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.07); border-radius: 1rem; overflow: hidden; }
    .table-scroll{ overflow-x: auto; }
    .data-table  { width: 100%; border-collapse: collapse; font-size: 0.875rem; color: #d1d5db; }
    .data-table thead { background: rgba(255,255,255,0.03); }
    .data-table th { padding: 0.875rem 1rem; text-align: left; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: #9ca3af; border-bottom: 1px solid rgba(255,255,255,0.06); white-space: nowrap; }
    .data-table td { padding: 0.875rem 1rem; border-bottom: 1px solid rgba(255,255,255,0.04); vertical-align: middle; }
    .table-row   { cursor: pointer; transition: background .15s; }
    .table-row:hover { background: rgba(255,255,255,0.04); }
    .table-row:last-child td { border-bottom: none; }
    .text-right  { text-align: right; }

    .receipt-badge { background: rgba(255,255,255,0.07); padding: 0.2rem 0.6rem; border-radius: 0.375rem; font-size: 0.8rem; font-family: monospace; color: #e5e7eb; }

    .pill { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
    .pill-green { background: rgba(74,222,128,0.15); color: #4ade80; }
    .pill-blue  { background: rgba(96,165,250,0.15); color: #60a5fa; }
    .pill-red   { background: rgba(248,113,113,0.15); color: #f87171; }

    .action-btn { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.3rem 0.65rem; border-radius: 0.5rem; font-size: 0.8rem; font-weight: 500; background: rgba(255,255,255,0.06); color: #9ca3af; border: none; cursor: pointer; transition: all .2s; }
    .action-btn:hover { background: rgba(255,255,255,0.12); color: #f0fdf4; }

    .empty-state { text-align: center; padding: 4rem 1rem; color: #6b7280; }
    .empty-icon  { width: 3rem; height: 3rem; margin: 0 auto 1rem; opacity: .4; }
    .spinner     { width: 2rem; height: 2rem; border: 2px solid rgba(74,222,128,0.2); border-top-color: #4ade80; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 1rem; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .pagination  { display: flex; align-items: center; justify-content: center; gap: 1rem; padding: 1rem; border-top: 1px solid rgba(255,255,255,0.05); }
    .page-btn    { padding: 0.375rem 0.875rem; border-radius: 0.5rem; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: #9ca3af; cursor: pointer; font-size: 0.875rem; transition: all .2s; }
    .page-btn:disabled { opacity: .4; cursor: not-allowed; }
    .page-btn:not(:disabled):hover { background: rgba(74,222,128,0.15); color: #4ade80; border-color: #4ade80; }
    .page-info   { font-size: 0.8125rem; color: #6b7280; }

    /* Modal */
    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); z-index: 50; display: flex; align-items: center; justify-content: center; padding: 1rem; }
    .receipt-modal  { background: #0f1f0f; border: 1px solid rgba(255,255,255,0.1); border-radius: 1.25rem; width: 100%; max-width: 640px; max-height: 90vh; overflow-y: auto; box-shadow: 0 25px 60px rgba(0,0,0,0.5); }
    .receipt-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 1.5rem 1.5rem 1rem; border-bottom: 1px solid rgba(255,255,255,0.07); }
    .receipt-title  { font-size: 1.15rem; font-weight: 700; color: #f0fdf4; }
    .receipt-sub    { font-size: 0.8rem; color: #9ca3af; margin-top: 0.2rem; font-family: monospace; }
    .close-btn      { background: rgba(255,255,255,0.06); border: none; color: #9ca3af; font-size: 1rem; width: 2rem; height: 2rem; border-radius: 50%; cursor: pointer; transition: all .2s; }
    .close-btn:hover { background: rgba(248,113,113,0.2); color: #f87171; }

    .receipt-meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; padding: 1.25rem 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.07); }
    .meta-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: .05em; color: #6b7280; margin-bottom: 0.2rem; }
    .meta-value { font-size: 0.9rem; color: #e5e7eb; }

    .reversal-notice { margin: 0.75rem 1.5rem; background: rgba(248,113,113,0.1); border: 1px solid rgba(248,113,113,0.3); border-radius: 0.75rem; padding: 0.75rem 1rem; display: flex; gap: 0.75rem; align-items: flex-start; color: #f87171; }

    .items-section { padding: 1rem 1.5rem; }
    .items-table   { width: 100%; border-collapse: collapse; font-size: 0.85rem; color: #d1d5db; }
    .items-table th { text-align: left; font-size: 0.7rem; text-transform: uppercase; color: #6b7280; font-weight: 600; padding: 0.5rem 0; border-bottom: 1px solid rgba(255,255,255,0.07); }
    .items-table td { padding: 0.65rem 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
    .items-table tr:last-child td { border-bottom: none; }

    .totals-section { border-top: 1px solid rgba(255,255,255,0.07); padding: 1rem 1.5rem 1.5rem; }
    .total-row { display: flex; justify-content: space-between; align-items: center; padding: 0.4rem 0; }
    .total-label { font-size: 0.875rem; color: #9ca3af; }
    .total-value { font-size: 1rem; font-weight: 600; }
    .profit-row  { border-top: 1px solid rgba(255,255,255,0.07); margin-top: 0.5rem; padding-top: 0.75rem; }

    /* Reverse section */
    .reverse-section { border-top: 1px solid rgba(255,255,255,0.07); padding: 1rem 1.5rem 1.5rem; }
    .reverse-btn { display: inline-flex; align-items: center; gap: 0.4rem; background: rgba(248,113,113,0.12); border: 1px solid rgba(248,113,113,0.3); color: #f87171; padding: 0.5rem 1.25rem; border-radius: 0.625rem; font-size: 0.875rem; font-weight: 600; cursor: pointer; transition: all 0.2s; }
    .reverse-btn:hover { background: rgba(248,113,113,0.22); }
    .reverse-form { display: flex; flex-direction: column; gap: 0.75rem; }
    .reverse-warning { font-size: 0.8rem; color: #fb923c; background: rgba(251,146,60,0.1); border: 1px solid rgba(251,146,60,0.25); border-radius: 0.5rem; padding: 0.6rem 0.8rem; margin: 0; }
    .reverse-field { display: flex; flex-direction: column; gap: 0.25rem; }
    .reverse-label { font-size: 0.75rem; color: #9ca3af; font-weight: 500; }
    .reverse-input { background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 0.625rem; padding: 0.5rem 0.75rem; color: #f0fdf4; font-size: 0.875rem; outline: none; transition: border-color 0.2s; }
    .reverse-input:focus { border-color: #f87171; }
    .reverse-actions { display: flex; justify-content: flex-end; gap: 0.75rem; }
    .reverse-cancel { background: transparent; border: 1px solid rgba(255,255,255,0.1); color: #9ca3af; padding: 0.4rem 1rem; border-radius: 0.5rem; cursor: pointer; font-size: 0.875rem; transition: all 0.2s; }
    .reverse-cancel:hover { color: #f0fdf4; }
    .reverse-confirm { background: #dc2626; color: #fff; padding: 0.4rem 1.25rem; border-radius: 0.5rem; border: none; cursor: pointer; font-size: 0.875rem; font-weight: 700; transition: all 0.2s; }
    .reverse-confirm:disabled { opacity: 0.5; cursor: not-allowed; }
    .reverse-confirm:not(:disabled):hover { background: #b91c1c; }

    /* Item selection */
    .reverse-items { display: flex; flex-direction: column; gap: 0.375rem; }
    .reverse-item { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; padding: 0.6rem 0.75rem; border-radius: 0.5rem; border: 1px solid rgba(255,255,255,0.06); background: rgba(0,0,0,0.2); transition: all 0.15s; }
    .reverse-item:hover { border-color: rgba(248,113,113,0.3); }
    .reverse-item-selected { border-color: rgba(248,113,113,0.4); background: rgba(248,113,113,0.08); }
    .reverse-item-toggle { display: flex; align-items: center; gap: 0.75rem; cursor: pointer; flex: 1; }
    .reverse-item-actions { display: flex; align-items: center; gap: 0.75rem; }
    .item-checkbox { accent-color: #f87171; width: 1rem; height: 1rem; cursor: pointer; flex-shrink: 0; }
    .reverse-item-info { flex: 1; display: flex; flex-direction: column; gap: 0.1rem; }
    .reverse-item-name { font-size: 0.85rem; color: #e5e7eb; font-weight: 500; }
    .reverse-item-detail { font-size: 0.75rem; color: #6b7280; }
    .reverse-item-amount { font-size: 0.85rem; font-weight: 600; color: #f87171; white-space: nowrap; min-width: 4rem; text-align: right; }
    .select-all { border-style: dashed; cursor: pointer; }
    .select-all-text { font-size: 0.8rem; color: #9ca3af; font-weight: 500; }

    /* Quantity inputs */
    .reverse-qty-control { display: flex; align-items: center; gap: 0.3rem; background: rgba(0,0,0,0.3); padding: 0.15rem 0.3rem; border-radius: 0.375rem; }
    .qty-label { font-size: 0.7rem; color: #9ca3af; }
    .qty-input { width: 3rem; background: transparent; border: 1px solid rgba(255,255,255,0.1); color: white; padding: 0.1rem 0.25rem; border-radius: 0.25rem; font-size: 0.8rem; outline: none; text-align: center; }
    .qty-input:focus { border-color: #f87171; }

    /* Reversal summary */
    .reverse-summary { background: rgba(248,113,113,0.08); border: 1px solid rgba(248,113,113,0.2); border-radius: 0.5rem; padding: 0.6rem 0.8rem; }
    .reverse-summary-row { display: flex; justify-content: space-between; padding: 0.2rem 0; font-size: 0.8rem; color: #9ca3af; }
  `]
})
export class RetailSales implements OnInit {
  private salesService    = inject(SalesService);
  private reversalService = inject(ReversalService);
  private authService     = inject(AuthService);
  private toastService    = inject(ToastService);
  private cdr             = inject(ChangeDetectorRef);

  sales: RetailSale[]    = [];
  summary: RetailSummary | null = null;
  meta: SalesMeta | null = null;
  loading = false;
  selectedSale: RetailSale | null = null;

  get isAdmin(): boolean {
    return this.authService.currentUser()?.role === 'Admin';
  }

  canReverse(sale: RetailSale | null): boolean {
    if (!sale || !sale.created_at) return false;
    const saleDate = new Date(sale.created_at);
    const now = new Date();
    const diffInMs = now.getTime() - saleDate.getTime();
    return diffInMs < 24 * 60 * 60 * 1000;
  }

  presets = [
    { label: 'Today',      value: 'today'      as Preset },
    { label: 'Yesterday',  value: 'yesterday'  as Preset },
    { label: 'This Week',  value: 'this_week'  as Preset },
    { label: 'This Month', value: 'this_month' as Preset },
    { label: 'This Year',  value: 'this_year'  as Preset }
  ];

  filter: SalesFilter = {
    preset: 'today',
    payment_method: '',
    status: '',
  };

  ngOnInit(): void {
    this.load();
  }

  setPreset(value: Preset) {
    this.filter.preset = value;
    if (value !== 'custom') {
      this.filter.date_from = undefined;
      this.filter.date_to   = undefined;
    }
    this.load();
  }

  onCustomDateChange() {
    this.filter.preset = 'custom';
    this.load();
  }

  load(page = 1) {
    this.loading = true;
    this.cdr.detectChanges();
    this.salesService.getRetailSales(this.filter, page).subscribe({
      next: (res) => {
        this.sales   = res.data;
        this.meta    = res.meta;
        this.summary = res.summary;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.toastService.show('Failed to load retail sales', 'error');
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  goToPage(page: number) {
    this.load(page);
  }

  // Reversal state
  showReverseForm = false;
  reverseReason = '';
  reversing = false;
  selectedItems: { [id: number]: number } = {};

  get selectedCount(): number {
    return Object.keys(this.selectedItems).length;
  }

  get allSelected(): boolean {
    return !!this.selectedSale && this.selectedCount === this.selectedSale.items.length;
  }

  get reverseAmount(): number {
    if (!this.selectedSale) return 0;
    return this.selectedSale.items.reduce((sum, item) => {
      const qty = this.selectedItems[item.id] || 0;
      return sum + (qty * item.unit_price);
    }, 0);
  }

  get reverseCost(): number {
    if (!this.selectedSale) return 0;
    return this.selectedSale.items.reduce((sum, item) => {
      const qty = this.selectedItems[item.id] || 0;
      return sum + (qty * item.cost_price);
    }, 0);
  }

  get reverseProfit(): number {
    return this.reverseAmount - this.reverseCost;
  }

  initReverseForm() {
    this.showReverseForm = true;
    this.selectedItems = {};
    this.reverseReason = '';
  }

  toggleItem(id: number) {
    if (this.selectedItems[id]) {
      delete this.selectedItems[id];
    } else {
      const item = this.selectedSale?.items.find(i => i.id === id);
      if (item) this.selectedItems[id] = item.quantity;
    }
  }

  checkQty(id: number, max: number) {
    let val = this.selectedItems[id];
    if (val > max) this.selectedItems[id] = max;
    if (val < 1) this.selectedItems[id] = 1;
  }

  toggleAll() {
    if (!this.selectedSale) return;
    if (this.allSelected) {
      this.selectedItems = {};
    } else {
      this.selectedItems = {};
      this.selectedSale.items.forEach(i => {
        this.selectedItems[i.id] = i.quantity;
      });
    }
  }

  cancelReverse() {
    this.showReverseForm = false;
    this.reverseReason = '';
    this.selectedItems = {};
  }

  openReceipt(sale: RetailSale) {
    this.selectedSale = sale;
    this.showReverseForm = false;
    this.reverseReason = '';
    this.selectedItems = {};
  }

  closeReceipt() {
    this.selectedSale = null;
    this.showReverseForm = false;
    this.reverseReason = '';
    this.selectedItems = {};
  }

  executeReversal() {
    if (!this.selectedSale || this.selectedCount === 0) return;
    this.reversing = true;
    
    const payloadItems = Object.entries(this.selectedItems).map(([id, qty]) => ({
      id: +id,
      quantity: qty
    }));

    this.reversalService.reverseSale(this.selectedSale.id, payloadItems, this.reverseReason).subscribe({
      next: () => {
        const count = payloadItems.length;
        const total = this.selectedSale!.items.length;
        const msg = count === total
          ? 'Sale fully reversed — stock restored'
          : `${count} item(s) reversed — stock restored, sale totals updated`;
        this.toastService.show(msg, 'success');
        this.selectedSale = null;
        this.showReverseForm = false;
        this.reverseReason = '';
        this.selectedItems = {};
        this.reversing = false;
        this.load(this.meta?.current_page ?? 1);
      },
      error: (err) => {
        this.toastService.show(err.error?.message || 'Reversal failed', 'error');
        this.reversing = false;
        this.cdr.detectChanges();
      }
    });
  }
}
