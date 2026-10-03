export type TxType = "expense" | "income";
export type Frequency = "daily" | "weekly" | "monthly" | "yearly";

export interface Category {
  id: string;
  name: string;
  type: TxType;
  color: string;
  icon: string;
  archived: boolean;
  sort_order: number;
  created_at: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface Transaction {
  id: string;
  type: TxType;
  amount: number;
  category_id: string | null;
  payment_method_id: string | null;
  date: string; // yyyy-MM-dd
  time: string; // HH:mm:ss
  note: string;
  tags: string[];
  recurring_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DayNote {
  date: string;
  note: string;
  updated_at: string;
}

export interface Budget {
  id: string;
  category_id: string | null; // null = overall
  amount: number;
  created_at: string;
}

export interface RecurringTransaction {
  id: string;
  type: TxType;
  amount: number;
  category_id: string | null;
  payment_method_id: string | null;
  note: string;
  tags: string[];
  frequency: Frequency;
  start_date: string;
  end_date: string | null;
  last_generated_date: string | null;
  active: boolean;
  created_at: string;
}

export interface Settings {
  id: number;
  currency: string;
  week_start: 0 | 1;
  updated_at: string;
}

export type TransactionInput = Omit<
  Transaction,
  "id" | "created_at" | "updated_at" | "recurring_id"
> & { recurring_id?: string | null };

export interface TxFilters {
  search: string;
  from: string;
  to: string;
  categoryId: string;
  paymentMethodId: string;
  tag: string;
  type: "" | TxType;
  min: string;
  max: string;
}

export const EMPTY_FILTERS: TxFilters = {
  search: "",
  from: "",
  to: "",
  categoryId: "",
  paymentMethodId: "",
  tag: "",
  type: "",
  min: "",
  max: "",
};
