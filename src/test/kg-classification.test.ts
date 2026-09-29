import { describe, it, expect } from 'vitest';
import { normalizeClassName, groupRosterByClassWithPrevious, groupRosterByClass } from '@/lib/student-fees';
import { getClassRank, compareClassNames } from '@/utils/student-order';
import { getPreviousClassName } from '@/utils/class-progression';
import type { StudentEnrollment } from '@/types/students';

describe('KG1 and KG2 Classification Across Entire Software', () => {
  describe('normalizeClassName', () => {
    it('treats Play Group and Junior KG variations as KG1', () => {
      expect(normalizeClassName('Playgroup')).toBe('KG1');
      expect(normalizeClassName('Play Group')).toBe('KG1');
      expect(normalizeClassName('play group')).toBe('KG1');
      expect(normalizeClassName('playgroup')).toBe('KG1');
      expect(normalizeClassName('play-group')).toBe('KG1');
      expect(normalizeClassName('PG')).toBe('KG1');
      expect(normalizeClassName('Junior KG')).toBe('KG1');
      expect(normalizeClassName('junior kg')).toBe('KG1');
      expect(normalizeClassName('Junior Kg')).toBe('KG1');
      expect(normalizeClassName('Jr KG')).toBe('KG1');
      expect(normalizeClassName('Jr. KG')).toBe('KG1');
      expect(normalizeClassName('jr kg')).toBe('KG1');
      expect(normalizeClassName('LKG')).toBe('KG1');
      expect(normalizeClassName('Lower KG')).toBe('KG1');
      expect(normalizeClassName('KG1')).toBe('KG1');
      expect(normalizeClassName('KG 1')).toBe('KG1');
      expect(normalizeClassName('kg 1')).toBe('KG1');
      expect(normalizeClassName('KG-1')).toBe('KG1');
    });

    it('treats Senior KG variations as KG2', () => {
      expect(normalizeClassName('Senior KG')).toBe('KG2');
      expect(normalizeClassName('senior kg')).toBe('KG2');
      expect(normalizeClassName('Senior Kg')).toBe('KG2');
      expect(normalizeClassName('Sr KG')).toBe('KG2');
      expect(normalizeClassName('Sr. KG')).toBe('KG2');
      expect(normalizeClassName('sr kg')).toBe('KG2');
      expect(normalizeClassName('UKG')).toBe('KG2');
      expect(normalizeClassName('Upper KG')).toBe('KG2');
      expect(normalizeClassName('KG2')).toBe('KG2');
      expect(normalizeClassName('KG 2')).toBe('KG2');
      expect(normalizeClassName('kg 2')).toBe('KG2');
      expect(normalizeClassName('KG-2')).toBe('KG2');
    });

    it('preserves section suffixes for KG1 and KG2', () => {
      expect(normalizeClassName('Playgroup A')).toBe('KG1 A');
      expect(normalizeClassName('Play Group B')).toBe('KG1 B');
      expect(normalizeClassName('Junior KG A')).toBe('KG1 A');
      expect(normalizeClassName('Junior KG-B')).toBe('KG1 B');
      expect(normalizeClassName('Jr KG C')).toBe('KG1 C');
      expect(normalizeClassName('KG1 A')).toBe('KG1 A');
      expect(normalizeClassName('Senior KG A')).toBe('KG2 A');
      expect(normalizeClassName('Senior KG-B')).toBe('KG2 B');
      expect(normalizeClassName('Sr KG C')).toBe('KG2 C');
      expect(normalizeClassName('KG2 A')).toBe('KG2 A');
    });

    it('leaves standard non-kindergarten classes untouched', () => {
      expect(normalizeClassName('Class 1')).toBe('Class 1');
      expect(normalizeClassName('Class 5')).toBe('Class 5');
      expect(normalizeClassName('Class 10')).toBe('Class 10');
      expect(normalizeClassName('Nursery')).toBe('Nursery');
    });
  });

  describe('getClassRank and Sorting', () => {
    it('ranks Nursery < KG1 < KG2 < Class 1 < Class 2', () => {
      expect(getClassRank('Nursery')).toBeLessThan(getClassRank('KG1'));
      expect(getClassRank('KG1')).toBeLessThan(getClassRank('KG2'));
      expect(getClassRank('KG2')).toBeLessThan(getClassRank('Class 1'));
      expect(getClassRank('Class 1')).toBeLessThan(getClassRank('Class 2'));
    });

    it('ranks Play Group and Junior KG identically to KG1', () => {
      expect(getClassRank('Playgroup')).toBe(getClassRank('KG1'));
      expect(getClassRank('Play Group')).toBe(getClassRank('KG1'));
      expect(getClassRank('Junior KG')).toBe(getClassRank('KG1'));
      expect(getClassRank('Jr KG')).toBe(getClassRank('KG1'));
      expect(getClassRank('LKG')).toBe(getClassRank('KG1'));
    });

    it('ranks Senior KG identically to KG2', () => {
      expect(getClassRank('Senior KG')).toBe(getClassRank('KG2'));
      expect(getClassRank('Sr KG')).toBe(getClassRank('KG2'));
      expect(getClassRank('UKG')).toBe(getClassRank('KG2'));
    });

    it('sorts classes in pedagogical progression with KG1 and KG2', () => {
      const classes = ['Class 2', 'Senior KG', 'Class 1', 'Play Group', 'Class 5', 'Junior KG'];
      const normalized = classes.map(normalizeClassName);
      const sorted = [...normalized].sort(compareClassNames);
      expect(sorted).toEqual(['KG1', 'KG1', 'KG2', 'Class 1', 'Class 2', 'Class 5']);
    });
  });

  describe('Class Progression (getPreviousClassName)', () => {
    it('transitions Class 1 down to KG2', () => {
      expect(getPreviousClassName('Class 1')).toBe('KG2');
      expect(getPreviousClassName('Std 1')).toBe('KG2');
      expect(getPreviousClassName('Grade 1')).toBe('KG2');
      expect(getPreviousClassName('Class 1-A')).toBe('KG2 A');
      expect(getPreviousClassName('Class 1 B')).toBe('KG2 B');
    });

    it('transitions KG2 (Senior KG) down to KG1', () => {
      expect(getPreviousClassName('KG2')).toBe('KG1');
      expect(getPreviousClassName('KG 2')).toBe('KG1');
      expect(getPreviousClassName('Senior KG')).toBe('KG1');
      expect(getPreviousClassName('UKG')).toBe('KG1');
      expect(getPreviousClassName('KG2 A')).toBe('KG1 A');
      expect(getPreviousClassName('Senior KG B')).toBe('KG1 B');
    });

    it('handles KG1 (Junior KG, Playgroup)', () => {
      expect(getPreviousClassName('KG1')).toBe('KG1');
      expect(getPreviousClassName('Junior KG')).toBe('KG1');
      expect(getPreviousClassName('Playgroup')).toBe('KG1');
      expect(getPreviousClassName('Play Group')).toBe('KG1');
    });
  });

  describe('Roster and Class Card Grouping in Student Section', () => {
    it('groups Playgroup and Junior KG students into a single KG1 class card, and Senior KG into KG2', () => {
      const enrollments: StudentEnrollment[] = [
        {
          id: 'e1',
          studentId: 's1',
          academicYearId: 'ay1',
          className: 'Playgroup',
          medium: 'gujarati',
          annualFeeAmount: 20000,
          additionalOutstandingAmount: 0,
          openingCollectedCash: 5000,
          openingCollectedUpi: 0,
          openingCollectedOther: 0,
          openingSnapshotDate: null,
          status: 'active',
          notes: '',
        },
        {
          id: 'e2',
          studentId: 's2',
          academicYearId: 'ay1',
          className: 'Junior KG',
          medium: 'gujarati',
          annualFeeAmount: 22000,
          additionalOutstandingAmount: 0,
          openingCollectedCash: 10000,
          openingCollectedUpi: 0,
          openingCollectedOther: 0,
          openingSnapshotDate: null,
          status: 'active',
          notes: '',
        },
        {
          id: 'e3',
          studentId: 's3',
          academicYearId: 'ay1',
          className: 'Senior KG',
          medium: 'gujarati',
          annualFeeAmount: 25000,
          additionalOutstandingAmount: 0,
          openingCollectedCash: 12000,
          openingCollectedUpi: 0,
          openingCollectedOther: 0,
          openingSnapshotDate: null,
          status: 'active',
          notes: '',
        },
        {
          id: 'e4',
          studentId: 's4',
          academicYearId: 'ay1',
          className: 'Class 1',
          medium: 'gujarati',
          annualFeeAmount: 30000,
          additionalOutstandingAmount: 0,
          openingCollectedCash: 15000,
          openingCollectedUpi: 0,
          openingCollectedOther: 0,
          openingSnapshotDate: null,
          status: 'active',
          notes: '',
        },
      ];

      const cards = groupRosterByClassWithPrevious(enrollments, enrollments, [], 'ay1');
      
      // Should have 3 cards: KG1 (merging Playgroup and Junior KG), KG2 (Senior KG), Class 1
      expect(cards.map((c) => c.className)).toEqual(['KG1', 'KG2', 'Class 1']);

      const kg1Card = cards.find((c) => c.className === 'KG1');
      expect(kg1Card).toBeDefined();
      expect(kg1Card?.totalStudents).toBe(2);
      expect(kg1Card?.totalAnnualFee).toBe(42000); // 20000 + 22000

      const kg2Card = cards.find((c) => c.className === 'KG2');
      expect(kg2Card).toBeDefined();
      expect(kg2Card?.totalStudents).toBe(1);
      expect(kg2Card?.totalAnnualFee).toBe(25000);
    });

    it('groupRosterByClass also consolidates pre-primary enrollments to KG1 and KG2', () => {
      const enrollments: StudentEnrollment[] = [
        {
          id: 'e1',
          studentId: 's1',
          academicYearId: 'ay1',
          className: 'Play Group',
          medium: 'english',
          annualFeeAmount: 25000,
          additionalOutstandingAmount: 0,
          openingCollectedCash: 0,
          openingCollectedUpi: 0,
          openingCollectedOther: 0,
          openingSnapshotDate: null,
          status: 'active',
          notes: '',
        },
        {
          id: 'e2',
          studentId: 's2',
          academicYearId: 'ay1',
          className: 'Junior KG',
          medium: 'english',
          annualFeeAmount: 25000,
          additionalOutstandingAmount: 0,
          openingCollectedCash: 0,
          openingCollectedUpi: 0,
          openingCollectedOther: 0,
          openingSnapshotDate: null,
          status: 'active',
          notes: '',
        },
        {
          id: 'e3',
          studentId: 's3',
          academicYearId: 'ay1',
          className: 'Senior KG',
          medium: 'english',
          annualFeeAmount: 30000,
          additionalOutstandingAmount: 0,
          openingCollectedCash: 0,
          openingCollectedUpi: 0,
          openingCollectedOther: 0,
          openingSnapshotDate: null,
          status: 'active',
          notes: '',
        },
      ];

      const classSummaries = groupRosterByClass(enrollments, []);
      expect(classSummaries.map((c) => c.className)).toEqual(['KG1', 'KG2']);
      expect(classSummaries[0].totalStudents).toBe(2); // Play Group + Junior KG
      expect(classSummaries[1].totalStudents).toBe(1); // Senior KG
    });
  });
});
