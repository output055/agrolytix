import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe, DecimalPipe, KeyValuePipe, NgClass } from '@angular/common';
import { BackupService, BackupRun, TableResult } from '../../../core/services/backup.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-sa-backup',
  standalone: true,
  imports: [DatePipe, DecimalPipe, KeyValuePipe, NgClass],
  templateUrl: './sa-backup.html',
})
export class SaBackup implements OnInit {
  private backupService = inject(BackupService);
  private toast         = inject(ToastService);

  latest      = signal<BackupRun | null>(null);
  lastSuccess = signal<BackupRun | null>(null);
  running     = signal(false);
  loadingLatest = signal(true);

  ngOnInit() {
    this.loadLatest();
  }

  loadLatest() {
    this.loadingLatest.set(true);
    this.backupService.getLatest().subscribe({
      next: (res) => {
        this.latest.set(res.latest);
        this.lastSuccess.set(res.last_success);
        this.loadingLatest.set(false);
      },
      error: () => this.loadingLatest.set(false),
    });
  }

  runBackup() {
    if (this.running()) return;
    this.running.set(true);

    this.backupService.runBackup().subscribe({
      next: (res) => {
        this.running.set(false);
        this.toast.success(`Backup complete — ${res.records_synced} records synced.`);
        this.loadLatest();
      },
      error: (err) => {
        this.running.set(false);
        const msg = err?.error?.error ?? 'Backup failed. Check server logs.';
        this.toast.error(msg);
        this.loadLatest();
      },
    });
  }

  tableEntries(tables: Record<string, TableResult> | null): { key: string; value: TableResult }[] {
    if (!tables) return [];
    return Object.entries(tables).map(([key, value]) => ({ key, value }));
  }

  statusColor(status: string): string {
    return status === 'completed' ? '#4ade80'
         : status === 'failed'    ? '#f87171'
         : '#f59e0b';
  }

  statusBg(status: string): string {
    return status === 'completed' ? 'rgba(74,222,128,0.08)'
         : status === 'failed'    ? 'rgba(239,68,68,0.08)'
         : 'rgba(245,158,11,0.08)';
  }

  statusBorder(status: string): string {
    return status === 'completed' ? 'rgba(74,222,128,0.2)'
         : status === 'failed'    ? 'rgba(239,68,68,0.2)'
         : 'rgba(245,158,11,0.2)';
  }

  durationSeconds(run: BackupRun): string {
    if (!run.started_at || !run.finished_at) return '—';
    const diff = (new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()) / 1000;
    return `${diff.toFixed(1)}s`;
  }
}
