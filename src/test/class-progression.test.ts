import { describe, it, expect } from 'vitest';
import { getPreviousClassName } from '@/utils/class-progression';

describe('getPreviousClassName', () => {
  it('deducts numeric classes correctly', () => {
    expect(getPreviousClassName('Class 5')).toBe('Class 4');
    expect(getPreviousClassName('Class 10')).toBe('Class 9');
    expect(getPreviousClassName('Class 2')).toBe('Class 1');
    expect(getPreviousClassName('Std 6')).toBe('Std 5');
    expect(getPreviousClassName('Grade 8')).toBe('Grade 7');
  });

  it('preserves section suffixes when deducting classes', () => {
    expect(getPreviousClassName('Class 5-A')).toBe('Class 4-A');
    expect(getPreviousClassName('Class 3 B')).toBe('Class 2 B');
  });

  it('handles Class 1 transition to KG2 (Senior KG)', () => {
    expect(getPreviousClassName('Class 1')).toBe('KG2');
    expect(getPreviousClassName('Std 1')).toBe('KG2');
    expect(getPreviousClassName('Class 1-A')).toBe('KG2 A');
  });

  it('handles kindergarten and pre-primary levels with KG1 and KG2', () => {
    expect(getPreviousClassName('KG2')).toBe('KG1');
    expect(getPreviousClassName('KG2 A')).toBe('KG1 A');
    expect(getPreviousClassName('Senior KG')).toBe('KG1');
    expect(getPreviousClassName('Senior KG A')).toBe('KG1 A');
    expect(getPreviousClassName('UKG')).toBe('KG1');
    expect(getPreviousClassName('KG1')).toBe('KG1');
    expect(getPreviousClassName('Junior KG')).toBe('KG1');
    expect(getPreviousClassName('LKG')).toBe('KG1');
    expect(getPreviousClassName('Playgroup')).toBe('KG1');
    expect(getPreviousClassName('Nursery')).toBe('KG1');
    expect(getPreviousClassName('Balvatika 2')).toBe('Balvatika 1');
    expect(getPreviousClassName('Balvatika')).toBe('KG1');
  });

  it('handles empty or missing strings safely', () => {
    expect(getPreviousClassName('')).toBe('Previous Class');
    expect(getPreviousClassName(null)).toBe('Previous Class');
  });
});
