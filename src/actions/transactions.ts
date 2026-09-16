'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseServer } from '@/lib/supabase-server';
import { getUserCategories } from '@/lib/category-data';
import { getHouseholdOwnerId } from '@/lib/household';

function getMonthDateRange(monthYearStr: string) {
  const [year, month] = monthYearStr.split('-').map(Number);
  const nextMonth = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);

  return {
    startDate: `${monthYearStr}-01`,
    nextMonth,
  };
}

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
  const supabase = await getSupabaseServer();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    throw new Error('חובה להתחבר למערכת כדי להוסיף תנועה');
  }
  const ownerId = await getHouseholdOwnerId(supabase, authData.user.id);

  const { error } = await supabase.from('transactions').insert({
    category_id: data.category_id,
    amount: data.amount,
    date: data.date,
    user_name: data.user_name,
    notes: data.notes,
    user_id: ownerId,
  });

  if (error) {
    console.error('❌ Failed to add transaction:', error.message);
    throw new Error(error.message);
  }

  revalidatePath('/add');
  revalidatePath('/history');
  revalidatePath('/', 'layout');
}

export async function addIncome(categoryId: string, amount: number, date: string, notes?: string) {
  const supabase = await getSupabaseServer();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error('חובה להתחבר למערכת כדי להוסיף הכנסה');
  const ownerId = await getHouseholdOwnerId(supabase, authData.user.id);

  const { error } = await supabase.from('transactions').insert({
    category_id: categoryId,
    amount,
    date,
    user_name: authData.user.email?.split('@')[0] || 'משתמש',
    notes: notes || 'הכנסה',
    user_id: ownerId,
  });
  if (error) throw new Error(error.message);

  revalidatePath('/budget');
  revalidatePath('/income');
  revalidatePath('/');
  revalidatePath('/history');
}

export async function getIncomePageData(monthYearStr: string) {
  const supabase = await getSupabaseServer();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return { categories: [], transactions: [] };
  const ownerId = await getHouseholdOwnerId(supabase, authData.user.id);

  const allCategories = await getUserCategories(supabase, ownerId);
  const categories = allCategories.filter(
    (category) => category.active && category.type === 'income',
  );
  const incomeCategoryIds = allCategories
    .filter((category) => category.type === 'income')
    .map((category) => category.id);
  const { startDate, nextMonth } = getMonthDateRange(monthYearStr);
  if (incomeCategoryIds.length === 0) return { categories, transactions: [] };

  const { data: transactions } = await supabase
      .from('transactions')
      .select('id, category_id, amount, date, user_name, notes')
      .eq('user_id', ownerId)
      .in('category_id', incomeCategoryIds)
      .gte('date', startDate)
      .lt('date', nextMonth)
      .order('date', { ascending: false });

  const categoryMap = new Map(allCategories.map((category) => [category.id, category]));

  return {
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      group_name: category.group_name,
    })),
    transactions: (transactions || []).map((transaction) => ({
      ...transaction,
      category_name: categoryMap.get(transaction.category_id)?.name || 'הכנסה',
    })),
  };
}

/**
 * Fetch all categories
 */
export async function getCategories() {
  const supabase = await getSupabaseServer();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return [];
  const ownerId = await getHouseholdOwnerId(supabase, authData.user.id);
  return getUserCategories(supabase, ownerId);
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
export async function getRecentTransactions(limit = 5, monthYearStr?: string): Promise<TransactionItem[]> {
  const supabase = await getSupabaseServer();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return [];
  const ownerId = await getHouseholdOwnerId(supabase, authData.user.id);
  let query = supabase
    .from('transactions')
    .select(`
      id,
      amount,
      date,
      user_name,
      notes,
      category:categories ( id, name, group_name, type )
    `)
    .eq('user_id', ownerId)
    .order('date', { ascending: false });

  if (monthYearStr) {
    const { startDate, nextMonth } = getMonthDateRange(monthYearStr);
    query = query
      .gte('date', startDate)
      .lt('date', nextMonth);
  }

  const { data, error } = await query.limit(limit);

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
  const supabase = await getSupabaseServer();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return { totalIncome: 0, totalSpent: 0, monthlyCashFlow: 0 };
  const ownerId = await getHouseholdOwnerId(supabase, authData.user.id);
  const { startDate, nextMonth } = getMonthDateRange(monthYearStr);

  const { data: transactions, error } = await supabase
    .from('transactions')
    .select(`
      amount,
      category:categories ( type )
    `)
    .eq('user_id', ownerId)
    .gte('date', startDate)
    .lt('date', nextMonth);

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
  const supabase = await getSupabaseServer();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return [];
  const ownerId = await getHouseholdOwnerId(supabase, authData.user.id);
  const { startDate, nextMonth } = getMonthDateRange(monthYearStr);

  // 1. Fetch this user's active categories in their saved order.
  const categories = (await getUserCategories(supabase, ownerId)).filter(
    (category) => category.active,
  );

  // 2. Fetch transactions for the current month
  const { data: transactions } = await supabase
    .from('transactions')
    .select('amount, category_id')
    .eq('user_id', ownerId)
    .gte('date', startDate)
    .lt('date', nextMonth);

  // 3. Fetch monthly planned budgets
  const { data: budgets } = await supabase
    .from('monthly_budgets')
    .select('category_id, planned_amount')
    .eq('user_id', ownerId)
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
  return categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    group_name: cat.group_name,
    type: cat.type,
    spent: spentMap[cat.id] || 0,
    budget: budgetMap[cat.id] ?? 0,
  }));
}
/**
 * Get budget vs spent totals categorized per user or for all family members
 */
