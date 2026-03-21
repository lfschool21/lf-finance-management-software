/**
 * Academic year runs June 5 → June 4.
 * E.g. AY 2024-25 = June 5, 2024 → June 4, 2025
 */

export function getAcademicYearForDate(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed
  const day = date.getDate();

  // Before June 5 → belongs to previous year's AY
  if (month < 5 || (month === 5 && day < 5)) {
    return `${year - 1}-${String(year).slice(2)}`;
  }
  return `${year}-${String(year + 1).slice(2)}`;
}

export function getAcademicYearDates(label: string): { start: Date; end: Date } {
  const startYear = parseInt(label.split('-')[0]);
  return {
    start: new Date(startYear, 5, 5), // June 5
    end: new Date(startYear + 1, 5, 4), // June 4 next year
  };
}

export function getCurrentAcademicYear(): string {
  return getAcademicYearForDate(new Date());
}

export function suggestNextAcademicYear(): string {
  const current = getCurrentAcademicYear();
  const startYear = parseInt(current.split('-')[0]) + 1;
  return `${startYear}-${String(startYear + 1).slice(2)}`;
}
