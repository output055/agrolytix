import {
  Component, Input, OnChanges, OnDestroy,
  ElementRef, ViewChild, AfterViewInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, DoughnutController, ArcElement, Tooltip, Legend } from 'chart.js';

Chart.register(DoughnutController, ArcElement, Tooltip, Legend);

@Component({
  selector: 'app-donut-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="relative flex items-center justify-center" [style.height]="height">
      <canvas #canvas></canvas>
      @if (!labels?.length) {
        <div class="absolute inset-0 flex items-center justify-center text-sm" style="color:#6b7280">
          No data
        </div>
      }
    </div>
  `
})
export class DonutChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  @Input() labels: string[] = [];
  @Input() data: number[]   = [];
  @Input() height = '220px';

  private chart?: Chart;
  private readonly COLORS = ['#4ade80','#f59e0b','#60a5fa','#f87171','#a78bfa','#34d399','#fb923c','#e879f9'];

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
    this.chart = new Chart(this.canvasRef.nativeElement, {
      type: 'doughnut',
      data: {
        labels: this.labels,
        datasets: [{
          data: this.data,
          backgroundColor: this.COLORS.map(c => `${c}22`),
          borderColor: this.COLORS,
          borderWidth: 2,
          hoverBackgroundColor: this.COLORS.map(c => `${c}44`),
          hoverBorderWidth: 3,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: '#9ca3af',
              padding: 14,
              font: { size: 11 },
              boxWidth: 10, boxHeight: 10,
              generateLabels: chart => {
                const ds = chart.data.datasets[0] as any;
                const total = (ds.data as number[]).reduce((a: number, b: number) => a + b, 0) || 1;
                return (chart.data.labels as string[]).map((l, i) => ({
                  text: `${l} (${Math.round((ds.data[i] as number) / total * 100)}%)`,
                  fillStyle: (this.COLORS[i % this.COLORS.length]) + '33',
                  strokeStyle: this.COLORS[i % this.COLORS.length],
                  lineWidth: 2,
                  index: i,
                  hidden: false,
                }));
              }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(10,21,10,0.95)',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            titleColor: '#f0fdf4',
            bodyColor: '#9ca3af',
            padding: 12,
            cornerRadius: 10,
            callbacks: { label: ctx => ` GH₵${Number(ctx.raw).toFixed(2)}` }
          }
        }
      }
    });
  }
}
