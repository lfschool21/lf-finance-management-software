import type { RosterImportRow, Student, StudentEnrollment, StudentMedium } from '@/types/students';
import type { AcademicYear } from '@/types/finance';
import { normalizeAdmissionNumber, normalizeClassName, normalizeMedium, normalizeStudentName } from './student-fees';

export type ImportField = 'ignore' | 'admission_number' | 'student_name' | 'class_name' | 'medium' |
  'total_fee' | 'additional_outstanding' | 'total_collected' | 'cash_collected' |
  'upi_collected' | 'remaining' | 'notes' | 'previous_year' | 'previous_total_fee' |
  'previous_total_collected' | 'previous_cash_collected' | 'previous_upi_collected' | 'previous_remaining' |
  'previous_class_name' | 'previous_medium';
  
export type ColumnMapping = Record<number, ImportField>;
export interface ParsedSheet { name: string; headers: string[]; rows: unknown[][] }
export interface ImportOptions {
  defaultMedium?: StudentMedium;
  defaultAnnualFee?: number;
}

export const IMPORT_FIELDS: { value: ImportField; label: string }[] = [
  { value: 'ignore', label: 'Ignore' }, { value: 'admission_number', label: 'Admission Number' },
  { value: 'student_name', label: 'Student Name' }, { value: 'class_name', label: 'Class' },
  { value: 'medium', label: 'Medium' }, { value: 'total_fee', label: 'Current-Year Total Fee' },
  { value: 'additional_outstanding', label: "Last Year's Pending Fees" },
  { value: 'total_collected', label: 'Current-Year Collected' }, { value: 'cash_collected', label: 'Cash Collected' },
  { value: 'upi_collected', label: 'UPI Collected' }, { value: 'remaining', label: 'Current-Year Remaining' },
  { value: 'previous_year', label: 'Previous-Year Fee Academic Year' },
  { value: 'previous_class_name', label: 'Previous-Year Class' },
  { value: 'previous_medium', label: 'Previous-Year Medium' },
  { value: 'previous_total_fee', label: 'Previous-Year Total Fee' },
  { value: 'previous_total_collected', label: 'Previous-Year Collected' },
  { value: 'previous_cash_collected', label: 'Previous-Year Cash Collected' },
  { value: 'previous_upi_collected', label: 'Previous-Year UPI Collected' },
  { value: 'previous_remaining', label: 'Previous-Year Remaining' },
  { value: 'notes', label: 'Notes' },
];

async function readFileBytes(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === 'function') return file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error || new Error('File could not be read'));
    reader.readAsArrayBuffer(file);
  });
}

export async function parseStudentWorkbook(file: File): Promise<ParsedSheet[]> {
  if (file.size > 10 * 1024 * 1024) throw new Error('File is larger than the 10 MB import limit');
  if (!/\.(xlsx|xls|csv)$/i.test(file.name)) throw new Error('Choose an .xlsx, .xls, or .csv file');
  const XLSX = await import('@e965/xlsx');
  const workbook = XLSX.read(await readFileBytes(file), { type: 'array', cellFormula: false, cellHTML: false, cellNF: false });
  return workbook.SheetNames.map((name) => {
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], { header: 1, raw: true, defval: '' });
    if (matrix.length === 0) return { name, headers: [], rows: [] };
    const headers = matrix[0].map((value) => String(value ?? '').trim());
    if (headers.some((header, index) => header && headers.findIndex((candidate) => candidate.toLowerCase() === header.toLowerCase()) !== index)) {
      throw new Error(`Sheet "${name}" contains duplicate headers`);
    }
    const rows = matrix.slice(1).filter((row) => row.some((value) => String(value ?? '').trim() !== ''));
    if (rows.length > 5000) throw new Error('A sheet can contain at most 5,000 student rows');
    return { name, headers, rows };
  });
}

