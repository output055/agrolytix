import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { StocktakeService } from '../../../../core/services/stocktake.service';
import { ToastService } from '../../../../core/services/toast.service';
import {
  StocktakeSession,
  StocktakeItem,
  InventoryType,
} from '../../../../core/models/stocktake.model';
import { StocktakeReportModal } from '../stocktake-report-modal/stocktake-report-modal';
import { ConfirmModal } from '../../../../shared/confirm-modal/confirm-modal';

@Component({
  selector: 'app-stocktake-view',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DecimalPipe, DatePipe, StocktakeReportModal, ConfirmModal],
  templateUrl: './stocktake-view.html',
  styleUrl: './stocktake-view.css',
})
export class StocktakeView implements OnInit {
  private stocktakeService = inject(StocktakeService);
  private toastService = inject(ToastService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  loading = true;
  sessions: StocktakeSession[] = [];
  filterType: 'all' | 'retail' | 'wholesale' = 'all';

  // Active drafts
  activeRetailDraft: { session: StocktakeSession; items: StocktakeItem[] } | null = null;
  activeWholesaleDraft: { session: StocktakeSession; items: StocktakeItem[] } | null = null;

  // New stocktake modal state
  showStartModal = false;
  newStocktakeType: InventoryType = 'retail';
  newStocktakeTitle = '';
  isStarting = false;

  // Report modal state
  showReportModal = false;
  selectedReportSession: StocktakeSession | null = null;
  selectedReportItems: StocktakeItem[] = [];

  // Delete modal state
  showDeleteModal = false;
  sessionToDelete: StocktakeSession | null = null;

  get filteredSessions(): StocktakeSession[] {
    if (this.filterType === 'all') return this.sessions;
    return this.sessions.filter((s) => s.inventory_type === this.filterType);
  }

  ngOnInit() {
    this.loadData();
  }

  async loadData() {
    this.loading = true;
    try {
      const [allSessions, retailDraft, wholesaleDraft] = await Promise.all([
        this.stocktakeService.getSessions(),
        this.stocktakeService.getActiveSession('retail'),
        this.stocktakeService.getActiveSession('wholesale'),
      ]);

      this.sessions = allSessions;
      this.activeRetailDraft = retailDraft;
      this.activeWholesaleDraft = wholesaleDraft;
    } catch (err: any) {
      this.toastService.error(err.message || 'Failed to load stocktake history');
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  openStartModal(type: InventoryType) {
    // Check if there is already an active draft for this type
    if (type === 'retail' && this.activeRetailDraft) {
      this.toastService.info('A retail stocktake is already in progress. Resuming session.');
      this.router.navigate(['/inventory/stocktake', this.activeRetailDraft.session.id]);
      return;
    }
    if (type === 'wholesale' && this.activeWholesaleDraft) {
      this.toastService.info('A wholesale stocktake is already in progress. Resuming session.');
      this.router.navigate(['/inventory/stocktake', this.activeWholesaleDraft.session.id]);
      return;
    }

    this.newStocktakeType = type;
    const dateStr = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(new Date());
    this.newStocktakeTitle = `${dateStr} ${type === 'retail' ? 'Retail' : 'Wholesale'} Stocktake`;
    this.showStartModal = true;
  }

  closeStartModal() {
    this.showStartModal = false;
  }

  async startStocktake() {
    if (!this.newStocktakeTitle.trim()) {
      this.toastService.warning('Please enter a session title');
      return;
    }

    this.isStarting = true;
    try {
      const result = await this.stocktakeService.createSession(
        this.newStocktakeType,
        this.newStocktakeTitle
      );
      this.toastService.success(`Snapshot created with ${result.items.length} products`);
      this.closeStartModal();
      this.router.navigate(['/inventory/stocktake', result.session.id]);
    } catch (err: any) {
      this.toastService.error(err.message || 'Failed to start stocktake');
    } finally {
      this.isStarting = false;
      this.cdr.detectChanges();
    }
  }

  async viewReport(session: StocktakeSession) {
    this.selectedReportSession = session;
    try {
      this.selectedReportItems = await this.stocktakeService.getSessionItems(session.id);
      this.showReportModal = true;
    } catch (e: any) {
      this.toastService.error('Failed to load audit items');
    }
  }

  promptDeleteSession(session: StocktakeSession) {
    this.sessionToDelete = session;
    this.showDeleteModal = true;
  }

  async confirmDeleteSession() {
    if (!this.sessionToDelete) return;
    try {
      await this.stocktakeService.deleteSession(this.sessionToDelete.id);
      this.toastService.success('Stocktake record deleted');
      this.showDeleteModal = false;
      this.sessionToDelete = null;
      this.loadData();
    } catch (e: any) {
      this.toastService.error(e.message || 'Failed to delete session');
    }
  }
}

