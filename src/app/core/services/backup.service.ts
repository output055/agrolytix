import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface TableResult {
  synced: number;
  status: 'ok' | 'failed';
  error?: string;
}

export interface BackupRun {
  id: number;
  status: 'running' | 'completed' | 'failed';
  target: string;
  initiated_by_user_id: number | null;
  started_at: string | null;
  finished_at: string | null;
  records_synced: number;
  tables_synced: Record<string, TableResult> | null;
  error_message: string | null;
}

export interface LatestBackupResponse {
  latest: BackupRun | null;
  last_success: BackupRun | null;
}

export interface RunBackupResponse {
  message: string;
  records_synced: number;
  tables_synced: Record<string, TableResult>;
  backup_run_id: number;
  finished_at: string;
}

@Injectable({ providedIn: 'root' })
export class BackupService {
  private http = inject(HttpClient);
  private api  = `${environment.apiUrl}/backups/supabase`;

  runBackup(): Observable<RunBackupResponse> {
    return this.http.post<RunBackupResponse>(`${this.api}/run`, {});
  }

  getLatest(): Observable<LatestBackupResponse> {
    return this.http.get<LatestBackupResponse>(`${this.api}/latest`);
  }
}
