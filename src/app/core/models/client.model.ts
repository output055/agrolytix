export interface Client {
  id: number;
  name: string;
  contact?: string;
  location?: string;
  email?: string;
  total_debt: number;
  created_at?: string;
  updated_at?: string;
}
