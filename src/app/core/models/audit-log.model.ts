export interface AuditLog {
  id: number;
  user_id: number | null;
  action_type: string;
  entity_type: string | null;
  entity_id: number | null;
  status: 'success' | 'failure';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  ip_address: string | null;
  user_agent: string | null;
  metadata: any | null;
  created_at: string;
  updated_at: string;
  user?: {
    id: number;
    name: string;
    email: string;
  };
}

export interface AuditLogResponse {
  data: AuditLog[];
  current_page: number;
  last_page: number;
  total: number;
  per_page: number;
}
