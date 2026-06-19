export interface ProductUnit {
  id?: number;
  product_id?: number;
  wholesale_product_id?: number;
  unit_name: string;
  quantity_in_base: number;
  price: number;
  is_bulk: boolean;
  bulk_discount_pct: number;
  created_at?: string;
  updated_at?: string;
}

export interface Product {
  id: number;
  name: string;
  category: string;
  description: string;
  cost_price: number;
  sell_price: number;
  quantity: number;
  base_unit: string;
  low_stock_alert: number;
  sales_count?: number;
  last_added_qty?: number;
  units?: ProductUnit[];
  created_at?: string;
  updated_at?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  current_page: number;
  last_page: number;
  per_page: number;
  stats?: {
    total_cost_value: number;
    total_selling_value: number;
    low_stock_count: number;
  };
}

// Wholesale product essentially shares the exact same schema.
export interface WholesaleProduct extends Product {}

export interface EligibleBusiness {
  id: number;
  name: string;
}

export interface StockTransferPayload {
  from_type: 'retail' | 'wholesale';
  from_product_id: number;
  source_unit_id?: number | null;
  source_unit_name?: string;
  source_unit_quantity_in_base?: number;
  to_type: 'retail' | 'wholesale';
  to_product_id: number | null;  // null = auto-create on destination
  to_business_id?: number | null; // null = same business (internal)
  quantity: number;
  note?: string;
}

export interface StockTransfer {
  id: number;
  from_type: 'retail' | 'wholesale';
  from_product_id: number;
  from_product_name: string;
  source_unit_id?: number | null;
  source_unit_name?: string | null;
  source_unit_quantity_in_base?: number;
  source_base_unit?: string | null;
  to_type: 'retail' | 'wholesale';
  to_product_id: number;
  to_product_name: string;
  to_business_id?: number | null;
  to_business?: { id: number; name: string } | null;
  business?: { id: number; name: string } | null;
  auto_created: boolean;
  display_quantity?: number | null;
  quantity: number;
  note?: string;
  transferred_by: number;
  transferred_by_user?: { id: number; name: string };
  created_at: string;
}
