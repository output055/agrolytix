export interface Expense {
  id: number;
  title: string;
  amount: number;
  category: ExpenseCategory;
  note?: string;
  expense_date: string;
  recorded_by: number;
  recorder?: { id: number; name: string };
  created_at?: string;
}

export type ExpenseCategory =
  | 'salary'
  | 'fuel'
  | 'rent'
  | 'utilities'
  | 'maintenance'
  | 'food'
  | 'cleaning'
  | 'other';

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string; emoji: string }[] = [
  { value: 'salary',      label: 'Salary',      emoji: '👷' },
  { value: 'fuel',        label: 'Fuel',         emoji: '⛽' },
  { value: 'rent',        label: 'Rent',         emoji: '🏠' },
  { value: 'utilities',   label: 'Utilities',    emoji: '💡' },
  { value: 'maintenance', label: 'Maintenance',  emoji: '🔧' },
  { value: 'food',        label: 'Food',         emoji: '🥗' },
  { value: 'cleaning',    label: 'Cleaning',     emoji: '🧹' },
  { value: 'other',       label: 'Other',        emoji: '📌' },
];

export interface ExpenseFilter {
  date_from?: string;
  date_to?: string;
  category?: string;
  search?: string;
  worker_id?: number;
}
