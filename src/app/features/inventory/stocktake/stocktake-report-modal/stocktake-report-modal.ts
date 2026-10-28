import { Component, Input, Output, EventEmitter, computed } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { StocktakeSession, StocktakeItem } from '../../../../core/models/stocktake.model';

@Component({
  selector: 'app-stocktake-report-modal',
  standalone: true,
  imports: [CommonModule, DecimalPipe, DatePipe],
  templateUrl: './stocktake-report-modal.html',
  styleUrl: './stocktake-report-modal.css',
})
export class StocktakeReportModal {
  @Input() visible = false;
  @Input() session: StocktakeSession | null = null;
  @Input() items: StocktakeItem[] = [];
  @Output() close = new EventEmitter<void>();

  Math = Math;

  get discrepancyItems(): StocktakeItem[] {
    return this.items.filter((it) => it.status === 'shortage' || it.status === 'overage');
  }

  printReport() {
    window.print();
  }
}

