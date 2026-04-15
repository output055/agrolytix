export interface CartItem {
  cart_id: string; // unique local id to easily remove from cart
  product_id?: number;
  wholesale_product_id?: number;
  name: string;
  unit_name: string;
  quantity: number;        // The number of units selected
  quantity_base: number;   // Total equivalent in base unit
  unit_price: number;
  cost_price: number;
  is_bulk: boolean;
  max_stock_base: number;  // The total available stock in base unit for this product
  max_stock_unit: number;  // The calculated max stock for this specific unit
}

export interface RetailPosItemPayload {
  product_id: number;
  unit_name: string;
  quantity: number;
  quantity_base: number;
  unit_price: number;
  cost_price: number;
}

export interface RetailPosPayload {
  payment_method: string;
  momo_number?: string;
  items: RetailPosItemPayload[];
}

export interface WholesalePosItemPayload {
  wholesale_product_id: number;
  unit_name: string;
  quantity: number;
  quantity_base: number;
  unit_price: number;
  cost_price: number;
}

export interface WholesalePosPayload {
  client_id: number;
  payment_method: string;
  momo_number?: string;
  amount_paid: number;
  items: WholesalePosItemPayload[];
}
