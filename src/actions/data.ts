'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseServer } from '@/lib/supabase-server';
import { ensureUserCategoryPreferences, getUserCategories } from '@/lib/category-data';
import { getHouseholdOwnerId } from '@/lib/household';
import * as XLSX from 'xlsx';

export type SpreadsheetExpense = {
  name: string;
  groupName: string;
  type: 'fixed_expense' | 'variable_expense';
  budget: number;
  spent: number;
};

export type SpreadsheetMonth = {
  month: string;
  expenses: SpreadsheetExpense[];
  income: number;
};

function parseAmount(value: unknown) {
  if (value === null || value === undefined || value === '' || String(value).includes('#')) return 0;
  const normalized = String(value).replace(/[₪,\s]/g, '').replace(/[()]/g, '');
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.abs(amount) : 0;
}

function parseSpreadsheetWorkbook(base64: string): SpreadsheetMonth[] {
  const workbook = XLSX.read(Buffer.from(base64, 'base64'), { type: 'buffer', raw: false });
  const monthNumbers = new Map([
    ['ינואר', 1], ['פבואר', 2], ['פברואר', 2], ['מרץ', 3], ['אפריל', 4],
    ['מאי', 5], ['יוני', 6], ['יולי', 7], ['אוגוסט', 8], ['ספטמבר', 9],
    ['אוקטובר', 10], ['נובמבר', 11], ['דצמבר', 12],
  ]);
  const months: SpreadsheetMonth[] = [];

  workbook.SheetNames.forEach((sheetName) => {
    const monthNumber = [...monthNumbers.entries()].find(([name]) => sheetName.startsWith(name))?.[1];
    if (!monthNumber || sheetName === 'סיכום שנתי') return;
    const yearMatch = sheetName.match(/\.(\d{2})/);
    const year = yearMatch ? 2000 + Number(yearMatch[1]) : monthNumber === 12 ? 2025 : 2026;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheetName], {
      header: 1,
      defval: null,
      raw: false,
    });
    let fixedGroup = 'אחר';
    let variableGroup = 'אחר';
    const expenses: SpreadsheetMonth['expenses'] = [];
    let income = 0;

    rows.forEach((row) => {
      const fixedName = typeof row[0] === 'string' ? row[0].trim() : '';
      const variableName = typeof row[5] === 'string' ? row[5].trim() : '';
      const fixedHasNumbers = row[1] !== null && row[1] !== undefined && row[1] !== '';
      const variableHasNumbers = row[6] !== null && row[6] !== undefined && row[6] !== '';
      if (fixedName && !fixedHasNumbers && !/^סך|^סה/.test(fixedName)) fixedGroup = fixedName;
      if (variableName && !variableHasNumbers && !/^סך|^סה/.test(variableName)) variableGroup = variableName;
      if (fixedName && fixedHasNumbers && !/^סך|^סה|^הוצאות$|^תקציב$/.test(fixedName)) {
        expenses.push({ name: fixedName, groupName: fixedGroup, type: 'fixed_expense', budget: parseAmount(row[1]), spent: parseAmount(row[2]) });
      }
      if (variableName && variableHasNumbers && !/^סך|^סה|^הוצאות$|^תקציב$/.test(variableName)) {
        expenses.push({ name: variableName, groupName: variableGroup, type: 'variable_expense', budget: parseAmount(row[6]), spent: parseAmount(row[7]) });
      }
      const incomeName = typeof row[10] === 'string' ? row[10].trim() : '';
      if (['משכורת', 'הכנסה נוספת', 'הכנסות נוספות'].includes(incomeName)
        && row[12] !== null && row[12] !== undefined && row[12] !== '') {
        income += parseAmount(row[12]);
      }
    });

    const deduped = new Map<string, SpreadsheetMonth['expenses'][number]>();
    expenses.forEach((expense) => {
      const key = `${expense.name}|${expense.groupName}|${expense.type}`;
      const previous = deduped.get(key);
      deduped.set(key, previous
        ? { ...expense, budget: Math.max(previous.budget, expense.budget), spent: previous.spent + expense.spent }
        : expense);
    });
    months.push({ month: `${year}-${String(monthNumber).padStart(2, '0')}`, expenses: [...deduped.values()], income });
  });

  return months;
}

export async function importSpreadsheetWorkbook(base64: string) {
  return importSpreadsheetData(parseSpreadsheetWorkbook(base64));
}

