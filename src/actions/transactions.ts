'use server';

import { supabase } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';
import { createClient } from '@supabase/supabase-js';


export type CategoryBudget = {
  id: string;
  name: string;
  group_name: string;
  budget_limit: number;
  spent: number;
};

export type AddTransactionInput = {
  category_id: string;
  amount: number;
  date: string;
  user_name: string;
  notes?: string;
};

/**
 * Add a new expense/income transaction
 */

type NewTransaction = {
  category_id: string;
  amount: number;
  date: string;
  user_name: string;
  notes?: string;
};

export async function addTransaction(data: NewTransaction) {
  // 1. Get current logged in auth user
  const { data: authData } = await supabase.auth.getUser();

  const { error } = await supabase.from('transactions').insert({
    category_id: data.category_id,
    amount: data.amount,
    date: data.date,
    user_name: data.user_name,
    notes: data.notes,
    user_id: authData?.user?.id || null, // Connect to Supabase Auth Account
  });

  if (error) {
    console.error('❌ Failed to add transaction:', error.message);
    throw new Error(error.message);
  }

  revalidatePath('/add');
  revalidatePath('/history');
  revalidatePath('/');
}

/**
 * Fetch all categories
 */
export async function getCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('group_name', { ascending: true });

  if (error) {
    console.error('Error fetching categories:', error);
    return [];
  }

  return data || [];
}

/**
 * Fetch recent transactions
 */
export type TransactionItem = {
  id: string;
  amount: number;
  date: string;
  user_name: 'ספיר' | 'עמליה';
  notes?: string;
  category: {
    id: string;
    name: string;
    group_name: string;
    type: string;
  } | null;
};

/**
 * Fetch recent transactions with normalized category objects
 */
export async function getRecentTransactions(limit = 5): Promise<TransactionItem[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select(`
      id,
      amount,
      date,
      user_name,
      notes,
      category:categories ( id, name, group_name, type )
    `)
    .order('date', { ascending: false })
    .limit(limit);

  if (error || !data) {
    console.error('Error fetching recent transactions:', error);
    return [];
  }

  // Normalize category if Supabase infers it as an array
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.map((tx: any) => ({
    id: tx.id,
    amount: tx.amount,
    date: tx.date,
    user_name: tx.user_name,
    notes: tx.notes,
    category: Array.isArray(tx.category) ? tx.category[0] || null : tx.category,
  }));
}

/**
 * Get monthly total income & total spent summary for the dashboard
 */
type DashboardTransaction = {
  amount: number;
  category: {
    type: string;
  } | null;
};

/**
 * Get monthly total income & total spent summary for the dashboard
 */
export async function getDashboardSummary(monthYearStr: string) {
  const startDate = `${monthYearStr}-01`;
  const endDate = `${monthYearStr}-31`;

  const { data: transactions, error } = await supabase
    .from('transactions')
    .select(`
      amount,
      category:categories ( type )
    `)
    .gte('date', startDate)
    .lte('date', endDate);

  if (error || !transactions) {
    return { totalIncome: 0, totalSpent: 0, monthlyCashFlow: 0 };
  }

  let totalIncome = 0;
  let totalSpent = 0;

  const typedTransactions = transactions as unknown as DashboardTransaction[];

  typedTransactions.forEach((tx) => {
    const amount = Number(tx.amount) || 0;
    if (tx.category?.type === 'income') {
      totalIncome += amount;
    } else {
      totalSpent += amount;
    }
  });

  return {
    totalIncome,
    totalSpent,
    monthlyCashFlow: totalIncome - totalSpent,
  };
}

/**
 * Get monthly total income & total spent summary for the dashboard
 */
/**
 * Fetch category summaries (Budget vs. Spent) for the quick-add screen
 */
export async function getCategoryCardSummaries(monthYearStr: string) {
  const startDate = `${monthYearStr}-01`;
  const endDate = `${monthYearStr}-31`;

  // 1. Fetch all categories
  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .order('group_name', { ascending: true });

  // 2. Fetch transactions for the current month
  const { data: transactions } = await supabase
    .from('transactions')
    .select('amount, category_id')
    .gte('date', startDate)
    .lte('date', endDate);

  // 3. Fetch monthly planned budgets
  const { data: budgets } = await supabase
    .from('monthly_budgets')
    .select('category_id, planned_amount')
    .eq('month', startDate);

  // Calculate total spent per category
  const spentMap: Record<string, number> = {};
  transactions?.forEach((tx) => {
    const amount = Number(tx.amount) || 0;
    spentMap[tx.category_id] = (spentMap[tx.category_id] || 0) + amount;
  });

  // Map planned budgets per category
  const budgetMap: Record<string, number> = {};
  budgets?.forEach((b) => {
    budgetMap[b.category_id] = Number(b.planned_amount) || 0;
  });

  // Combine the data
  return (categories || []).map((cat) => ({
    id: cat.id,
    name: cat.name,
    group_name: cat.group_name,
    type: cat.type,
    spent: spentMap[cat.id] || 0,
    budget: budgetMap[cat.id] ?? cat.default_budget ?? 0,
  }));
}
/**
 * Get budget vs spent totals categorized per user or for all family members
 */
export async function getBudgetSummary(monthYearStr: string, userName?: string) {
  const startDate = `${monthYearStr}-01`;
  const endDate = `${monthYearStr}-31`;

  const { data: categories, error: catError } = await supabase
    .from('categories')
    .select('id, name, group_name, budget_limit, type')
    .neq('type', 'income');

  if (catError || !categories) {
    return { totalBudget: 0, totalSpent: 0, categoriesBudget: [] };
  }

  let query = supabase
    .from('transactions')
    .select('amount, category_id')
    .gte('date', startDate)
    .lte('date', endDate);

  if (userName && userName !== 'all') {
    query = query.eq('user_name', userName);
  }

  const { data: transactions, error: txError } = await query;

  const spentByCat: Record<string, number> = {};
  let totalSpent = 0;

  if (transactions && !txError) {
    transactions.forEach((tx) => {
      const amt = Number(tx.amount) || 0;
      spentByCat[tx.category_id] = (spentByCat[tx.category_id] || 0) + amt;
      totalSpent += amt;
    });
  }

  const categoriesBudget: CategoryBudget[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    group_name: c.group_name,
    budget_limit: Number(c.budget_limit) || 1500,
    spent: spentByCat[c.id] || 0,
  }));

  const totalBudget = categoriesBudget.reduce((acc, curr) => acc + curr.budget_limit, 0);

  return { totalBudget, totalSpent, categoriesBudget };
}