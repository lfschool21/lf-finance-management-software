import { describe, it, expect } from 'vitest';
import {
  getClassRank,
  compareClassNames,
  compareAdmissionNumbers,
  compareStudentsLowestToHighest,
} from '@/utils/student-order';

describe('Student Order & Sorting from Lowest to Highest', () => {
  it('assigns correct pedagogical ranks from lowest to highest grades', () => {
    expect(getClassRank('Playgroup')).toBeLessThan(getClassRank('Nursery'));
    expect(getClassRank('Nursery')).toBeLessThan(getClassRank('Junior KG'));
    expect(getClassRank('Junior KG')).toBeLessThan(getClassRank('Senior KG'));
    expect(getClassRank('Senior KG')).toBeLessThan(getClassRank('Class 1'));
    expect(getClassRank('Class 1')).toBeLessThan(getClassRank('Class 2'));
    expect(getClassRank('Class 2')).toBeLessThan(getClassRank('Class 3'));
    expect(getClassRank('Class 9')).toBeLessThan(getClassRank('Class 10'));
    expect(getClassRank('Class 10')).toBeLessThan(getClassRank('Class 11'));
    expect(getClassRank('Class 11')).toBeLessThan(getClassRank('Class 12'));
  });

  it('handles abbreviations like BV, LKG, UKG, PG', () => {
    expect(getClassRank('PG')).toBe(1);
    expect(getClassRank('BV')).toBe(2); // Balvatika / Nursery
    expect(getClassRank('LKG')).toBe(3);
    expect(getClassRank('UKG')).toBe(4);
    expect(getClassRank('Std 1')).toBe(11);
    expect(getClassRank('Std 10')).toBe(20);
  });

  it('correctly compares class names in ascending order', () => {
    const classes = ['Class 10', 'Class 2', 'Nursery', 'Class 1', 'Junior KG', 'Class 3'];
    const sorted = [...classes].sort(compareClassNames);
    expect(sorted).toEqual(['Nursery', 'Junior KG', 'Class 1', 'Class 2', 'Class 3', 'Class 10']);
  });

  it('sorts admission numbers numerically from lowest to highest', () => {
    const admNumbers = ['10', '2', '1', '20', '3', '100', '200'];
    const sorted = [...admNumbers].sort(compareAdmissionNumbers);
    expect(sorted).toEqual(['1', '2', '3', '10', '20', '100', '200']);
  });

  it('sorts prefixed admission numbers numerically from lowest to highest', () => {
    const admPrefixed = ['ADM-20', 'ADM-2', 'ADM-1', 'ADM-100', 'ADM-10', 'ADM-200'];
    const sorted = [...admPrefixed].sort(compareAdmissionNumbers);
    expect(sorted).toEqual(['ADM-1', 'ADM-2', 'ADM-10', 'ADM-20', 'ADM-100', 'ADM-200']);
  });

  it('arranges students strictly from lowest to highest grade and lowest to highest admission', () => {
    const students = [
      { student: { fullName: 'Zoya', admissionNumber: '15' }, enrollment: { className: 'Class 3' } },
      { student: { fullName: 'Aarav', admissionNumber: '2' }, enrollment: { className: 'Class 1' } },
      { student: { fullName: 'Bhavna', admissionNumber: '10' }, enrollment: { className: 'Class 1' } },
      { student: { fullName: 'Chetan', admissionNumber: '1' }, enrollment: { className: 'Class 2' } },
      { student: { fullName: 'Diya', admissionNumber: '5' }, enrollment: { className: 'Nursery' } },
    ];

    const sorted = [...students].sort(compareStudentsLowestToHighest);

    // Expected order:
    // 1. Diya (Nursery, Adm 5)
    // 2. Aarav (Class 1, Adm 2)
    // 3. Bhavna (Class 1, Adm 10)
    // 4. Chetan (Class 2, Adm 1)
    // 5. Zoya (Class 3, Adm 15)
    expect(sorted.map((s) => s.student.fullName)).toEqual(['Diya', 'Aarav', 'Bhavna', 'Chetan', 'Zoya']);
  });
});