export async function importSpreadsheetData(months: SpreadsheetMonth[]) {
  const supabase = await getSupabaseServer();
  const { data: authData } = await supabase.auth.getUser();
  const email = authData.user?.email?.toLowerCase();
  if (!authData.user || email !== 'sapirbashan1@gmail.com') {
    throw new Error('הייבוא זמין רק לחשבון sapirbashan1@gmail.com');
  }

  const ownerId = await getHouseholdOwnerId(supabase, authData.user.id);
  await ensureUserCategoryPreferences(supabase, authData.user.id);
  const existingCategories = await getUserCategories(supabase, ownerId);
  const categoryIds = new Map(existingCategories.map((category) => [
    `${category.name}|${category.group_name}|${category.type}`,
    category.id,
  ]));

  const allExpenses = new Map<string, SpreadsheetExpense>();
  months.forEach((month) => month.expenses.forEach((expense) => {
    const key = `${expense.name}|${expense.groupName}|${expense.type}`;
    if (!allExpenses.has(key)) allExpenses.set(key, expense);
  }));

  for (const expense of allExpenses.values()) {
    const key = `${expense.name}|${expense.groupName}|${expense.type}`;
    if (categoryIds.has(key)) continue;
    const { data, error } = await supabase
      .from('categories')
      .insert({
        name: expense.name,
        group_name: expense.groupName,
        type: expense.type,
        default_budget: expense.budget,
        owner_id: ownerId,
      })
      .select('id')
      .single();
    if (error) throw new Error(`לא ניתן ליצור קטגוריה ${expense.name}: ${error.message}`);
    categoryIds.set(key, data.id);
    await supabase.from('user_category_preferences').upsert({
      user_id: authData.user.id,
      category_id: data.id,
      active: true,
      sort_order: categoryIds.size,
    }, { onConflict: 'user_id,category_id' });
  }

  if (!categoryIds.has('משכורת|הכנסות|income')) {
    const { data, error } = await supabase
      .from('categories')
      .insert({ name: 'משכורת', group_name: 'הכנסות', type: 'income', default_budget: 0, owner_id: ownerId })
      .select('id')
      .single();
    if (error) throw new Error(`לא ניתן ליצור קטגוריית הכנסה: ${error.message}`);
    categoryIds.set('משכורת|הכנסות|income', data.id);
  }

  const importedDates = months.map((month) => `${month.month}-15`);
  const importedMonths = months.map((month) => `${month.month}-01`);
  if (importedDates.length > 0) {
    const { error: transactionDeleteError } = await supabase
      .from('transactions')
      .delete()
      .eq('user_id', ownerId)
      .like('notes', 'ייבוא XLSX:%');
    if (transactionDeleteError) throw new Error(`לא ניתן לנקות ייבוא קודם: ${transactionDeleteError.message}`);
    const { error: budgetDeleteError } = await supabase
      .from('monthly_budgets')
      .delete()
      .eq('user_id', ownerId)
      .in('month', importedMonths);
    if (budgetDeleteError) throw new Error(`לא ניתן לעדכן תקציבי הייבוא: ${budgetDeleteError.message}`);
  }

  const budgets = months.flatMap((month) => month.expenses.flatMap((expense) => {
    const categoryId = categoryIds.get(`${expense.name}|${expense.groupName}|${expense.type}`);
    return categoryId && expense.budget > 0 ? [{
      user_id: ownerId,
      category_id: categoryId,
      month: `${month.month}-01`,
      planned_amount: expense.budget,
    }] : [];
  }));
  if (budgets.length > 0) {
    const { error } = await supabase.from('monthly_budgets').upsert(budgets, {
      onConflict: 'user_id,category_id,month',
    });
    if (error) throw new Error(`לא ניתן לשמור תקציבים: ${error.message}`);
  }

  const transactions = months.flatMap((month) => {
    const expenses = month.expenses.flatMap((expense) => {
      const categoryId = categoryIds.get(`${expense.name}|${expense.groupName}|${expense.type}`);
      return categoryId && expense.spent > 0 ? [{
        user_id: ownerId,
        category_id: categoryId,
        amount: expense.spent,
        date: `${month.month}-15`,
        user_name: 'ספיר',
        notes: `ייבוא XLSX: ${expense.name}`,
      }] : [];
    });
    if (month.income <= 0) return expenses;
    const incomeKey = 'משכורת|הכנסות|income';
    const incomeId = categoryIds.get(incomeKey);
    return expenses.concat(incomeId ? [{
      user_id: ownerId,
      category_id: incomeId,
      amount: month.income,
      date: `${month.month}-15`,
      user_name: 'ספיר',
      notes: 'ייבוא XLSX: משכורת',
    }] : []);
  });
  if (transactions.length > 0) {
    const { error } = await supabase.from('transactions').insert(transactions);
    if (error) throw new Error(`לא ניתן לשמור תנועות: ${error.message}`);
  }

  revalidatePath('/');
  revalidatePath('/budget');
  revalidatePath('/income');
  revalidatePath('/history');
  revalidatePath('/summary');
  return { categories: categoryIds.size, budgets: budgets.length, transactions: transactions.length };
}

export async function getSpreadsheetExportData() {
  const supabase = await getSupabaseServer();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) throw new Error('חובה להתחבר למערכת כדי לייצא נתונים');
  const ownerId = await getHouseholdOwnerId(supabase, authData.user.id);
  const [categories, budgetsResult, transactionsResult, membersResult] = await Promise.all([
    getUserCategories(supabase, ownerId),
    supabase.from('monthly_budgets').select('category_id, month, planned_amount').eq('user_id', ownerId).order('month'),
    supabase.from('transactions').select('id, category_id, amount, date, user_name, notes, created_at').eq('user_id', ownerId).order('date'),
    supabase.rpc('get_household_members'),
  ]);
  if (budgetsResult.error) throw new Error(budgetsResult.error.message);
  if (transactionsResult.error) throw new Error(transactionsResult.error.message);
  return {
    exportedAt: new Date().toISOString(),
    account: authData.user.email,
    categories,
    budgets: budgetsResult.data || [],
    transactions: transactionsResult.data || [],
    members: membersResult.data || [],
  };
}

export async function getSpreadsheetExportFile() {
  const data = await getSpreadsheetExportData();
  const workbook = XLSX.utils.book_new();
  const sheets = [
    ['קטגוריות', data.categories],
    ['תקציבים', data.budgets],
    ['תנועות', data.transactions],
    ['משתמשים', data.members],
  ] as const;
  sheets.forEach(([name, rows]) => {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), name);
  });
  return {
    filename: `accounta-bill-export-${new Date().toISOString().slice(0, 10)}.xlsx`,
    content: XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' }),
  };
}
