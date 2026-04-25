import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-skeleton',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-3" [style.width]="width">
      @for (_ of rowArray; track $index) {
        <div class="skeleton rounded-lg"
             [style.height]="height"
             [style.opacity]="1 - ($index * 0.15)"></div>
      }
    </div>
  `
})
export class SkeletonComponent {
  @Input() rows   = 3;
  @Input() height = '1.25rem';
  @Input() width  = '100%';
  get rowArray(): number[] { return Array.from({ length: this.rows }); }
}
