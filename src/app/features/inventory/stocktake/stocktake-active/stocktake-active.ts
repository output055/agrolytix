import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { StocktakeService } from '../../../../core/services/stocktake.service';
import { InventoryService } from '../../../../core/services/inventory.service';
import { ToastService } from '../../../../core/services/toast.service';
import {
  StocktakeSession,
  StocktakeItem,
  StocktakeSummaryStats,
  DiscrepancyReason,
  OffsetStatus,
  UnitBreakdown,
} from '../../../../core/models/stocktake.model';
import { StocktakeReportModal } from '../stocktake-report-modal/stocktake-report-modal';

@Component({
  selector: 'app-stocktake-active',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DecimalPipe, StocktakeReportModal],
  templateUrl: './stocktake-active.html',
  styleUrl: './stocktake-active.css',
})
export class StocktakeActive implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private stocktakeService = inject(StocktakeService);
  private inventoryService = inject(InventoryService);
  private toastService = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);

  Math = Math;
  loading = true;
  session: StocktakeSession | null = null;
  items: StocktakeItem[] = [];
  filteredItems: StocktakeItem[] = [];

  // Filter & Search states
  searchQuery = '';
  selectedCategory = '';
  activeTab: 'all' | 'uncounted' | 'shortage' | 'overage' | 'balanced' = 'all';

  // Pagination state
  currentPage = 1;
  pageSize = 20;
  pageSizeOptions = [10, 20, 50, 100];

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredItems.length / this.pageSize));
  }

  get paginatedItems(): StocktakeItem[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredItems.slice(start, start + this.pageSize);
  }

  get pagesArray(): number[] {
    const total = this.totalPages;
    const current = this.currentPage;
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const pages: number[] = [1];
    if (current > 3) pages.push(-1);
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
      pages.push(i);
    }
    if (current < total - 2) pages.push(-1);
    pages.push(total);
    return pages;
  }

  changePage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      window.scrollTo({ top: 120, behavior: 'smooth' });
    }
  }

  onPageSizeChange(size: any) {
    this.pageSize = Number(size);
    this.currentPage = 1;
  }

  // Calculator modal state
  showCalculatorModal = false;
  calculatorItem: StocktakeItem | null = null;
  calcCartons = 0;
  calcUnitsPerCarton = 12;
  calcLooseUnits = 0;

  // Finalize Reconciliation modal state
  showReconciliationModal = false;
  isSubmittingReconciliation = false;
  finalDeductionAmount = 0;
  deductionResponsible = '';
  reconciliationNotes = '';

  // Report modal state
  showReportModal = false;

  get categories(): string[] {
    const set = new Set<string>();
    this.items.forEach((it) => {
      if (it.category) set.add(it.category);
    });
    return Array.from(set).sort();
  }

  get stats(): StocktakeSummaryStats {
    return this.stocktakeService.computeStats(this.items);
  }

  get progressPercent(): number {
    if (!this.items.length) return 0;
    return Math.round((this.stats.countedItems / this.items.length) * 100);
  }

  get balancedPercent(): number {
    if (!this.items.length) return 0;
    return (this.stats.balancedItems / this.items.length) * 100;
  }

  get shortagePercent(): number {
    if (!this.items.length) return 0;
    return (this.stats.shortageItems / this.items.length) * 100;
  }

  get overagePercent(): number {
    if (!this.items.length) return 0;
    return (this.stats.overageItems / this.items.length) * 100;
  }

  get calculatedTotalUnits(): number {
    return (Number(this.calcCartons) || 0) * (Number(this.calcUnitsPerCarton) || 0) + (Number(this.calcLooseUnits) || 0);
  }

  formatUnit(unit: string | undefined): string {
    if (!unit) return 'units';
    return unit.toLowerCase().endsWith('s') ? unit : `${unit}s`;
  }

  ngOnInit() {
    const sessionId = this.route.snapshot.paramMap.get('id');
    if (!sessionId) {
      this.toastService.error('Invalid stocktake session ID');
      this.router.navigate(['/inventory/stocktake']);
      return;
    }
    this.loadSession(sessionId);
  }

  async loadSession(sessionId: string) {
    this.loading = true;
    try {
      const data = await this.stocktakeService.getSession(sessionId);
      this.session = data.session;
      this.items = data.items;

      // Enrich items with sales_count from live API to ensure POS order (most bought items first)
      try {
        const res: any = this.session.inventory_type === 'retail'
          ? await firstValueFrom(this.inventoryService.getRetailProducts({ paginate: 0, per_page: 9999 }))
          : await firstValueFrom(this.inventoryService.getWholesaleProducts({ paginate: 0, per_page: 9999 }));

        const prods = Array.isArray(res) ? res : (res?.data || []);
        const salesMap = new Map<number, number>();
        prods.forEach((p: any) => salesMap.set(p.id, Number(p.sales_count || 0)));

        this.items.forEach((it) => {
          if (salesMap.has(it.product_id)) {
            it.sales_count = salesMap.get(it.product_id) || 0;
          }
        });
      } catch (err) {
        // Fallback to existing sales_count
      }

      this.applyFilters(false);
    } catch (err: any) {
      this.toastService.error(err.message || 'Failed to load stocktake session');
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  applyFilters(resetPage: boolean = true) {
    if (resetPage) {
      this.currentPage = 1;
    }
    const q = this.searchQuery.trim().toLowerCase();
    const filtered = this.items.filter((item) => {
      // Category filter
      if (this.selectedCategory && item.category !== this.selectedCategory) {
        return false;
      }
      // Tab filter
      if (this.activeTab !== 'all' && item.status !== this.activeTab) {
        return false;
      }
      // Search query
      if (q) {
        const matchName = item.product_name.toLowerCase().includes(q);
        const matchCat = (item.category || '').toLowerCase().includes(q);
        if (!matchName && !matchCat) return false;
      }
      return true;
    });

    // POS Order: most bought items first (highest sales_count desc)
    this.filteredItems = filtered.sort((a, b) => {
      const salesA = a.sales_count || 0;
      const salesB = b.sales_count || 0;
      if (salesB !== salesA) {
        return salesB - salesA;
      }
      return a.product_name.localeCompare(b.product_name);
    });

    this.cdr.detectChanges();
  }

  setTab(tab: 'all' | 'uncounted' | 'shortage' | 'overage' | 'balanced') {
    this.activeTab = tab;
    this.applyFilters(true);
  }

  // --- Physical Count Handlers ---

  async onPhysicalCountChange(item: StocktakeItem, val: any) {
    const parsedVal = val === '' || val === null || val === undefined ? null : Number(val);
    if (parsedVal !== null && isNaN(parsedVal)) return;

    try {
      const updated = await this.stocktakeService.updateItemCount(
        item,
        parsedVal,
        item.discrepancy_reason,
        item.notes,
        item.unit_breakdown,
        item.offset_status,
        item.offset_notes
      );
      this.syncItemLocally(updated);
    } catch (e: any) {
      this.toastService.error(e.message || 'Error updating item count');
    }
  }

  async matchSystemQuantity(item: StocktakeItem) {
    await this.onPhysicalCountChange(item, item.system_quantity);
  }

  async onReasonChange(item: StocktakeItem, reason: DiscrepancyReason | null) {
    try {
      const updated = await this.stocktakeService.updateItemCount(
        item,
        item.physical_quantity ?? null,
        reason,
        item.notes,
        item.unit_breakdown,
        item.offset_status,
        item.offset_notes
      );
      this.syncItemLocally(updated);
    } catch (e: any) {
      this.toastService.error(e.message || 'Failed to update reason');
    }
  }

  async toggleOffsetStatus(item: StocktakeItem, event: any) {
    const isChecked = event.target.checked;
    const offsetStatus: OffsetStatus = isChecked ? 'offset_with_overage' : 'none';
    try {
      const updated = await this.stocktakeService.updateItemCount(
        item,
        item.physical_quantity ?? null,
        item.discrepancy_reason,
        item.notes,
        item.unit_breakdown,
        offsetStatus,
        isChecked ? 'Offset with Overages / Waived by Admin' : null
      );
      this.syncItemLocally(updated);
    } catch (e: any) {
      this.toastService.error(e.message || 'Failed to update offset');
    }
  }

  async onNotesBlur(item: StocktakeItem, event: any) {
    const text = event.target.value;
    if (text === item.notes) return;
    try {
      const updated = await this.stocktakeService.updateItemCount(
        item,
        item.physical_quantity ?? null,
        item.discrepancy_reason,
        text,
        item.unit_breakdown,
        item.offset_status,
        item.offset_notes
      );
      this.syncItemLocally(updated);
    } catch (e: any) {
      this.toastService.error('Failed to save note');
    }
  }

  private syncItemLocally(updated: StocktakeItem) {
    const idx = this.items.findIndex((it) => it.id === updated.id);
    if (idx !== -1) {
      const preservedSalesCount = this.items[idx].sales_count;
      this.items[idx] = { ...updated, sales_count: updated.sales_count ?? preservedSalesCount };
    }
    this.applyFilters(false);
    this.saveSessionTotalsDebounced();
  }

  private saveSessionTotalsDebounced() {
    if (!this.session) return;
    this.stocktakeService.syncSessionTotals(this.session.id, this.items).catch(() => {});
  }

  // --- Box / Carton Multi-Unit Calculator ---

  openCalculator(item: StocktakeItem) {
    this.calculatorItem = item;
    if (item.unit_breakdown) {
      this.calcCartons = item.unit_breakdown.cartons || 0;
      this.calcUnitsPerCarton = item.unit_breakdown.units_per_carton || 12;
      this.calcLooseUnits = item.unit_breakdown.loose_units || 0;
    } else {
      this.calcCartons = 0;
      this.calcUnitsPerCarton = 12;
      this.calcLooseUnits = 0;
    }
    this.showCalculatorModal = true;
  }

  closeCalculator() {
    this.showCalculatorModal = false;
    this.calculatorItem = null;
  }

  async applyCalculatedUnits() {
    if (!this.calculatorItem) return;
    const total = this.calculatedTotalUnits;
    const breakdown: UnitBreakdown = {
      cartons: this.calcCartons,
      units_per_carton: this.calcUnitsPerCarton,
      loose_units: this.calcLooseUnits,
      calculated_total: total,
    };

    try {
      const updated = await this.stocktakeService.updateItemCount(
        this.calculatorItem,
        total,
        this.calculatorItem.discrepancy_reason,
        this.calculatorItem.notes,
        breakdown,
        this.calculatorItem.offset_status,
        this.calculatorItem.offset_notes
      );
      this.syncItemLocally(updated);
      this.closeCalculator();
      this.toastService.success(`Applied ${total} ${this.formatUnit(updated.base_unit)} to ${updated.product_name}`);
    } catch (e: any) {
      this.toastService.error('Failed to apply calculated units');
    }
  }

  // --- Finalize & Reconcile ---

  openReconciliationModal() {
    if (this.stats.uncountedItems > 0) {
      const proceed = confirm(
        `Notice: You still have ${this.stats.uncountedItems} uncounted products. Items left uncounted will NOT have their stock adjusted. Proceed to review?`
      );
      if (!proceed) return;
    }

    this.finalDeductionAmount = this.stats.netDeduction;
    this.deductionResponsible = this.session?.deduction_responsible || '';
    this.reconciliationNotes = this.session?.notes || '';
    this.showReconciliationModal = true;
  }

  closeReconciliationModal() {
    this.showReconciliationModal = false;
  }

  async confirmReconciliation() {
    if (!this.session) return;
    this.isSubmittingReconciliation = true;

    try {
      const updatedSession = await this.stocktakeService.applyReconciliation(this.session, this.items, {
        deduction_amount: this.finalDeductionAmount,
        offset_amount: this.stats.offsetAmount,
        deduction_responsible: this.deductionResponsible,
        deduction_notes: this.reconciliationNotes,
        notes: this.reconciliationNotes,
      });

      this.session = updatedSession;
      this.toastService.success('Stocktake reconciled and live inventory adjusted successfully!');
      this.closeReconciliationModal();
      this.openReport();
    } catch (err: any) {
      this.toastService.error(err.message || 'Failed to complete reconciliation');
    } finally {
      this.isSubmittingReconciliation = false;
      this.cdr.detectChanges();
    }
  }

  // --- Report Modal ---

  openReport() {
    this.showReportModal = true;
  }
}
