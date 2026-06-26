import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateServiceStartDate } from '../utils/validation';

describe('validateServiceStartDate (Bug 1 — backend)', () => {
  const today = new Date(2026, 5, 26);

  it('accepts today and past dates', () => {
    assert.equal(validateServiceStartDate('2026-06-26', today), null);
    assert.equal(validateServiceStartDate('2011-06-26', today), null);
  });

  it('rejects future dates', () => {
    assert.equal(
      validateServiceStartDate('2099-01-01', today),
      'Service start date cannot be in the future'
    );
  });
});
