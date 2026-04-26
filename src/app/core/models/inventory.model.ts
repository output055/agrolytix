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

