export type InventoryType = 'retail' | 'wholesale';
export type StocktakeStatus = 'draft' | 'completed' | 'cancelled';
export type ItemCountStatus = 'uncounted' | 'balanced' | 'shortage' | 'overage';
export type DiscrepancyReason = 
  | 'breakage' 
  | 'expired' 
  | 'theft' 
  | 'miscount' 
  | 'unrecorded_sale' 
  | 'swapped_product' 
  | 'other';

export type OffsetStatus = 'none' | 'offset_with_overage' | 'waived' | 'deducted';

export interface UnitBreakdown {
  cartons?: number;
  units_per_carton?: number;
  loose_units?: number;
  calculated_total?: number;
}

export interface StocktakeSession {
  id: string;
  org_id: number;
  business_id: number;
  business_name?: string;
  inventory_type: InventoryType;
  status: StocktakeStatus;
  title: string;
  counted_by_id?: number;
  counted_by_name: string;
  total_products: number;
  counted_products: number;
  balanced_count: number;
  shortage_count: number;
  overage_count: number;
  total_cost_variance: number;
  total_sell_variance: number;
  gross_shortage_value: number;
  gross_overage_value: number;
  offset_amount: number;
  deduction_amount: number;
  deduction_responsible?: string;
  deduction_notes?: string;
  notes?: string;
  started_at: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface StocktakeItem {
  id: string;
  session_id: string;
  product_id: number;
  product_name: string;
  category?: string;
  base_unit: string;
  cost_price: number;
  sell_price: number;
  system_quantity: number;
  physical_quantity?: number | null;
  variance: number;
  cost_variance: number;
  sell_variance: number;
  status: ItemCountStatus;
  discrepancy_reason?: DiscrepancyReason | null;
  offset_status: OffsetStatus;
  offset_notes?: string | null;
  notes?: string | null;
  unit_breakdown?: UnitBreakdown | null;
  sales_count?: number;
  created_at: string;
  updated_at: string;
}

export interface StocktakeSummaryStats {
  totalItems: number;
  countedItems: number;
  uncountedItems: number;
  balancedItems: number;
  shortageItems: number;
  overageItems: number;
  grossShortageCost: number;
  grossShortageSell: number;
  grossOverageCost: number;
  grossOverageSell: number;
  netCostVariance: number;
  netSellVariance: number;
  offsetAmount: number;
  netDeduction: number;
}

