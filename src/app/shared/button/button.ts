import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-btn',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      [type]="type"
      [disabled]="disabled || loading"
      (click)="clicked.emit($event)"
      class="agro-btn"
      [class.agro-btn-primary]="variant === 'primary'"
      [class.agro-btn-secondary]="variant === 'secondary'"
      [class.agro-btn-danger]="variant === 'danger'"
      [class.agro-btn-amber]="variant === 'amber'"
      [class.agro-btn-lg]="size === 'lg'"
      [class.agro-btn-sm]="size === 'sm'"
      [class.w-full]="block">
      <!-- Spinner -->
      <svg *ngIf="loading" class="w-4 h-4 shrink-0" style="animation:spin 0.8s linear infinite" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="60" stroke-dashoffset="15" stroke-linecap="round" opacity="0.3"/>
        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
      </svg>
      <ng-content></ng-content>
    </button>
  `
})
export class BtnComponent {
  @Input() variant: 'primary' | 'secondary' | 'danger' | 'amber' = 'primary';
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() loading  = false;
  @Input() disabled = false;
  @Input() block    = false;
  @Input() type: 'button' | 'submit' = 'button';
  @Output() clicked = new EventEmitter<MouseEvent>();
}