export async function getBudgetSummary(monthYearStr: string, userName?: string) {
  const supabase = await getSupabaseServer();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return { totalBudget: 0, totalSpent: 0, categoriesBudget: [] };
  const ownerId = await getHouseholdOwnerId(supabase, authData.user.id);
  const { startDate, nextMonth } = getMonthDateRange(monthYearStr);

  const categories = (await getUserCategories(supabase, ownerId)).filter(
    (category) => category.active && category.type !== 'income',
  );

  let query = supabase
    .from('transactions')
    .select('amount, category_id')
    .eq('user_id', ownerId)
    .gte('date', startDate)
    .lt('date', nextMonth);

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

  const { data: budgets } = await supabase
    .from('monthly_budgets')
    .select('category_id, planned_amount')
    .eq('user_id', ownerId)
    .eq('month', startDate);
  const budgetByCat: Record<string, number> = {};
  (budgets || []).forEach((budget) => {
    budgetByCat[budget.category_id] = Number(budget.planned_amount) || 0;
  });

  const categoriesBudget: CategoryBudget[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    group_name: c.group_name,
    budget_limit: budgetByCat[c.id] || 0,
    spent: spentByCat[c.id] || 0,
  }));

  const totalBudget = categoriesBudget.reduce((acc, curr) => acc + curr.budget_limit, 0);

  return { totalBudget, totalSpent, categoriesBudget };
}

export type YearSummary = {
  year: number;
  months: Array<{
    month: string;
    label: string;
    income: number;
    spent: number;
    budget: number;
    cashFlow: number;
  }>;
  categories: Array<{
    id: string;
    name: string;
    groupName: string;
    spent: number;
    budget: number;
  }>;
  totalIncome: number;
  totalSpent: number;
  totalBudget: number;
  cashFlow: number;
};

export async function getYearSummary(year: number): Promise<YearSummary> {
  const emptyMonths = Array.from({ length: 12 }, (_, index) => ({
    month: `${year}-${String(index + 1).padStart(2, '0')}`,
    label: ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ'][index],
    income: 0,
    spent: 0,
    budget: 0,
    cashFlow: 0,
  }));
  const emptySummary: YearSummary = {
    year,
    months: emptyMonths,
    categories: [],
    totalIncome: 0,
    totalSpent: 0,
    totalBudget: 0,
    cashFlow: 0,
  };

  const supabase = await getSupabaseServer();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return emptySummary;
  const ownerId = await getHouseholdOwnerId(supabase, authData.user.id);
  const startDate = `${year}-01-01`;
  const endDate = `${year + 1}-01-01`;
  const categories = await getUserCategories(supabase, ownerId);
  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  const expenseCategories = categories.filter((category) => category.type !== 'income');

  const [{ data: transactions }, { data: budgets }] = await Promise.all([
    supabase
      .from('transactions')
      .select('amount, date, category_id')
      .eq('user_id', ownerId)
      .gte('date', startDate)
      .lt('date', endDate),
    supabase
      .from('monthly_budgets')
      .select('category_id, month, planned_amount')
      .eq('user_id', ownerId)
      .gte('month', startDate)
      .lt('month', endDate),
  ]);

  const monthly = emptyMonths.map((month) => ({ ...month }));
  const categoryTotals = new Map(expenseCategories.map((category) => [category.id, {
    id: category.id,
    name: category.name,
    groupName: category.group_name,
    spent: 0,
    budget: 0,
  }]));

  (transactions || []).forEach((transaction) => {
    const amount = Number(transaction.amount) || 0;
    const monthIndex = Number(String(transaction.date).slice(5, 7)) - 1;
    if (monthIndex < 0 || monthIndex > 11) return;
    const category = categoryMap.get(transaction.category_id);
    if (category?.type === 'income') {
      monthly[monthIndex].income += amount;
    } else {
      monthly[monthIndex].spent += amount;
      const total = categoryTotals.get(transaction.category_id);
      if (total) total.spent += amount;
    }
  });

  (budgets || []).forEach((budget) => {
    const amount = Number(budget.planned_amount) || 0;
    const monthIndex = Number(String(budget.month).slice(5, 7)) - 1;
    const total = categoryTotals.get(budget.category_id);
    if (monthIndex >= 0 && monthIndex < 12) monthly[monthIndex].budget += amount;
    if (total) total.budget += amount;
  });

  monthly.forEach((month) => {
    month.cashFlow = month.income - month.spent;
  });
  const totalIncome = monthly.reduce((sum, month) => sum + month.income, 0);
  const totalSpent = monthly.reduce((sum, month) => sum + month.spent, 0);
  const totalBudget = monthly.reduce((sum, month) => sum + month.budget, 0);

  return {
    year,
    months: monthly,
    categories: [...categoryTotals.values()]
      .filter((category) => category.spent > 0 || category.budget > 0)
      .sort((left, right) => right.spent - left.spent),
    totalIncome,
    totalSpent,
    totalBudget,
    cashFlow: totalIncome - totalSpent,
  };
}