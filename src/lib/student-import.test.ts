import { describe, expect, it } from 'vitest';
import * as XLSX from '@e965/xlsx';
import type { AcademicYear } from '@/types/finance';
import { parseStudentWorkbook, suggestMapping, validateImportRows, type ColumnMapping } from './student-import';

const years: AcademicYear[] = [
  { id: 'y1', label: '2025-26', startDate: new Date(2025,5,1), endDate: new Date(2026,4,31), targetTuitionFees: 1_000_000, carryForwardFees: 0, status: 'closed' },
  { id: 'y2', label: '2026-27', startDate: new Date(2026,5,1), endDate: new Date(2027,4,31), targetTuitionFees: 1_000_000, carryForwardFees: 0, status: 'active' },
];
const mapping: ColumnMapping = { 0:'admission_number',1:'student_name',2:'class_name',3:'medium',4:'total_fee',5:'total_collected',6:'cash_collected',7:'upi_collected',8:'remaining' };

describe('student roster import', () => {
  it('reads CSV and modern Excel workbooks without evaluating formulas', async () => {
    const csv = new File(['Student Name,Class,Medium,Current-Year Total Fee\nA,5,ENG,30000'], 'students.csv');
    expect((await parseStudentWorkbook(csv))[0].rows).toHaveLength(1);
    const sheet = XLSX.utils.aoa_to_sheet([['Student Name','Class','Medium','Current-Year Total Fee'],['B','6','Gujarati',32000]]);
    const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, 'Roster');
    const bytes = XLSX.write(book, { type: 'array', bookType: 'xlsx' });
    const parsed = await parseStudentWorkbook(new File([bytes], 'students.xlsx'));
    expect(parsed[0]).toMatchObject({ name: 'Roster', headers: ['Student Name','Class','Medium','Current-Year Total Fee'] });
    const legacyBytes = XLSX.write(book, { type: 'array', bookType: 'biff8' });
    expect((await parseStudentWorkbook(new File([legacyBytes], 'students.xls')))[0].rows).toHaveLength(1);
  });

  it('suggests mapping and normalizes English/Gujarati aliases', () => {
    expect(suggestMapping(['Student Full Name','Standard','Language','Annual Fee'])).toEqual({0:'student_name',1:'class_name',2:'medium',3:'total_fee'});
    const result = validateImportRows([['1',' A  Patel ','Class 5','ENG',30000,20000,8000,12000,10000]], mapping, [], [], 'y2', years, '2026-08-22')[0];
    expect(result).toMatchObject({ fullName:'A Patel', medium:'english', annualFeeAmount:30000, openingCollectedCash:8000, openingCollectedUpi:12000, openingCollectedOther:0, action:'new' });
  });

  it('infers unspecified opening collection from total and remaining and surfaces it', () => {
    const inferredMap: ColumnMapping = {0:'student_name',1:'class_name',2:'medium',3:'total_fee',4:'remaining'};
    const result = validateImportRows([['A','5','G',30000,8000]], inferredMap, [], [], 'y2', years, '2026-08-22')[0];
    expect(result).toMatchObject({ inferredOpening:true, openingCollectedOther:22000, errors:[] });
  });

  it('blocks negative amounts, over-collection, inconsistent totals, and duplicate admission numbers', () => {
    const rows = [['1','A','5','E',30000,31000,16000,15000,0],['1','B','5','G',-1,0,0,0,0]];
    const result = validateImportRows(rows, mapping, [], [], 'y2', years, '2026-08-22');
    expect(result[0].errors).toContain('Collected exceeds total obligation');
    expect(result[1].errors).toContain('Duplicate admission number in this file');
    expect(result[1].errors).toContain('Amounts cannot be negative');
  });

  it('matches an existing admission number but does not auto-merge ambiguous names', () => {
    const students = [{ id:'s1', admissionNumber:'10', fullName:'Same Name', status:'active' as const, notes:'' },{ id:'s2', admissionNumber:'', fullName:'Same Name', status:'active' as const, notes:'' },{ id:'s3', admissionNumber:'', fullName:'Same Name', status:'active' as const, notes:'' }];
    const enrollments = ['s2','s3'].map((studentId,index) => ({ id:`e${index}`,studentId,academicYearId:'y2',className:'5',medium:'english' as const,annualFeeAmount:30000,additionalOutstandingAmount:0,openingCollectedCash:0,openingCollectedUpi:0,openingCollectedOther:0,openingSnapshotDate:null,status:'active' as const,notes:'' }));
    expect(validateImportRows([['10','Same Name','5','E',30000,0,0,0,30000]], mapping, students, enrollments, 'y2', years, '2026-08-22')[0].action).toBe('update');
    expect(validateImportRows([['','Same Name','5','E',30000,0,0,0,30000]], mapping, students, enrollments, 'y2', years, '2026-08-22')[0].action).toBe('possible_duplicate');
  });

  it('requires a configured original year, class, and medium for imported old fees', () => {
    const oldMap: ColumnMapping = {...mapping,9:'previous_year',10:'previous_class_name',11:'previous_medium',12:'previous_total_fee',13:'previous_remaining'};
    const good = validateImportRows([['1','A','5','E',30000,0,0,0,30000,'2025-26','4','Guj',12000,4000]], oldMap, [], [], 'y2', years, '2026-08-22')[0];
    expect(good).toMatchObject({ previousAcademicYearId:'y1', previousClassName:'4', previousMedium:'gujarati', previousOpeningCollectedOther:8000, errors:[] });
  });
});
