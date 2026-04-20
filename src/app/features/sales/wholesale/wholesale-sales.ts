import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SalesService } from '../../../core/services/sales.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { WholesaleSale, WholesaleSummary, SalesMeta, SalesFilter } from '../../../core/models/sales.model';

type Preset = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'this_year' | 'custom' | '';

@Component({
  selector: 'app-wholesale-sales',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="sales-page">

      <!-- Header -->
      <div class="page-header">
        <div>
          <h1 class="page-title">Wholesale Sales History</h1>
          <p class="page-subtitle">Track wholesale transactions, debts and collections</p>
        </div>
      </div>

      <!-- Filter Bar -->
      <div class="filter-card">
        <div class="preset-chips">
          @for (p of presets; track p.value) {
            <button class="chip" [class.chip-active]="filter.preset === p.value"
                    (click)="setPreset(p.value)">{{ p.label }}</button>
          }
        </div>

        <!-- Date Range -->
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

        <div class="filter-row">
          <div class="field-group">
            <label class="field-label">Payment</label>
            <select class="field-input" [(ngModel)]="filter.payment_method" (change)="load()">
              <option value="">All</option>
              <option value="Cash">Cash</option>
              <option value="MoMo">MoMo</option>
              <option value="Debt">Debt</option>
            </select>
          </div>
          <div class="field-group">
            <label class="field-label">Status</label>
            <select class="field-input" [(ngModel)]="filter.status" (change)="load()">
              <option value="">All</option>
              <option value="completed">Completed</option>
              <option value="partial">Partial (Debt)</option>
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
          <div class="summary-card">
            <div class="summary-label">Collected</div>
            <div class="summary-value text-blue">GH₵{{ summary.total_collected | number:'1.2-2' }}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">Outstanding Debt</div>
            <div class="summary-value" [class.text-red]="summary.total_outstanding_debt > 0" [class.text-green]="summary.total_outstanding_debt === 0">
              GH₵{{ summary.total_outstanding_debt | number:'1.2-2' }}
            </div>
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
                  <th>Client</th>
                  <th>Items</th>
                  <th>Payment</th>
                  <th>Revenue (GH₵)</th>
                  <th>Collected</th>
                  <th>Debt</th>
                  @if (isAdmin) {
                    <th>Cost</th>
                    <th>Profit</th>
                  }
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (sale of sales; track sale.id) {
                  <tr class="table-row" (click)="openReceipt(sale)">
                    <td><span class="receipt-badge">{{ sale.receipt_number }}</span></td>
                    <td class="text-muted">{{ sale.created_at | date:'d MMM y, h:mm a' }}</td>
                    <td class="text-white">{{ sale.client?.name ?? '—' }}</td>
                    <td class="text-muted">{{ sale.items?.length ?? 0 }} item(s)</td>
                    <td>
                      <span class="pill" [class.pill-green]="sale.payment_method === 'Cash'"
                            [class.pill-blue]="sale.payment_method === 'MoMo'"
                            [class.pill-orange]="sale.payment_method === 'Debt'">
                        {{ sale.payment_method }}
                      </span>
                    </td>
                    <td class="text-green font-bold">{{ sale.total_amount | number:'1.2-2' }}</td>
                    <td class="text-blue">{{ sale.amount_paid | number:'1.2-2' }}</td>
                    <td>
                      @if (sale.debt > 0) {
                        <span class="text-red font-bold">{{ sale.debt | number:'1.2-2' }}</span>
                      } @else {
                        <span class="text-green">0.00</span>
                      }
                    </td>
                    @if (isAdmin) {
                      <td class="text-blue">{{ sale.total_cost | number:'1.2-2' }}</td>
                      <td [class.text-green]="sale.profit >= 0" [class.text-red]="sale.profit < 0" class="font-bold">{{ sale.profit | number:'1.2-2' }}</td>
                    }
                    <td>
                      <span class="pill" [class.pill-green]="sale.status === 'completed'"
                            [class.pill-orange]="sale.status === 'partial'">
                        {{ sale.status | titlecase }}
                      </span>
                    </td>
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

          @if (meta && meta.last_page > 1) {
            <div class="pagination">
              <button class="page-btn" [disabled]="meta.current_page === 1" (click)="goToPage(meta.current_page - 1)">Prev</button>
              <span class="page-info">Page {{ meta.current_page }} of {{ meta.last_page }} &bull; {{ meta.total }} records</span>
              <button class="page-btn" [disabled]="meta.current_page === meta.last_page" (click)="goToPage(meta.current_page + 1)">Next</button>
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
              <h2 class="receipt-title">Wholesale Receipt</h2>
              <p class="receipt-sub">{{ selectedSale.receipt_number }}</p>
            </div>
            <button class="close-btn" (click)="closeReceipt()">X</button>
          </div>

          <div class="receipt-meta-grid">
            <div>
              <div class="meta-label">Date</div>
              <div class="meta-value">{{ selectedSale.created_at | date:'d MMM yyyy, h:mm a' }}</div>
            </div>
            <div>
              <div class="meta-label">Client</div>
              <div class="meta-value">{{ selectedSale.client?.name ?? 'N/A' }}</div>
            </div>
            <div>
              <div class="meta-label">Worker</div>
              <div class="meta-value">{{ selectedSale.worker?.name ?? 'N/A' }}</div>
            </div>
            <div>
              <div class="meta-label">Payment</div>
              <div class="meta-value">{{ selectedSale.payment_method }}
                @if (selectedSale.momo_number) {
                  <span class="text-muted"> ({{ selectedSale.momo_number }})</span>
                }
              </div>
            </div>
            <div>
              <div class="meta-label">Status</div>
              <div class="meta-value">
                <span class="pill" [class.pill-green]="selectedSale.status === 'completed'"
                      [class.pill-orange]="selectedSale.status === 'partial'">
                  {{ selectedSale.status | titlecase }}
                </span>
              </div>
            </div>
          </div>

          <!-- Items -->
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
                    @if (isAdmin) {
                      <td class="text-right text-blue">GH₵{{ item.cost_price | number:'1.2-2' }}</td>
                    }
                    <td class="text-right font-bold text-green">GH₵{{ item.subtotal | number:'1.2-2' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Totals -->
          <div class="totals-section">
            <div class="total-row">
              <span class="total-label">Total Invoice</span>
              <span class="total-value text-white">GH₵{{ selectedSale.total_amount | number:'1.2-2' }}</span>
            </div>
            <div class="total-row">
              <span class="total-label">Collected</span>
              <span class="total-value text-green">GH₵{{ selectedSale.amount_paid | number:'1.2-2' }}</span>
            </div>
            @if (selectedSale.debt > 0) {
              <div class="total-row">
                <span class="total-label text-red">Outstanding Debt</span>
                <span class="total-value text-red font-bold">GH₵{{ selectedSale.debt | number:'1.2-2' }}</span>
              </div>
            }
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

          <!-- Debt Payment History (Admin only) -->
          @if (isAdmin && selectedSale.debtPayments && selectedSale.debtPayments.length > 0) {
            <div class="debt-payments-section">
              <h4 class="section-title">Debt Payment History</h4>
              <div class="debt-list">
                @for (payment of selectedSale.debtPayments; track payment.id) {
                  <div class="debt-item">
                    <div>
                      <div class="meta-value text-green">GH₵{{ payment.amount_paid | number:'1.2-2' }} paid</div>
                      @if (payment.note) { <div class="text-muted text-sm">{{ payment.note }}</div> }
                    </div>
                    <div class="text-right">
                      <div class="meta-value text-muted">GH₵{{ payment.old_debt | number:'1.2-2' }} &rarr; GH₵{{ payment.new_debt | number:'1.2-2' }}</div>
                      <div class="text-muted text-sm">{{ payment.created_at | date:'d MMM y' }}</div>
                    </div>
                  </div>
                }
              </div>
            </div>
          }

          <!-- Pay Debt (Admin only) -->
          @if (isAdmin && selectedSale.debt > 0) {
            <div class="pay-debt-section">
              @if (!showPayDebt) {
                <button class="pay-btn" (click)="showPayDebt = true">+ Record Debt Payment</button>
              } @else {
                <div class="pay-form">
                  <div class="field-group">
                    <label class="field-label">Amount (max GH₵{{ selectedSale.debt | number:'1.2-2' }})</label>
                    <input type="number" class="field-input" [(ngModel)]="payAmount"
                           [max]="selectedSale.debt" min="0.01" placeholder="0.00">
                  </div>
                  <div class="field-group">
                    <label class="field-label">Note (optional)</label>
                    <input type="text" class="field-input" [(ngModel)]="payNote" placeholder="e.g. Cash payment">
                  </div>
                  <div class="pay-actions">
                    <button class="cancel-btn" (click)="showPayDebt = false">Cancel</button>
                    <button class="confirm-pay-btn"
                            [disabled]="!payAmount || payAmount <= 0 || payAmount > selectedSale.debt || payingDebt"
                            (click)="submitDebtPayment()">
                      {{ payingDebt ? 'Processing...' : 'Confirm Payment' }}
                    </button>
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

    .filter-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.07); border-radius: 1rem; padding: 1.25rem; margin-bottom: 1.25rem; display: flex; flex-direction: column; gap: 1rem; }
    .preset-chips { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .chip { padding: 0.375rem 0.875rem; border-radius: 9999px; font-size: 0.8125rem; font-weight: 500; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); color: #9ca3af; cursor: pointer; transition: all .2s; }
    .chip:hover { border-color: #4ade80; color: #4ade80; }
    .chip-active { background: rgba(74,222,128,0.15); border-color: #4ade80; color: #4ade80; }

    .filter-row  { display: flex; gap: 1rem; flex-wrap: wrap; }
    .field-group { display: flex; flex-direction: column; gap: 0.25rem; flex: 1; min-width: 140px; }
    .field-label { font-size: 0.75rem; color: #9ca3af; font-weight: 500; }
    .field-input { background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 0.625rem; padding: 0.4rem 0.75rem; color: #f0fdf4; font-size: 0.875rem; outline: none; transition: border-color .2s; width: 100%; box-sizing: border-box; }
    .field-input:focus { border-color: #4ade80; }
    .field-input option { background: #1a2e1a; }

    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 1rem; margin-bottom: 1.25rem; }
    .summary-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.07); border-radius: 1rem; padding: 1.25rem; }
    .summary-label { font-size: 0.75rem; color: #9ca3af; font-weight: 500; margin-bottom: 0.5rem; }
    .summary-value { font-size: 1.5rem; font-weight: 700; }

    .text-white  { color: #f0fdf4; }
    .text-green  { color: #4ade80; }
    .text-blue   { color: #60a5fa; }
    .text-red    { color: #f87171; }
    .text-muted  { color: #9ca3af; }
    .text-sm     { font-size: 0.8rem; }
    .font-bold   { font-weight: 700; }
    .text-right  { text-align: right; }

    .table-card  { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.07); border-radius: 1rem; overflow: hidden; }
    .table-scroll{ overflow-x: auto; }
    .data-table  { width: 100%; border-collapse: collapse; font-size: 0.875rem; color: #d1d5db; }
    .data-table thead { background: rgba(255,255,255,0.03); }
    .data-table th { padding: 0.875rem 1rem; text-align: left; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: #9ca3af; border-bottom: 1px solid rgba(255,255,255,0.06); white-space: nowrap; }
    .data-table td { padding: 0.875rem 1rem; border-bottom: 1px solid rgba(255,255,255,0.04); vertical-align: middle; white-space: nowrap; }
    .table-row   { cursor: pointer; transition: background .15s; }
    .table-row:hover { background: rgba(255,255,255,0.04); }
    .table-row:last-child td { border-bottom: none; }

    .receipt-badge { background: rgba(255,255,255,0.07); padding: 0.2rem 0.6rem; border-radius: 0.375rem; font-size: 0.8rem; font-family: monospace; color: #e5e7eb; }
    .pill { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
    .pill-green  { background: rgba(74,222,128,0.15); color: #4ade80; }
    .pill-blue   { background: rgba(96,165,250,0.15); color: #60a5fa; }
    .pill-red    { background: rgba(248,113,113,0.15); color: #f87171; }
    .pill-orange { background: rgba(251,146,60,0.15); color: #fb923c; }

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

    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); z-index: 50; display: flex; align-items: center; justify-content: center; padding: 1rem; }
    .receipt-modal  { background: #0f1f0f; border: 1px solid rgba(255,255,255,0.1); border-radius: 1.25rem; width: 100%; max-width: 680px; max-height: 90vh; overflow-y: auto; box-shadow: 0 25px 60px rgba(0,0,0,0.5); }
    .receipt-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 1.5rem 1.5rem 1rem; border-bottom: 1px solid rgba(255,255,255,0.07); }
    .receipt-title  { font-size: 1.15rem; font-weight: 700; color: #f0fdf4; }
    .receipt-sub    { font-size: 0.8rem; color: #9ca3af; margin-top: 0.2rem; font-family: monospace; }
    .close-btn      { background: rgba(255,255,255,0.06); border: none; color: #9ca3af; font-size: 1rem; width: 2rem; height: 2rem; border-radius: 50%; cursor: pointer; transition: all .2s; }
    .close-btn:hover { background: rgba(248,113,113,0.2); color: #f87171; }

    .receipt-meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; padding: 1.25rem 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.07); }
    .meta-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: .05em; color: #6b7280; margin-bottom: 0.2rem; }
    .meta-value { font-size: 0.9rem; color: #e5e7eb; }

    .items-section  { padding: 1rem 1.5rem; }
    .section-title  { font-size: 0.85rem; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 0.75rem; }
    .items-table    { width: 100%; border-collapse: collapse; font-size: 0.85rem; color: #d1d5db; }
    .items-table th { text-align: left; font-size: 0.7rem; text-transform: uppercase; color: #6b7280; font-weight: 600; padding: 0.5rem 0; border-bottom: 1px solid rgba(255,255,255,0.07); }
    .items-table td { padding: 0.65rem 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
    .items-table tr:last-child td { border-bottom: none; }

    .totals-section { border-top: 1px solid rgba(255,255,255,0.07); padding: 1rem 1.5rem; }
    .total-row { display: flex; justify-content: space-between; align-items: center; padding: 0.4rem 0; }
    .total-label { font-size: 0.875rem; color: #9ca3af; }
    .total-value { font-size: 1rem; font-weight: 600; }
    .profit-row { border-top: 1px solid rgba(255,255,255,0.07); margin-top: 0.5rem; padding-top: 0.75rem; }

    .debt-payments-section { border-top: 1px solid rgba(255,255,255,0.07); padding: 1rem 1.5rem; }
    .debt-list { display: flex; flex-direction: column; gap: 0.5rem; }
    .debt-item { display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); border-radius: 0.625rem; padding: 0.75rem 1rem; }

    .pay-debt-section { border-top: 1px solid rgba(255,255,255,0.07); padding: 1rem 1.5rem 1.5rem; }
    .pay-btn { background: rgba(74,222,128,0.15); border: 1px solid rgba(74,222,128,0.3); color: #4ade80; padding: 0.5rem 1.25rem; border-radius: 0.625rem; cursor: pointer; font-size: 0.875rem; font-weight: 600; transition: all .2s; }
    .pay-btn:hover { background: rgba(74,222,128,0.25); }
    .pay-form { display: flex; flex-direction: column; gap: 0.75rem; }
    .pay-actions { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 0.5rem; }
    .cancel-btn { background: transparent; border: 1px solid rgba(255,255,255,0.1); color: #9ca3af; padding: 0.4rem 1rem; border-radius: 0.5rem; cursor: pointer; font-size: 0.875rem; transition: all .2s; }
    .cancel-btn:hover { color: #f0fdf4; }
    .confirm-pay-btn { background: #4ade80; color: #064e3b; padding: 0.4rem 1.25rem; border-radius: 0.5rem; border: none; cursor: pointer; font-size: 0.875rem; font-weight: 700; transition: all .2s; }
    .confirm-pay-btn:disabled { opacity: .5; cursor: not-allowed; }
    .confirm-pay-btn:not(:disabled):hover { background: #22c55e; }
  `]
})
export class WholesaleSales implements OnInit {
  private salesService = inject(SalesService);
  private authService  = inject(AuthService);
  private toastService = inject(ToastService);
  private cdr          = inject(ChangeDetectorRef);

  sales: WholesaleSale[]    = [];
  summary: WholesaleSummary | null = null;
  meta: SalesMeta | null    = null;
  loading = false;
  selectedSale: WholesaleSale | null = null;

  showPayDebt = false;
  payAmount   = 0;
  payNote     = '';
  payingDebt  = false;

  get isAdmin(): boolean {
    return this.authService.currentUser()?.role === 'Admin';
  }

  presets = [
    { label: 'Today',      value: 'today'      as Preset },
    { label: 'Yesterday',  value: 'yesterday'  as Preset },
    { label: 'This Week',  value: 'this_week'  as Preset },
    { label: 'This Month', value: 'this_month' as Preset },
    { label: 'This Year',  value: 'this_year'  as Preset }
  ];

  filter: SalesFilter = { preset: 'today', payment_method: '', status: '' };

  ngOnInit(): void { this.load(); }

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
    this.salesService.getWholesaleSales(this.filter, page).subscribe({
      next: (res) => {
        this.sales   = res.data;
        this.meta    = res.meta;
        this.summary = res.summary;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.toastService.show('Failed to load wholesale sales', 'error');
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  goToPage(page: number) { this.load(page); }

  openReceipt(sale: WholesaleSale) {
    this.selectedSale = sale;
    this.showPayDebt  = false;
    this.payAmount    = 0;
    this.payNote      = '';
  }

  closeReceipt() {
    this.selectedSale = null;
    this.showPayDebt  = false;
  }

  submitDebtPayment() {
    if (!this.selectedSale) return;
    this.payingDebt = true;
    this.cdr.detectChanges();
    this.salesService.payWholesaleDebt(this.selectedSale.id, {
      amount_paid: this.payAmount,
      note: this.payNote || undefined
    }).subscribe({
      next: (updated) => {
        this.toastService.show('Debt payment recorded', 'success');
        this.sales = this.sales.map(s => s.id === updated.id ? { ...s, ...updated } : s);
        this.selectedSale = { ...this.selectedSale!, ...updated };
        this.showPayDebt  = false;
        this.payingDebt   = false;
        this.cdr.detectChanges();
        this.load(this.meta?.current_page ?? 1);
      },
      error: (err) => {
        this.toastService.show(err.error?.message || 'Payment failed', 'error');
        this.payingDebt = false;
        this.cdr.detectChanges();
      }
    });
  }
}
