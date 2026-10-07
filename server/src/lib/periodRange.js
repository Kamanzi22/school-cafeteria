// The period a super admin history screen covers, from its anchor date (YYYY-MM-DD) and type:
//   day   -> that calendar day
//   week  -> Mon-Sun containing the date
//   month -> the whole calendar month containing it
//   year  -> the whole calendar year containing it
// Shared by the visitor, delivery and store activity histories so they all mean the same periods.
function getPeriodRange(type, dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  if (type === 'week') {
    const diffToMonday = (d.getDay() + 6) % 7;
    const start = new Date(d); start.setDate(d.getDate() - diffToMonday); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  if (type === 'month') {
    return { start: new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0), end: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999) };
  }
  if (type === 'year') {
    return { start: new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0), end: new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999) };
  }
  const start = new Date(d); start.setHours(0, 0, 0, 0);
  const end = new Date(d); end.setHours(23, 59, 59, 999);
  return { start, end };
}

module.exports = { getPeriodRange };
