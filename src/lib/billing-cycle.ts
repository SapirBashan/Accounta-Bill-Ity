export const DEFAULT_BILLING_CYCLE_START_DAY = 1;

export function isBillingMonth(value: string | null | undefined): value is string {
  return Boolean(value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value));
}

function getCycleDay(year: number, monthIndex: number, startDay: number) {
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return Math.min(startDay, daysInMonth);
}

export function getBillingCycleRange(monthYearStr: string, startDay: number) {
  const [year, month] = monthYearStr.split('-').map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('חודש לא תקין');
  }

  const startDate = new Date(Date.UTC(year, month - 1, getCycleDay(year, month - 1, startDay)));
  const nextMonthDate = new Date(Date.UTC(year, month, 1));
  const nextStartDate = new Date(Date.UTC(
    nextMonthDate.getUTCFullYear(),
    nextMonthDate.getUTCMonth(),
    getCycleDay(nextMonthDate.getUTCFullYear(), nextMonthDate.getUTCMonth(), startDay),
  ));

  return {
    startDate: startDate.toISOString().slice(0, 10),
    nextStartDate: nextStartDate.toISOString().slice(0, 10),
  };
}

export function getCurrentBillingMonth(startDay: number, date = new Date()) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const cycleDay = getCycleDay(year, month, startDay);
  const periodStart = date.getUTCDate() >= cycleDay
    ? new Date(Date.UTC(year, month, 1))
    : new Date(Date.UTC(year, month - 1, 1));

  return `${periodStart.getUTCFullYear()}-${String(periodStart.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function getBillingCycleStartDate(monthYearStr: string, startDay: number) {
  return getBillingCycleRange(monthYearStr, startDay).startDate;
}
