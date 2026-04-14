import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  template: `
    @if (visible) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div class="rounded-2xl p-6 w-full max-w-sm border shadow-2xl"
             style="background: #111d11; border-color: rgba(255,255,255,0.1);">
          <h3 class="text-lg font-bold mb-2" style="color: #f0fdf4;">{{ title }}</h3>
          <p class="text-sm mb-6" style="color: #9ca3af;">{{ message }}</p>
          <div class="flex gap-3 justify-end">
            <button (click)="cancel.emit()"
                    class="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                    style="background: rgba(255,255,255,0.07); color: #9ca3af;">
              Cancel
            </button>
            <button (click)="confirm.emit()"
                    class="px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
                    style="background: #dc2626; color: #fff;">
              {{ confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class ConfirmModal {
  @Input() visible      = false;
  @Input() title        = 'Are you sure?';
  @Input() message      = 'This action cannot be undone.';
  @Input() confirmLabel = 'Delete';
  @Output() confirm = new EventEmitter<void>();
  @Output() cancel  = new EventEmitter<void>();
}
