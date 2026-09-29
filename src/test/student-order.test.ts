import { describe, it, expect } from 'vitest';
import {
  getClassRank,
  compareClassNames,
  compareAdmissionNumbers,
  compareStudentsLowestToHighest,
} from '@/utils/student-order';

describe('Student Order & Sorting from Lowest to Highest', () => {
  it('assigns correct pedagogical ranks from lowest to highest grades', () => {
    expect(getClassRank('Nursery')).toBeLessThan(getClassRank('KG1'));
    expect(getClassRank('KG1')).toBeLessThan(getClassRank('KG2'));
    expect(getClassRank('KG2')).toBeLessThan(getClassRank('Class 1'));
    expect(getClassRank('Class 1')).toBeLessThan(getClassRank('Class 2'));
    expect(getClassRank('Class 2')).toBeLessThan(getClassRank('Class 3'));
    expect(getClassRank('Class 9')).toBeLessThan(getClassRank('Class 10'));
    expect(getClassRank('Class 10')).toBeLessThan(getClassRank('Class 11'));
    expect(getClassRank('Class 11')).toBeLessThan(getClassRank('Class 12'));

    // Playgroup and Junior KG are treated as KG1
    expect(getClassRank('Playgroup')).toBe(getClassRank('KG1'));
    expect(getClassRank('Play Group')).toBe(getClassRank('KG1'));
    expect(getClassRank('Junior KG')).toBe(getClassRank('KG1'));

    // Senior KG is treated as KG2
    expect(getClassRank('Senior KG')).toBe(getClassRank('KG2'));
  });

  it('handles abbreviations like BV, LKG, UKG, PG, KG1, KG2', () => {
    expect(getClassRank('BV')).toBe(1); // Balvatika / Nursery
    expect(getClassRank('PG')).toBe(2);
    expect(getClassRank('LKG')).toBe(2);
    expect(getClassRank('KG1')).toBe(2);
    expect(getClassRank('KG 1')).toBe(2);
    expect(getClassRank('UKG')).toBe(3);
    expect(getClassRank('KG2')).toBe(3);
    expect(getClassRank('KG 2')).toBe(3);
    expect(getClassRank('Std 1')).toBe(11);
    expect(getClassRank('Std 10')).toBe(20);
  });

  it('correctly compares class names in ascending order', () => {
    const classes = ['Class 10', 'Class 2', 'Nursery', 'Class 1', 'KG1', 'KG2', 'Class 3'];
    const sorted = [...classes].sort(compareClassNames);
    expect(sorted).toEqual(['Nursery', 'KG1', 'KG2', 'Class 1', 'Class 2', 'Class 3', 'Class 10']);
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
