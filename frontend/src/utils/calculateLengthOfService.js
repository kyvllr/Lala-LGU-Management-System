export default function calculateLengthOfService(dateValue, now = new Date()) {
  if (!dateValue) return '';

  const start = new Date(`${dateValue}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) return '';

  const end = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const startDay = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  if (startDay > end.getTime()) return '';

  let totalMonths = (end.getUTCFullYear() - start.getUTCFullYear()) * 12
    + end.getUTCMonth() - start.getUTCMonth();
  const startDayOfMonth = start.getUTCDate();
  const lastDayOfTargetMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
  const anniversaryDay = Math.min(startDayOfMonth, lastDayOfTargetMonth);
  if (end.getUTCDate() < anniversaryDay) totalMonths -= 1;

  const elapsedYears = Math.floor(totalMonths / 12);
  const elapsedMonths = totalMonths % 12;
  const anchorMonth = start.getUTCMonth() + totalMonths;
  const anchorYear = start.getUTCFullYear() + Math.floor(anchorMonth / 12);
  const normalizedAnchorMonth = ((anchorMonth % 12) + 12) % 12;
  const anchorDay = Math.min(
    startDayOfMonth,
    new Date(Date.UTC(anchorYear, normalizedAnchorMonth + 1, 0)).getUTCDate()
  );
  const anchor = Date.UTC(anchorYear, normalizedAnchorMonth, anchorDay);
  const remainingDays = Math.floor((end.getTime() - anchor) / 86400000);
  const elapsedWeeks = Math.floor(remainingDays / 7);
  const elapsedDays = remainingDays % 7;

  return [
    elapsedYears ? `${elapsedYears} ${elapsedYears === 1 ? 'year' : 'years'}` : '',
    elapsedMonths ? `${elapsedMonths} ${elapsedMonths === 1 ? 'month' : 'months'}` : '',
    elapsedWeeks ? `${elapsedWeeks} ${elapsedWeeks === 1 ? 'week' : 'weeks'}` : '',
    elapsedDays ? `${elapsedDays} ${elapsedDays === 1 ? 'day' : 'days'}` : '',
  ].filter(Boolean).join(', ') || '0 days';
}
