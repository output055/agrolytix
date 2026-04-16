import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReversalService } from '../../../core/services/reversal.service';
import { ToastService } from '../../../core/services/toast.service';
import { Reversal } from '../../../core/models/reversal.model';

@Component({
  selector: 'app-reversals-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reversals-view.html',
  styleUrl: './reversals-view.css'
})
export class ReversalsView implements OnInit {
  private reversalService = inject(ReversalService);
  private toastService = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);

  reversals: Reversal[] = [];
  loading = false;
  selectedReversal: Reversal | null = null;

  ngOnInit() {
    this.loadReversals();
  }

  loadReversals() {
    this.loading = true;
    this.cdr.detectChanges();
    this.reversalService.getReversals().subscribe({
      next: (res) => {
        this.reversals = res;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.toastService.show('Failed to load reversals', 'error');
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  openDetail(reversal: Reversal) {
    this.selectedReversal = reversal;
  }

  closeDetail() {
    this.selectedReversal = null;
  }
}
