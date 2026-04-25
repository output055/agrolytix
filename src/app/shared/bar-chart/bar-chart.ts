import {
  Component, Input, OnChanges, OnDestroy,
  ElementRef, ViewChild, AfterViewInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  Chart, BarController, BarElement, CategoryScale,
  LinearScale, Tooltip, Legend
} from 'chart.js';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

@Component({
  selector: 'app-bar-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="relative" [style.height]="height">
      <canvas #canvas></canvas>
      @if (!labels?.length) {
        <div class="absolute inset-0 flex items-center justify-center text-sm" style="color:#6b7280">
          No data for this period
        </div>
      }
    </div>
  `
})
export class BarChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  @Input() labels: string[] = [];
  @Input() data: number[]   = [];
  @Input() color = '#4ade80';
  @Input() label = 'Value';
  @Input() height = '200px';
  @Input() horizontal = false;
  @Input() currency = true;

  private chart?: Chart;

  ngAfterViewInit(): void { this.buildChart(); }

  ngOnChanges(): void {
    if (this.chart) {
      this.chart.data.labels = this.labels;
      (this.chart.data.datasets[0] as any).data = this.data;
      this.chart.update('active');
    }
  }

  ngOnDestroy(): void { this.chart?.destroy(); }

  private buildChart(): void {
    if (!this.canvasRef) return;
    const self = this;
    this.chart = new Chart(this.canvasRef.nativeElement, {
      type: 'bar',
      data: {
        labels: this.labels,
        datasets: [{
          label: this.label,
          data: this.data,
          backgroundColor: `${this.color}28`,
          borderColor: this.color,
          borderWidth: 1.5,
          borderRadius: 6,
          borderSkipped: false,
        }]
      },
      options: {
        indexAxis: this.horizontal ? 'y' : 'x',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(10,21,10,0.95)',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            titleColor: '#f0fdf4',
            bodyColor: '#9ca3af',
            padding: 12,
            cornerRadius: 10,
            callbacks: {
              label: ctx => self.currency
                ? ` GH₵${Number(ctx.raw).toFixed(2)}`
                : ` ${Number(ctx.raw).toLocaleString()}`
            }
          }
        },
        scales: {
          x: {
            ticks: { color: '#6b7280', font: { size: 10 }, maxRotation: 30 },
            grid:  { color: 'rgba(255,255,255,0.04)' },
            border: { color: 'rgba(255,255,255,0.06)' }
          },
          y: {
            ticks: {
              color: '#6b7280', font: { size: 10 },
              callback: v => self.currency ? `GH₵${Number(v).toLocaleString()}` : String(v)
            },
            grid:  { color: 'rgba(255,255,255,0.04)' },
            border: { color: 'rgba(255,255,255,0.06)', dash: [4,4] }
          }
        }
      }
    });
  }
}
