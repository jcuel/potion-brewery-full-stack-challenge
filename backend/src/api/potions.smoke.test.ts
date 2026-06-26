import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { initializeDatabase } from '../database/init';
import { root } from './potions';

initializeDatabase();

describe('updatePotionOrderStatus (Bug 2a)', () => {
  it('persists status changes to SQLite instead of only validating', () => {
    const before = root.potionOrder({ id: '1' });
    assert.ok(before);
    assert.equal(before.status, 'To Do');

    const updated = root.updatePotionOrderStatus({ id: '1', status: 'Brewing' });
    assert.equal(updated.status, 'Brewing');

    const after = root.potionOrder({ id: '1' });
    assert.equal(after?.status, 'Brewing');
  });

  it('rejects invalid status values', () => {
    assert.throws(
      () => root.updatePotionOrderStatus({ id: '1', status: 'Invalid Stage' }),
      /Invalid status/
    );
  });

  it('throws when the order id does not exist', () => {
    assert.throws(
      () => root.updatePotionOrderStatus({ id: 'missing-order', status: 'Brewing' }),
      /not found/
    );
  });
});

describe('general potion order functionality', () => {
  it('lists seeded orders and filters by alchemist', () => {
    const sageOrders = root.potionOrders({ filter: { assigned_alchemist: 'Sage Emberstone' } });
    assert.ok(sageOrders.length >= 2);
    assert.ok(sageOrders.every((order) => order.assigned_alchemist === 'Sage Emberstone'));
  });

  it('reassigns an order to another alchemist', () => {
    const updated = root.updatePotionOrderAlchemist({
      id: '6',
      assigned_alchemist: 'Thistle Moonwhisper',
    });
    assert.equal(updated.assigned_alchemist, 'Thistle Moonwhisper');
  });
});
