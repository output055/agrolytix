import {
  Component, Input, OnInit, OnChanges, OnDestroy,
  ElementRef, ViewChild, AfterViewInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  Chart, LineController, LineElement, PointElement,
  LinearScale, CategoryScale, Filler, Tooltip, Legend
} from 'chart.js';

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip, Legend);

export interface LineDataset {
  label: string;
  data: number[];
  color?: string;
  fill?: boolean;
}

@Component({
  selector: 'app-line-chart',
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
export class LineChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  @Input() labels: string[]    = [];
  @Input() datasets: LineDataset[] = [];
  @Input() height = '200px';

  private chart?: Chart;
  private readonly COLORS = ['#4ade80', '#f59e0b', '#fb923c', '#60a5fa', '#a78bfa'];

  ngAfterViewInit(): void { this.buildChart(); }

  ngOnChanges(): void {
    if (this.chart) {
      this.chart.data.labels = this.labels;
      this.chart.data.datasets = this.toDatasets();
      this.chart.update('active');
    }
  }

  ngOnDestroy(): void { this.chart?.destroy(); }

  private buildChart(): void {
    if (!this.canvasRef) return;
    this.chart = new Chart(this.canvasRef.nativeElement, {
      type: 'line',
      data: { labels: this.labels, datasets: this.toDatasets() },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: this.datasets.length > 1,
            labels: { color: '#9ca3af', boxWidth: 12, boxHeight: 2, padding: 16, font: { size: 11 } }
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
        },
        scales: {
          x: {
            ticks: { color: '#6b7280', font: { size: 10 }, maxTicksLimit: 8, maxRotation: 0 },
            grid:  { color: 'rgba(255,255,255,0.04)' },
            border: { color: 'rgba(255,255,255,0.06)' }
          },
          y: {
            ticks: { color: '#6b7280', font: { size: 10 }, callback: v => `GH₵${Number(v).toLocaleString()}` },
            grid:  { color: 'rgba(255,255,255,0.04)' },
            border: { color: 'rgba(255,255,255,0.06)', dash: [4,4] }
          }
        },
        elements: { point: { radius: 3, hoverRadius: 5, borderWidth: 2 }, line: { tension: 0.35, borderWidth: 2 } }
      }
    });
  }

  private toDatasets() {
    return this.datasets.map((ds, i) => {
      const color = ds.color ?? this.COLORS[i % this.COLORS.length];
      return {
        label: ds.label,
        data: ds.data,
        borderColor: color,
        backgroundColor: ds.fill !== false ? `${color}18` : 'transparent',
        fill: ds.fill !== false,
        pointBackgroundColor: color,
        pointBorderColor: 'rgba(10,21,10,0.8)',
      };
    });
  }
}
