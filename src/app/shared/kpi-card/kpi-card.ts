import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-kpi-card',
  standalone: true,
  template: `
    <div class="rounded-2xl p-5 border flex flex-col gap-3 transition-all duration-200 hover:scale-[1.01]"
         style="background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.08);">
      <div class="flex items-center justify-between">
        <span class="text-[11px] font-bold uppercase tracking-widest" style="color: #6b7280;">{{ label }}</span>
        <div class="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
             [style.background]="'rgba(' + colorRgb + ', 0.15)'">
          {{ icon }}
        </div>
      </div>
      <div class="text-2xl font-bold" style="color: #f0fdf4;">{{ value }}</div>
      @if (subtitle) {
        <div class="text-xs" style="color: #6b7280;">{{ subtitle }}</div>
      }
    </div>
  `
})
export class KpiCard {
  @Input() label    = '';
  @Input() value    = '';
  @Input() icon     = '';
  @Input() subtitle = '';
  @Input() colorRgb = '74,222,128'; // green by default
}
