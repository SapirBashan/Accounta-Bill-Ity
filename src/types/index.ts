export type CategoryType = 'fixed_expense' | 'variable_expense' | 'income';

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  group_name: string;
  default_budget: number;
  created_at?: string;
}

export interface Transaction {
  id: string;
  category_id: string;
  amount: number;
  date: string;
  user_name: 'ספיר' | 'עמליה' | string;
  notes?: string;
  created_at?: string;
  category?: Category;
}

export interface MonthlyBudget {
  id: string;
  category_id: string;
  month_year: string; // 'YYYY-MM-01'
  budgeted_amount: number;
}

export interface MonthlySummaryItem {
  month_year: string;
  category_id: string;
  category_name: string;
  category_type: CategoryType;
  group_name: string;
  budgeted_amount: number;
  actual_amount: number;
  balance: number;
}

export interface DashboardSummary {
  totalIncome: number;
  totalFixedExpenses: number;
  totalVariableExpenses: number;
  totalSpent: number;
  budgetedExpenses: number;
  monthlyCashFlow: number;
}