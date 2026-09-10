import type { Student, StudentEnrollment } from '@/types/students';

/**
 * Returns a numerical pedagogical rank for a school class/grade so that
 * students and rosters can be sorted from lowest grade to highest grade.
 *
 * Progression:
 * 1. Playgroup (PG)
 * 2. Nursery / Balvatika (BV)
 * 3. Junior KG / LKG
 * 4. Senior KG / UKG
 * 5. Class 1 through Class 12
 */
export function getClassRank(className: string | undefined | null): number {
  const norm = String(className || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!norm) return 999;

  // Pre-primary levels
  if (norm.includes('playgroup') || norm === 'pg' || norm.startsWith('pg ')) return 1;
  if (norm.includes('nursery') || norm.startsWith('nur') || norm === 'bv' || norm.includes('balvatika')) return 2;
  if (norm.includes('junior') || norm.includes('jr') || norm.includes('lkg') || norm.includes('lower kg')) return 3;
  if (norm.includes('senior') || norm.includes('sr') || norm.includes('ukg') || norm.includes('upper kg') || norm === 'kg') return 4;

  // Primary to High School classes: e.g. "Class 1", "Std 5", "Grade 10", "1st", "10"
  const match = norm.match(/(?:class|std|grade)?\s*(\d+)/);
  if (match) {
    const num = parseInt(match[1], 10);
    return 10 + num; // Class 1 => 11, Class 2 => 12, ... Class 10 => 20, Class 12 => 22
  }

  // College / Higher levels
  if (norm.includes('college') || norm.includes('fy') || norm.includes('sy') || norm.includes('ty')) return 50;

  return 100;
}

/**
 * Compares two class names from lowest grade to highest grade.
 */
export function compareClassNames(classA: string, classB: string): number {
  const rankA = getClassRank(classA);
  const rankB = getClassRank(classB);
  if (rankA !== rankB) return rankA - rankB;
  return classA.localeCompare(classB, undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Compares two admission numbers in natural ascending numerical order (lowest to highest).
 * Handles numbers like "1", "2", "10", as well as prefixes like "ADM-1", "ADM-2", "GR-101".
 */
export function compareAdmissionNumbers(admA: string | undefined | null, admB: string | undefined | null): number {
  const cleanA = (admA || '').trim();
  const cleanB = (admB || '').trim();

  if (!cleanA && !cleanB) return 0;
  if (!cleanA) return 1; // Empty numbers at the end
  if (!cleanB) return -1;

  // Check if both are pure numbers or have identical prefixes with numbers
  const matchA = cleanA.match(/^(.*?)(\d+)(.*?)$/);
  const matchB = cleanB.match(/^(.*?)(\d+)(.*?)$/);

  if (matchA && matchB && matchA[1].toLowerCase() === matchB[1].toLowerCase()) {
    const numA = parseInt(matchA[2], 10);
    const numB = parseInt(matchB[2], 10);
    if (numA !== numB) return numA - numB;
  }

  return cleanA.localeCompare(cleanB, undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Compares two students in standard ascending order (lowest to highest):
 * 1. Class: Lowest to Highest (Nursery -> Class 1 -> Class 2 -> ... -> Class 12)
 * 2. Admission Number: Lowest to Highest (1 -> 2 -> ... -> 200)
 * 3. Full Name: Ascending (A to Z)
 */
export function compareStudentsLowestToHighest(
  a: { student: Pick<Student, 'fullName' | 'admissionNumber'>; enrollment: Pick<StudentEnrollment, 'className'> },
  b: { student: Pick<Student, 'fullName' | 'admissionNumber'>; enrollment: Pick<StudentEnrollment, 'className'> }
): number {
  // 1. Class: lowest to highest
  const classDiff = compareClassNames(a.enrollment.className, b.enrollment.className);
  if (classDiff !== 0) return classDiff;

  // 2. Admission Number: lowest to highest
  const admDiff = compareAdmissionNumbers(a.student.admissionNumber, b.student.admissionNumber);
  if (admDiff !== 0) return admDiff;

  // 3. Name: A to Z
  return a.student.fullName.localeCompare(b.student.fullName, undefined, { sensitivity: 'base' });
}
