export type ChatMessageKind =
  | 'text'
  | 'image'
  | 'cash_declaration'
  | 'recon_result'
  | 'recon_status'
  | 'system'
  | 'stock_intake';

export interface StockIntakeItem {
  id?: number;
  name: string;
  inventory_type: 'retail' | 'wholesale';
  is_new_product: boolean;
  category?: string;
  quantity: number;
  base_unit?: string;
  cost_price?: number;
  sell_price?: number;
  previous_cost_price?: number;
  previous_sell_price?: number;
  current_stock?: number;
  new_stock?: number;
  search_query?: string;
  dropdown_open?: boolean;
  show_price_inputs?: boolean;
}

export interface ChatMessageMeta {
  declaration_id?: string;
  declared?: number;
  status?: 'balanced' | 'short' | 'over' | 'flagged' | 'pending' | 'approved' | 'rejected';
  difference?: number;
  tolerance?: number;
  attempt?: number;
  business_id?: number;
  business_name?: string;
  business_date?: string;
  submitted_by?: string;
  submitted_by_id?: number;
  source?: string;
  reply_to_id?: string;
  reply_to_sender?: string;
  reply_to_body?: string;
  // Stock Intake fields
  supplier_name?: string;
  waybill_number?: string;
  note?: string;
  items?: StockIntakeItem[];
  approved_by_name?: string;
  approved_at?: string;
  rejected_by_name?: string;
  rejected_at?: string;
  rejection_reason?: string;
  total_items_count?: number;
  total_quantity?: number;
}

export interface ChatMessage {
  id: string;
  org_id: number;
  room: string;
  sender_user_id: number | null;
  sender_name: string;
  sender_business_id: number | null;
  sender_business_name: string | null;
  sender_role: string | null;
  kind: ChatMessageKind;
  body: string | null;
  image_url: string | null;
  meta: ChatMessageMeta;
  created_at: string;
  is_edited?: boolean;
  edited_at?: string | null;
  is_deleted?: boolean;
  deleted_by_name?: string | null;
  deleted_at?: string | null;
}

export interface CashDeclaration {
  id: string;
  org_id: number;
  business_id: number;
  business_name: string | null;
  user_id: number;
  user_name: string | null;
  business_date: string;
  declared: number;
  expected: number;
  retail_revenue: number;
  wholesale_collected: number;
  expenses: number;
  difference: number;
  tolerance: number;
  status: 'balanced' | 'short' | 'over';
  attempt: number;
  source: string;
  note: string | null;
  image_url: string | null;
  created_at: string;
}

export interface ChatBusiness {
  business_id: number;
  org_id: number;
  name: string;
  is_hq: boolean;
  updated_at: string;
}

export interface ChatRoomMeta {
  id: string;
  title: string;
  subtitle?: string;
  type: 'general' | 'recon' | 'dm';
  business_id?: number;
  unreadCount?: number;
  lastMessage?: string;
  lastTimestamp?: string;
  status?: 'balanced' | 'short' | 'over' | 'pending';
}

export interface ChatTokenProfile {
  userId: number;
  name: string;
  role: string;
  businessId: number;
  businessName: string;
  orgId: number;
  isHq: boolean;
  isHqAdmin: boolean;
}

export interface ChatTokenResponse {
  token: string;
  expires_at: number;
  profile: ChatTokenProfile;
  cloudinary_cloud?: string;
}

export interface DeclareCashPayload {
  amount: number;
  business_date?: string;
  note?: string;
  image_url?: string;
}

export interface ChatSmsSettings {
  org_id: number;
  arkesel_api_key?: string | null;
  sender_id?: string | null;
  enabled: boolean;
  alert_stock_intake: boolean;
  alert_cash_declaration: boolean;
  alert_cash_balanced: boolean;
  alert_cash_imbalance: boolean;
  alert_price_change: boolean;
  alert_missing_cash: boolean;
  alert_daily_summary: boolean;
  alert_low_balance: boolean;
  low_balance_threshold: number;
  last_low_balance_alert_at?: string | null;
}

export interface ChatSmsLog {
  id: string;
  org_id: number;
  event_type: string;
  recipients: string[];
  message: string;
  status: 'success' | 'failed' | 'skipped';
  response?: any;
  error_message?: string | null;
  created_at: string;
}

