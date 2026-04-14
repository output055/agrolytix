import { Component, inject } from '@angular/core';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [],
  template: `
    <div class="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
      @for (toast of toastService.toasts(); track toast.id) {
        <div class="flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl pointer-events-auto
                    border transition-all duration-300 min-w-72 max-w-sm"
             [style.background]="bgFor(toast.type)"
             style="border-color: rgba(255,255,255,0.1); backdrop-filter: blur(12px);">
          <span class="text-lg">{{ iconFor(toast.type) }}</span>
          <span class="text-sm font-medium flex-1" style="color: #f0fdf4;">{{ toast.message }}</span>
          <button (click)="toastService.dismiss(toast.id)" class="ml-2 opacity-60 hover:opacity-100 transition-opacity" style="color: #f0fdf4;">✕</button>
        </div>
      }
    </div>
  `,
})
export class Toast {
  toastService = inject(ToastService);

  bgFor(type: string) {
    const map: Record<string, string> = {
      success: 'rgba(22,163,74,0.85)',
      error:   'rgba(220,38,38,0.85)',
      warning: 'rgba(245,158,11,0.85)',
      info:    'rgba(59,130,246,0.85)',
    };
    return map[type] ?? map['info'];
  }

  iconFor(type: string) {
    const map: Record<string, string> = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    return map[type] ?? 'ℹ️';
  }
}
