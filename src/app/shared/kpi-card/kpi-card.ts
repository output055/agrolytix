import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-kpi-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="agro-card agro-fade-in rounded-2xl p-5 flex flex-col gap-3 relative overflow-hidden group cursor-default"
         [style.border-color]="'rgba(' + colorRgb + ', 0.15)'"
         [style.transition]="'all 0.2s ease'">

      <!-- Glow blob -->
      <div class="absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-2xl pointer-events-none"
           [style.background]="'rgba(' + colorRgb + ', 0.12)'"></div>

      <!-- Top row: label + icon -->
      <div class="flex items-center justify-between relative z-10">
        <span class="text-[10px] font-bold uppercase tracking-widest" style="color:#6b7280">{{ label }}</span>
        <div class="w-9 h-9 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-110"
             [style.background]="'rgba(' + colorRgb + ', 0.12)'">
          <!-- SVG Icon slot -->
          <ng-content select="[kpi-icon]">
            <!-- Default icon if nothing projected and no string icon -->
            <svg *ngIf="!icon" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" [style.color]="'rgb(' + colorRgb + ')'">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
            </svg>
          </ng-content>
          <!-- Emoji icon fallback -->
          <span *ngIf="icon" class="text-lg leading-none">{{ icon }}</span>
        </div>
      </div>

      <!-- Value -->
      <div class="text-2xl font-black tracking-tight relative z-10" style="color:#f0fdf4">{{ value }}</div>

      <!-- Footer: subtitle + trend -->
      <div class="flex items-center justify-between relative z-10" *ngIf="subtitle || trend !== 'none'">
        <div class="text-xs" style="color:#6b7280">{{ subtitle }}</div>
        <div *ngIf="trend !== 'none'" class="flex items-center gap-1 text-xs font-bold px-1.5 py-0.5 rounded-full"
             [style.color]="trend === 'up' ? '#4ade80' : trend === 'down' ? '#f87171' : '#9ca3af'"
             [style.background]="trend === 'up' ? 'rgba(74,222,128,0.08)' : trend === 'down' ? 'rgba(248,113,113,0.08)' : 'rgba(156,163,175,0.08)'">
          <!-- Arrow up -->
          <svg *ngIf="trend === 'up'" class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 10l7-7m0 0l7 7m-7-7v18"/>
          </svg>
          <!-- Arrow down -->
          <svg *ngIf="trend === 'down'" class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M19 14l-7 7m0 0l-7-7m7 7V3"/>
          </svg>
          <span *ngIf="trendValue">{{ trendValue }}</span>
        </div>
      </div>

      <!-- Bottom accent line -->
      <div class="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
           [style.background]="'linear-gradient(90deg, transparent, rgba(' + colorRgb + ', 0.5), transparent)'"></div>
    </div>
  `
})
export class KpiCard {
  @Input() label      = '';
  @Input() value      = '';
  @Input() icon       = '';
  @Input() subtitle   = '';
  @Input() colorRgb   = '74,222,128';
  @Input() trend: 'up' | 'down' | 'neutral' | 'none' = 'none';
  @Input() trendValue = '';
}
