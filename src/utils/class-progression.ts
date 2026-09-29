/**
 * Utility for determining the logical previous class for a student.
 * E.g., when recording last year's pending fee for a student currently in Class 5,
 * this infers that their previous class was Class 4.
 */

export function getPreviousClassName(currentClassName: string | undefined | null): string {
  const raw = String(currentClassName || '').trim();
  if (!raw) return 'Previous Class';

  const norm = raw.toLowerCase().replace(/\s+/g, ' ');

  // 1. Check for numbered classes (e.g., "Class 5", "Std 5", "Grade 5", "Class 5-A", "10th")
  // Matches prefix, number, and optional section suffix (like "-A", " A", " B")
  const numericMatch = raw.match(/^((?:class|std|grade)?\s*)(\d+)(.*)$/i);
  if (numericMatch) {
    const prefix = numericMatch[1];
    const num = parseInt(numericMatch[2], 10);
    const suffix = numericMatch[3] || '';

    if (num > 1) {
      const prevNum = num - 1;
      const cleanPrefix = prefix.trim() ? `${prefix.trim()} ` : (raw.toLowerCase().includes('std') ? 'Std ' : raw.toLowerCase().includes('grade') ? 'Grade ' : 'Class ');
      return `${cleanPrefix}${prevNum}${suffix ? (suffix.startsWith('-') || suffix.startsWith(' ') ? suffix : ` ${suffix}`) : ''}`.trim();
    } else if (num === 1) {
      // Transition from Class 1 down to KG2 (Senior KG)
      const section = suffix.trim() ? ` ${suffix.replace(/^[-_\s]+/, '')}` : '';
      return `KG2${section}`;
    }
  }

  // 2. Pre-primary progressions
  // KG2 (Senior KG, UKG, Upper KG) -> KG1
  if (
    norm.includes('kg2') ||
    norm.includes('kg 2') ||
    norm.includes('kg-2') ||
    norm.includes('senior') ||
    norm.includes('sr') ||
    norm.includes('ukg') ||
    norm.includes('upper kg') ||
    norm === 'kg'
  ) {
    const sectionMatch = raw.match(/[-_\s]+([a-zA-Z])$/);
    const section = sectionMatch ? ` ${sectionMatch[1].toUpperCase()}` : '';
    return `KG1${section}`;
  }

  // KG1 (Playgroup, Junior KG, LKG) -> KG1
  if (
    norm.includes('kg1') ||
    norm.includes('kg 1') ||
    norm.includes('kg-1') ||
    norm.includes('junior') ||
    norm.includes('jr') ||
    norm.includes('lkg') ||
    norm.includes('lower kg') ||
    norm.includes('playgroup') ||
    norm.includes('play group') ||
    norm === 'pg' ||
    norm.startsWith('pg ')
  ) {
    const sectionMatch = raw.match(/[-_\s]+([a-zA-Z])$/);
    const section = sectionMatch ? ` ${sectionMatch[1].toUpperCase()}` : '';
    return `KG1${section}`;
  }

  if (norm.includes('balvatika 3') || norm.includes('bv 3') || norm.includes('bv-3')) {
    return 'Balvatika 2';
  }
  if (norm.includes('balvatika 2') || norm.includes('bv 2') || norm.includes('bv-2')) {
    return 'Balvatika 1';
  }
  if (norm.includes('balvatika') || norm.includes('nursery') || norm.startsWith('nur') || norm === 'bv') {
    return 'KG1';
  }

  // Fallback: return raw class with "Previous" indicator if unknown
  return `Previous (${raw})`;
}
