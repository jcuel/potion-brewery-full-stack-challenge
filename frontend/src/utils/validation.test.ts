import { describe, expect, it } from 'vitest';
import {
  resolveDraggedOrderId,
  shouldApplyStatusChange,
  validateServiceStartDate,
} from './validation';

describe('validateServiceStartDate (Bug 1)', () => {
  const today = new Date(2026, 5, 26);

  it('accepts today and past dates', () => {
    expect(validateServiceStartDate('2026-06-26', today)).toBeNull();
    expect(validateServiceStartDate('2011-06-26', today)).toBeNull();
  });

  it('rejects future dates with the expected message', () => {
    expect(validateServiceStartDate('2027-01-01', today)).toBe(
      'Service start date cannot be in the future'
    );
  });

  it('does not reject past dates (regression for inverted comparison)', () => {
    expect(validateServiceStartDate('2000-01-01', today)).toBeNull();
  });
});

describe('resolveDraggedOrderId (Bug 2b)', () => {
  it('prefers dataTransfer over React state', () => {
    expect(resolveDraggedOrderId('from-transfer', 'from-state')).toBe('from-transfer');
  });

  it('falls back to state when dataTransfer is empty', () => {
    expect(resolveDraggedOrderId('', 'from-state')).toBe('from-state');
  });
});

describe('shouldApplyStatusChange (Bug 2b)', () => {
  it('allows moves to a different column', () => {
    expect(shouldApplyStatusChange('2', 'Brewing', 'Quality Control')).toBe(true);
  });

  it('skips no-op drops on the same column', () => {
    expect(shouldApplyStatusChange('2', 'Brewing', 'Brewing')).toBe(false);
  });

  it('skips drops without an order id', () => {
    expect(shouldApplyStatusChange(null, 'Brewing', 'Quality Control')).toBe(false);
  });
});
