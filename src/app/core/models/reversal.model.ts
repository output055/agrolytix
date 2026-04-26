export interface ReversedItem {
  item_id: number;
  product_id: number;
  product_name: string;
  unit_name: string;
  quantity: number;
  quantity_base: number;
  unit_price: number;
  cost_price: number;
  subtotal: number;
}

export interface Reversal {
  id: number;
  retail_sale_id: number;
  user_id: number;
  reason: string | null;
  reversed_items: ReversedItem[] | null;
  amount_reversed: number;
  cost_reversed: number;
  is_partial: boolean;
  created_at: string;
  updated_at: string;
  sale?: {
    id: number;
    receipt_number: string;
    total_amount: number;
    total_cost: number;
    profit: number;
    payment_method: string;
    status: string;
    created_at: string;
    items: {
      id: number;
      product_name: string;
      unit_name: string;
      quantity: number;
      quantity_base: number;
      unit_price: number;
      cost_price: number;
      subtotal: number;
    }[];
  };
  reversed_by?: {
    id: number;
    name: string;
  };
}
