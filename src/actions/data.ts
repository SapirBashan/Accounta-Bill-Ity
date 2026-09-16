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

type ExportStyle = {
  fill?: { fgColor: { rgb: string } };
  font?: { bold?: boolean; color?: { rgb: string }; sz?: number };
  alignment?: { horizontal?: 'left' | 'center' | 'right'; vertical?: 'center'; wrapText?: boolean };
  border?: {
    top?: { style: 'thin'; color: { rgb: string } };
    bottom?: { style: 'thin'; color: { rgb: string } };
    left?: { style: 'thin'; color: { rgb: string } };
    right?: { style: 'thin'; color: { rgb: string } };
  };
  numFmt?: string;
};

function setExportCell(sheet: XLSX.WorkSheet, address: string, value: string | number, style: ExportStyle, formula?: string) {
  sheet[address] = {
    t: typeof value === 'number' ? 'n' : 's',
    v: value,
    ...(formula ? { f: formula } : {}),
    s: style,
  } as XLSX.CellObject & { s: ExportStyle };
}

function excelColumn(index: number) {
  let result = '';
  let value = index;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function buildStyledMonthlySheet(
  month: string,
  sheetName: string,
  categories: Array<{ id: string; name: string; group_name: string; type: string }>,
  budgets: Array<{ category_id: string; month: string; planned_amount: number }>,
  transactions: Array<{ category_id: string; amount: number; date: string }>,
) {
  const sheet: XLSX.WorkSheet = {};
  const border = { style: 'thin' as const, color: { rgb: '808080' } };
  const base = { alignment: { vertical: 'center' as const }, border: { top: border, bottom: border, left: border, right: border } };
  const green = { ...base, fill: { fgColor: { rgb: '93C47D' } }, font: { bold: true, color: { rgb: '1F2937' } }, alignment: { horizontal: 'center' as const, vertical: 'center' as const } };
  const yellow = { ...base, fill: { fgColor: { rgb: 'FFFF00' } }, font: { bold: true, color: { rgb: '1F2937' } }, alignment: { horizontal: 'center' as const, vertical: 'center' as const } };
  const money = { ...base, numFmt: '₪#,##0.00', alignment: { horizontal: 'right' as const, vertical: 'center' as const } };
  const title = { ...base, fill: { fgColor: { rgb: '92D050' } }, font: { bold: true, sz: 16, color: { rgb: '1F2937' } }, alignment: { horizontal: 'center' as const, vertical: 'center' as const } };
  const budgetMap = new Map(budgets.filter((budget) => budget.month === `${month}-01`).map((budget) => [budget.category_id, Number(budget.planned_amount) || 0]));
  const spentMap = new Map<string, number>();
  transactions.filter((transaction) => transaction.date.startsWith(month)).forEach((transaction) => {
    spentMap.set(transaction.category_id, (spentMap.get(transaction.category_id) || 0) + Number(transaction.amount));
  });
  const fixed = categories.filter((category) => category.type === 'fixed_expense');
  const variable = categories.filter((category) => category.type === 'variable_expense');
  const maxRows = Math.max(fixed.length, variable.length, 1);
  const firstDataRow = 5;
  const lastDataRow = firstDataRow + maxRows - 1;
  setExportCell(sheet, 'B2', `תקציב חודשי - ${sheetName}`, title);
  setExportCell(sheet, 'B3', 'הוצאות קבועות', green);
  setExportCell(sheet, 'G3', 'הוצאות משתנות', green);
  setExportCell(sheet, 'L3', 'סיכום חודשי', yellow);
  ['הוצאה', 'תקציב', 'הוצאות בפועל', 'יתרה'].forEach((value, index) => setExportCell(sheet, `${excelColumn(2 + index)}4`, value, green));
  ['הוצאה', 'תקציב', 'הוצאות בפועל', 'יתרה'].forEach((value, index) => setExportCell(sheet, `${excelColumn(7 + index)}4`, value, green));
  ['מדד', 'סכום', 'הערה'].forEach((value, index) => setExportCell(sheet, `${excelColumn(12 + index)}4`, value, yellow));

  const writeExpense = (category: typeof categories[number], row: number, nameColumn: number, budgetColumn: number) => {
    const budget = budgetMap.get(category.id) || 0;
    const spent = spentMap.get(category.id) || 0;
    setExportCell(sheet, `${excelColumn(nameColumn)}${row}`, category.name, base);
    setExportCell(sheet, `${excelColumn(budgetColumn)}${row}`, budget, money);
    setExportCell(sheet, `${excelColumn(budgetColumn + 1)}${row}`, spent, money);
    setExportCell(sheet, `${excelColumn(budgetColumn + 2)}${row}`, budget - spent, money);
  };
  fixed.forEach((category, index) => writeExpense(category, firstDataRow + index, 2, 3));
  variable.forEach((category, index) => writeExpense(category, firstDataRow + index, 7, 8));
  const totalRow = lastDataRow + 1;
  setExportCell(sheet, `B${totalRow}`, 'סהכ קבועות', green);
  setExportCell(sheet, `C${totalRow}`, 0, money, `SUM(C${firstDataRow}:C${lastDataRow})`);
  setExportCell(sheet, `D${totalRow}`, 0, money, `SUM(D${firstDataRow}:D${lastDataRow})`);
  setExportCell(sheet, `E${totalRow}`, 0, money, `SUM(E${firstDataRow}:E${lastDataRow})`);
  setExportCell(sheet, `G${totalRow}`, 'סהכ משתנות', green);
  setExportCell(sheet, `H${totalRow}`, 0, money, `SUM(H${firstDataRow}:H${lastDataRow})`);
  setExportCell(sheet, `I${totalRow}`, 0, money, `SUM(I${firstDataRow}:I${lastDataRow})`);
  setExportCell(sheet, `J${totalRow}`, 0, money, `SUM(J${firstDataRow}:J${lastDataRow})`);
  setExportCell(sheet, `L${totalRow}`, 'סהכ הוצאות', yellow);
  setExportCell(sheet, `M${totalRow}`, 0, money, `C${totalRow}+H${totalRow}`);
  setExportCell(sheet, `N${totalRow}`, 0, money, `D${totalRow}+I${totalRow}`);
  setExportCell(sheet, `O${totalRow}`, 0, money, `E${totalRow}+J${totalRow}`);
  setExportCell(sheet, 'L5', 'הכנסות', green);
  setExportCell(sheet, 'M5', 'סכום', green);
  const income = categories.filter((category) => category.type === 'income');
  income.forEach((category, index) => {
    const row = 6 + index;
    setExportCell(sheet, `L${row}`, category.name, base);
    setExportCell(sheet, `M${row}`, spentMap.get(category.id) || 0, money);
  });
  const incomeRow = Math.max(7, 6 + income.length);
  setExportCell(sheet, `L${incomeRow}`, 'סהכ הכנסות', yellow);
  setExportCell(sheet, `M${incomeRow}`, 0, money, `SUM(M6:M${incomeRow - 1})`);
  setExportCell(sheet, `L${incomeRow + 1}`, 'חסכון', yellow);
  setExportCell(sheet, `M${incomeRow + 1}`, 0, money, `M${incomeRow}-N${totalRow}`);
  setExportCell(sheet, 'P2', 'הכנסות', { font: { bold: true } });
  setExportCell(sheet, 'Q2', 0, money, `M${incomeRow}`);
  setExportCell(sheet, 'P3', 'תקציב', { font: { bold: true } });
  setExportCell(sheet, 'Q3', 0, money, `M${totalRow}`);
  setExportCell(sheet, 'P4', 'הוצאות', { font: { bold: true } });
  setExportCell(sheet, 'Q4', 0, money, `N${totalRow}`);
  setExportCell(sheet, 'P5', 'חסכון', { font: { bold: true } });
  setExportCell(sheet, 'Q5', 0, money, `M${incomeRow + 1}`);
  sheet['!ref'] = `B2:Q${Math.max(totalRow, incomeRow + 1)}`;
  sheet['!cols'] = [
    { wch: 2 }, { wch: 24 }, { wch: 13 }, { wch: 15 }, { wch: 13 }, { wch: 2 },
    { wch: 24 }, { wch: 13 }, { wch: 15 }, { wch: 13 }, { wch: 2 }, { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 2 }, { wch: 14 },
  ];
  sheet['!rows'] = [{}, { hpt: 28 }, { hpt: 22 }, { hpt: 22 }, ...Array.from({ length: Math.max(totalRow, incomeRow + 1) }, () => ({ hpt: 20 }))];
  sheet['!freeze'] = { xSplit: 0, ySplit: 4 };
  return sheet;
}

function buildAnnualSheet(months: string[], sheetNames: string[]) {
  const sheet: XLSX.WorkSheet = {};
  const border = { style: 'thin' as const, color: { rgb: '808080' } };
  const header = { fill: { fgColor: { rgb: '92D050' } }, font: { bold: true }, alignment: { horizontal: 'center' as const }, border: { top: border, bottom: border, left: border, right: border } };
  const money = { numFmt: '₪#,##0.00', alignment: { horizontal: 'right' as const }, border: { top: border, bottom: border, left: border, right: border } };
  setExportCell(sheet, 'B2', 'סיכום שנתי', { ...header, font: { bold: true, sz: 16 } });
  ['שנה', 'חודש', 'הכנסות', 'הוצאות', 'תקציב', 'חסכון'].forEach((value, index) => setExportCell(sheet, `${excelColumn(2 + index)}4`, value, header));
  months.forEach((month, index) => {
    const row = 5 + index;
    const sheetName = sheetNames[index];
    const ref = `'${sheetName}'`;
    setExportCell(sheet, `B${row}`, Number(month.slice(0, 4)), header);
    setExportCell(sheet, `C${row}`, month.slice(5), header);
    setExportCell(sheet, `D${row}`, 0, money, `${ref}!Q2`);
    setExportCell(sheet, `E${row}`, 0, money, `${ref}!Q4`);
    setExportCell(sheet, `F${row}`, 0, money, `${ref}!Q3`);
    setExportCell(sheet, `G${row}`, 0, money, `D${row}-E${row}`);
  });
  const avgRow = 5 + months.length + 1;
  setExportCell(sheet, `C${avgRow}`, 'ממוצע חודשי', header);
  ['D', 'E', 'F', 'G'].forEach((column) => setExportCell(sheet, `${column}${avgRow}`, 0, money, `AVERAGE(${column}5:${column}${avgRow - 2})`));
  sheet['!ref'] = `B2:G${avgRow}`;
  sheet['!cols'] = [{ wch: 2 }, { wch: 10 }, { wch: 14 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
  return sheet;
}

export async function getSpreadsheetExportFile() {
  const data = await getSpreadsheetExportData();
  const workbook = XLSX.utils.book_new();
  const monthKeys = [...new Set([
    ...data.budgets.map((budget) => budget.month.slice(0, 7)),
    ...data.transactions.map((transaction) => transaction.date.slice(0, 7)),
  ])].sort();
  const monthNames = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  const sheetNames = monthKeys.map((month) => `${monthNames[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`);
  monthKeys.forEach((month, index) => XLSX.utils.book_append_sheet(
    workbook,
    buildStyledMonthlySheet(month, sheetNames[index], data.categories, data.budgets, data.transactions),
    sheetNames[index].slice(0, 31),
  ));
  XLSX.utils.book_append_sheet(workbook, buildAnnualSheet(monthKeys, sheetNames), 'סיכום שנתי');
  return {
    filename: `accounta-bill-budget-${new Date().toISOString().slice(0, 10)}.xlsx`,
    content: XLSX.write(workbook, { type: 'base64', bookType: 'xlsx', cellStyles: true }),
  };
}
