export interface SaleItem {
  id: number;
  product_name: string;
  unit_name: string;
  quantity: number;
  quantity_base: number;
  unit_price: number;
  cost_price: number;
  subtotal: number;
}

export interface RetailSale {
  id: number;
  receipt_number: string;
  total_amount: number;
  total_cost: number;
  profit: number;
  payment_method: string;
  momo_number?: string;
  status: string;
  created_at: string;
  items: SaleItem[];
  worker?: { id: number; name: string };
  reversal?: { id: number; reason: string; created_at: string } | null;
}

export interface WholesaleSale {
  id: number;
  receipt_number: string;
  total_amount: number;
  total_cost: number;
  profit: number;
  payment_method: string;
  momo_number?: string;
  amount_paid: number;
  debt: number;
  status: string;
  created_at: string;
  items: SaleItem[];
  client?: { id: number; name: string; phone?: string };
  worker?: { id: number; name: string };
  debtPayments?: DebtPayment[];
}

export interface DebtPayment {
  id: number;
  amount_paid: number;
  old_debt: number;
  new_debt: number;
  note?: string;
  created_at: string;
}

export interface SalesMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface RetailSummary {
  total_transactions: number;
  total_revenue: number;
  total_cost: number;
  total_profit: number;
}

export interface WholesaleSummary {
  total_transactions: number;
  total_revenue: number;
  total_cost: number;
  total_profit: number;
  total_outstanding_debt: number;
  total_collected: number;
}

export interface SalesFilter {
  preset: 'today' | 'yesterday' | 'this_week' | 'this_month' | 'this_year' | 'custom' | '';
  date_from?: string;
  date_to?: string;
  payment_method?: string;
  status?: string;
  worker_id?: number | null;
  client_id?: number | null;
}