export function suggestMapping(headers: string[]): ColumnMapping {
  const result: ColumnMapping = {};
  const normalize = (val: string) => val.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

  headers.forEach((header, index) => {
    const value = normalize(header);

    // 1. Exact match against known import field labels or values
    const exact = IMPORT_FIELDS.find(
      (item) => item.value !== 'ignore' && (normalize(item.label) === value || normalize(item.value) === value),
    );
    if (exact) {
      result[index] = exact.value;
      return;
    }

    // 2. Pattern heuristics (specific / historical patterns first to avoid shadowing)
    if (/admission|gr no|student id/.test(value)) result[index] = 'admission_number';
    else if (/student.*name|full.*name|^name$/.test(value)) result[index] = 'student_name';
    else if (/(previous|old).*(academic.*year|fee.*year)|(academic.*year|fee.*year).*(previous|old)/.test(value)) result[index] = 'previous_year';
    else if (/(previous|old).*(class|standard|grade)/.test(value)) result[index] = 'previous_class_name';
    else if (/(previous|old).*(medium|language)/.test(value)) result[index] = 'previous_medium';
    else if (/(previous|old).*cash/.test(value)) result[index] = 'previous_cash_collected';
    else if (/(previous|old).*upi/.test(value)) result[index] = 'previous_upi_collected';
    else if (/(previous|old).*(remaining|pending|balance)/.test(value)) result[index] = 'previous_remaining';
    else if (/(previous|old).*(collect|paid)/.test(value)) result[index] = 'previous_total_collected';
    else if (/(previous|old).*total.*fee/.test(value)) result[index] = 'previous_total_fee';
    else if (/class|standard|grade/.test(value)) result[index] = 'class_name';
    else if (/medium|language/.test(value)) result[index] = 'medium';
    else if (/last.*year.*pending|previous.*year.*pending|additional|extra.*outstanding/.test(value)) result[index] = 'additional_outstanding';
    else if (/cash.*collect|cash.*paid/.test(value)) result[index] = 'cash_collected';
    else if (/upi.*collect|upi.*paid/.test(value)) result[index] = 'upi_collected';
    else if (/remaining|pending|balance/.test(value)) result[index] = 'remaining';
    else if (/collect|paid/.test(value)) result[index] = 'total_collected';
    else if (/total.*fee|annual.*fee|current.*fee/.test(value)) result[index] = 'total_fee';
    else if (/note|remark/.test(value)) result[index] = 'notes';
    else result[index] = 'ignore';
  });
  return result;
}

