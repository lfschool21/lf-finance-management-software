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

  it('handles Class 1 transition to Senior KG', () => {
    expect(getPreviousClassName('Class 1')).toBe('Senior KG');
    expect(getPreviousClassName('Std 1')).toBe('Senior KG');
    expect(getPreviousClassName('Class 1-A')).toBe('Senior KG A');
  });

  it('handles kindergarten and pre-primary levels', () => {
    expect(getPreviousClassName('Senior KG')).toBe('Junior KG');
    expect(getPreviousClassName('UKG')).toBe('Junior KG');
    expect(getPreviousClassName('Junior KG')).toBe('Nursery');
    expect(getPreviousClassName('LKG')).toBe('Nursery');
    expect(getPreviousClassName('Nursery')).toBe('Playgroup');
    expect(getPreviousClassName('Balvatika 2')).toBe('Balvatika 1');
    expect(getPreviousClassName('Balvatika')).toBe('Playgroup');
    expect(getPreviousClassName('Playgroup')).toBe('Playgroup');
  });

  it('handles empty or missing strings safely', () => {
    expect(getPreviousClassName('')).toBe('Previous Class');
    expect(getPreviousClassName(null)).toBe('Previous Class');
  });
});
