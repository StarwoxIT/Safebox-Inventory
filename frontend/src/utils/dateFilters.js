export const MONTHS = [
  ['01', 'Jan'], ['02', 'Feb'], ['03', 'Mar'], ['04', 'Apr'],
  ['05', 'May'], ['06', 'Jun'], ['07', 'Jul'], ['08', 'Aug'],
  ['09', 'Sep'], ['10', 'Oct'], ['11', 'Nov'], ['12', 'Dec'],
];

// Distinct years (as 'YYYY' strings) present in rows[key], newest first.
export function yearsFrom(rows, key) {
  return [...new Set(rows.map((r) => r[key]?.slice(0, 4)).filter(Boolean))].sort().reverse();
}

// Applies optional dateFrom/dateTo/month/year filters to rows using the given date field.
export function filterByDate(rows, key, { dateFrom, dateTo, month, year } = {}) {
  return rows
    .filter((r) => !dateFrom || (r[key] || '').slice(0, 10) >= dateFrom)
    .filter((r) => !dateTo || (r[key] || '').slice(0, 10) <= dateTo)
    .filter((r) => !month || (r[key] || '').slice(5, 7) === month)
    .filter((r) => !year || (r[key] || '').startsWith(year));
}