function parseMoney(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const cleaned = String(value).replace(/[₹,\s]/g, '').replace(/^\((.*)\)$/, '-$1');
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function valueFor(row: unknown[], mapping: ColumnMapping, field: ImportField): unknown {
  const index = Object.keys(mapping).map(Number).find((key) => mapping[key] === field);
  return index === undefined ? '' : row[index];
}

export function validateImportRows(
  rows: unknown[][],
  mapping: ColumnMapping,
  students: Student[],
  enrollments: StudentEnrollment[],
  academicYearId: string,
  academicYears: AcademicYear[],
  snapshotDate: string,
  options?: ImportOptions,
): RosterImportRow[] {
  const fallbackMedium = options?.defaultMedium || 'english';
  const fallbackFee = typeof options?.defaultAnnualFee === 'number' && options.defaultAnnualFee >= 0 ? options.defaultAnnualFee : 0;
  const mappedFields = Object.values(mapping);
  const duplicateMappings = mappedFields.filter((field, index) => field !== 'ignore' && mappedFields.indexOf(field) !== index);
  if (duplicateMappings.length) {
    const fieldLabel = IMPORT_FIELDS.find((item) => item.value === duplicateMappings[0])?.label ?? duplicateMappings[0];
    throw new Error(`A destination field can only be mapped once: "${fieldLabel}"`);
  }
  for (const required of ['student_name', 'class_name'] as ImportField[]) {
    if (!mappedFields.includes(required)) throw new Error(`Map the required ${IMPORT_FIELDS.find((item) => item.value === required)?.label} column`);
  }

  const seenAdmissions = new Set<string>();
  return rows.map((source, index) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const fullName = normalizeStudentName(valueFor(source, mapping, 'student_name'));
    const admissionNumber = normalizeAdmissionNumber(valueFor(source, mapping, 'admission_number'));
    const className = normalizeClassName(valueFor(source, mapping, 'class_name'));

    const rawMedium = valueFor(source, mapping, 'medium');
    const mediumIsEmpty = rawMedium === '' || rawMedium === null || rawMedium === undefined;
    const medium = normalizeMedium(rawMedium) ?? (mediumIsEmpty ? fallbackMedium : null);

    const rawFee = valueFor(source, mapping, 'total_fee');
    const feeIsEmpty = rawFee === '' || rawFee === null || rawFee === undefined;
    const totalFee = feeIsEmpty ? fallbackFee : parseMoney(rawFee);

    const additional = parseMoney(valueFor(source, mapping, 'additional_outstanding')) ?? 0;
    const totalCollectedSource = parseMoney(valueFor(source, mapping, 'total_collected'));
    const remainingSource = parseMoney(valueFor(source, mapping, 'remaining'));
    const cash = parseMoney(valueFor(source, mapping, 'cash_collected')) ?? 0;
    const upi = parseMoney(valueFor(source, mapping, 'upi_collected')) ?? 0;
    let totalCollected = totalCollectedSource;
    let inferredOpening = false;
    if (totalCollected === null && totalFee !== null && remainingSource !== null) {
      totalCollected = totalFee + additional - remainingSource;
      inferredOpening = true;
      warnings.push(`Opening collected inferred as ${totalCollected}`);
    }
    if (totalCollected === null) totalCollected = cash + upi;
    const other = Math.max(0, totalCollected - cash - upi);

    const previousYearLabel = String(valueFor(source, mapping, 'previous_year') ?? '').trim().replace(/^AY\s*/i, '');
    const previousClassName = normalizeClassName(valueFor(source, mapping, 'previous_class_name'));
    const rawPreviousMedium = valueFor(source, mapping, 'previous_medium');
    const previousMediumIsEmpty = rawPreviousMedium === '' || rawPreviousMedium === null || rawPreviousMedium === undefined;
    const previousMedium = normalizeMedium(rawPreviousMedium) ?? (previousMediumIsEmpty ? medium : null);

    const previousFee = parseMoney(valueFor(source, mapping, 'previous_total_fee'));
    const previousRemaining = parseMoney(valueFor(source, mapping, 'previous_remaining'));
    const previousCash = parseMoney(valueFor(source, mapping, 'previous_cash_collected')) ?? 0;
    const previousUpi = parseMoney(valueFor(source, mapping, 'previous_upi_collected')) ?? 0;
    let previousCollected = parseMoney(valueFor(source, mapping, 'previous_total_collected'));
    let previousInferred = false;
    if (previousCollected === null && previousFee !== null && previousRemaining !== null) { previousCollected = previousFee - previousRemaining; previousInferred = true; }
    if (previousCollected === null) previousCollected = previousCash + previousUpi;
    const previousOther = Math.max(0, previousCollected - previousCash - previousUpi);
    const previousYear = academicYears.find((year) => year.label.trim().toLowerCase() === previousYearLabel.toLowerCase());

    const hasPreviousFeeData = (previousFee !== null && previousFee > 0) || (previousRemaining !== null && previousRemaining > 0) || previousCollected > 0;

    if (!fullName) errors.push('Student name is required');
    if (fullName.length > 200) errors.push('Student name is longer than 200 characters');
    if (!className) errors.push('Class is required');

    if (!medium) {
      errors.push('Medium must be English or Gujarati');
    } else if (mediumIsEmpty) {
      warnings.push(`Medium not specified in row; defaulted to ${fallbackMedium === 'english' ? 'English' : 'Gujarati'} (can be edited later)`);
    }

    if (totalFee === null) {
      errors.push('Annual fee is malformed');
    } else if (feeIsEmpty) {
      if (fallbackFee > 0) {
        warnings.push(`Annual fee was blank; applied default ₹${fallbackFee.toLocaleString('en-IN')} (can be edited later)`);
      } else {
        warnings.push('Annual fee was not specified; defaulted to ₹0 (can be edited later)');
      }
    }

    [totalFee, additional, totalCollected, cash, upi, remainingSource].forEach((value) => { if (value !== null && value < 0) errors.push('Amounts cannot be negative'); });
    if (totalFee !== null && totalCollected > totalFee + additional + 0.01) errors.push('Collected exceeds total obligation');
    if (cash + upi > totalCollected + 0.01) errors.push('Cash + UPI exceeds total collected');
    if (totalFee !== null && remainingSource !== null && Math.abs(totalFee + additional - totalCollected - remainingSource) > 0.01) errors.push('Total does not equal collected + remaining');
    if (other > 0) warnings.push(`${other} will be stored as unspecified opening collection`);

    if (hasPreviousFeeData) {
      if (!previousYear) errors.push(`Previous-year fee academic year "${previousYearLabel}" does not match a configured year`);
      if (previousYear?.id === academicYearId) errors.push('Previous-year fee must use a different academic year');
      if (!previousClassName) errors.push('Previous-year class is required for historical fee data');
      if (!previousMedium) {
        errors.push('Previous-year medium must be English or Gujarati');
      } else if (previousMediumIsEmpty) {
        warnings.push('Previous-year medium was not specified; defaulted to current medium');
      }
      if (previousFee === null || previousFee < 0) errors.push('Previous-year total fee is missing or invalid');
      if (previousCollected < 0 || previousCash < 0 || previousUpi < 0 || (previousRemaining !== null && previousRemaining < 0)) errors.push('Previous-year amounts cannot be negative');
      if (previousFee !== null && previousCollected > previousFee + 0.01) errors.push('Previous-year collected exceeds total fee');
      if (previousCash + previousUpi > previousCollected + 0.01) errors.push('Previous-year Cash + UPI exceeds collected');
      if (previousFee !== null && previousRemaining !== null && Math.abs(previousFee - previousCollected - previousRemaining) > 0.01) errors.push('Previous-year total does not equal collected + remaining');
      if (previousInferred) warnings.push(`Previous-year opening collected inferred as ${previousCollected}`);
      if (previousOther > 0) warnings.push(`${previousOther} previous-year collection will be stored as unspecified`);
    } else if (previousYearLabel || previousClassName) {
      warnings.push(`Previous class record noted (${[previousYearLabel, previousClassName].filter(Boolean).join(', ')}); no historical fee balance to import`);
    }

    let action: RosterImportRow['action'] = 'new';
    let studentId: string | undefined;
    const admissionKey = admissionNumber.toLowerCase();
    if (admissionNumber) {
      if (seenAdmissions.has(admissionKey)) { errors.push('Duplicate admission number in this file'); action = 'conflict'; }
      seenAdmissions.add(admissionKey);
      const match = students.find((student) => student.admissionNumber.toLowerCase() === admissionKey);
      if (match) { studentId = match.id; action = 'update'; }
    } else {
      const candidates = students.filter((student) => student.fullName.toLowerCase() === fullName.toLowerCase())
        .filter((student) => enrollments.some((enrollment) => enrollment.studentId === student.id && enrollment.academicYearId === academicYearId && enrollment.className.toLowerCase() === className.toLowerCase() && enrollment.medium === medium));
      if (candidates.length === 1) { studentId = candidates[0].id; action = 'update'; warnings.push('Matched by name, class, and medium; review carefully'); }
      if (candidates.length > 1) { action = 'possible_duplicate'; errors.push('Ambiguous duplicate: add an admission number or resolve the student manually'); }
    }
    if (errors.length && action !== 'possible_duplicate') action = 'conflict';
    return { rowNumber: index + 2, studentId, admissionNumber, fullName, className, medium,
      annualFeeAmount: totalFee, additionalOutstandingAmount: additional,
      openingCollectedCash: cash, openingCollectedUpi: upi, openingCollectedOther: other,
      previousAcademicYearId: hasPreviousFeeData ? previousYear?.id : undefined,
      previousClassName: hasPreviousFeeData ? previousClassName : undefined,
      previousMedium: hasPreviousFeeData ? (previousMedium ?? undefined) : undefined,
      previousAnnualFeeAmount: hasPreviousFeeData ? previousFee ?? undefined : undefined,
      previousOpeningCollectedCash: hasPreviousFeeData ? previousCash : undefined,
      previousOpeningCollectedUpi: hasPreviousFeeData ? previousUpi : undefined,
      previousOpeningCollectedOther: hasPreviousFeeData ? previousOther : undefined,
      openingSnapshotDate: snapshotDate, action, inferredOpening, warnings, errors };
  });
}

export async function downloadStudentImportTemplate() {
  const XLSX = await import('@e965/xlsx');
  const headers = ['Admission Number','Student Name','Class','Medium','Current-Year Total Fee','Current-Year Collected','Current-Year Cash Collected','Current-Year UPI Collected','Current-Year Remaining',"Last Year's Pending Fees",'Previous-Year Fee Academic Year','Previous-Year Class','Previous-Year Medium','Previous-Year Total Fee','Previous-Year Collected','Previous-Year Cash Collected','Previous-Year UPI Collected','Previous-Year Remaining','Notes'];
  const sheet = XLSX.utils.aoa_to_sheet([headers, ['1024','Example Student','Class 5','English',30000,20000,8000,12000,10000,0,'2025-26','Class 4','English',12000,8000,3000,5000,4000,'Example row — delete before import']]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Students');
  XLSX.writeFile(book, 'little-flowers-student-import-template.xlsx');
}
