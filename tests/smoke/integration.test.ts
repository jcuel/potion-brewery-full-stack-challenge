import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4000';
const FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL ?? 'http://localhost:3000';

async function apiFetch(path: string, init?: RequestInit) {
  const response = await fetch(`${API_BASE_URL}${path}`, init);
  const body = await response.json().catch(() => null);
  return { response, body };
}

async function graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const { response, body } = await apiFetch('/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  assert.equal(response.ok, true, `GraphQL HTTP error: ${response.status}`);
  assert.ok(!body.errors?.length, body.errors?.[0]?.message ?? 'GraphQL errors');
  return body.data as T;
}

describe('integration smoke — backend health & REST', () => {
  it('GET /health returns ok', async () => {
    const { response, body } = await apiFetch('/health');
    assert.equal(response.ok, true);
    assert.equal(body.status, 'ok');
  });

  it('GET /api/alchemists returns seeded alchemists', async () => {
    const { response, body } = await apiFetch('/api/alchemists');
    assert.equal(response.ok, true);
    assert.ok(Array.isArray(body));
    assert.ok(body.some((alchemist: { name: string }) => alchemist.name === 'Sage Emberstone'));
  });

  it('GET /api/alchemist/:name returns profile with potions_completed', async () => {
    const { response, body } = await apiFetch('/api/alchemist/Sage%20Emberstone');
    assert.equal(response.ok, true);
    assert.equal(body.name, 'Sage Emberstone');
    assert.ok(typeof body.potions_completed === 'number');
    assert.ok(body.service_start_date);
  });

  it('PUT /api/alchemist/:name rejects future service_start_date (Bug 1)', async () => {
    const { response, body } = await apiFetch('/api/alchemist/Sage%20Emberstone', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service_start_date: '2099-01-01' }),
    });
    assert.equal(response.status, 400);
    assert.match(body.error, /future/i);
  });
});

describe('integration smoke — GraphQL potion board (Bug 2a)', () => {
  it('updatePotionOrderStatus mutation persists to the database', async () => {
    const orders = await graphql<{ potionOrders: { id: string; status: string }[] }>(
      '{ potionOrders(filter: { assigned_alchemist: "Sage Emberstone" }) { id status } }'
    );
    assert.ok(orders.potionOrders.length > 0);

    const target = orders.potionOrders[0];
    const originalStatus = target.status;
    const nextStatus = originalStatus === 'To Do' ? 'Brewing' : 'To Do';

    const mutation = await graphql<{ updatePotionOrderStatus: { id: string; status: string } }>(
      'mutation($id: ID!, $status: String!) { updatePotionOrderStatus(id: $id, status: $status) { id status } }',
      { id: target.id, status: nextStatus }
    );
    assert.equal(mutation.updatePotionOrderStatus.status, nextStatus);

    const verify = await graphql<{ potionOrder: { status: string } }>(
      'query($id: ID!) { potionOrder(id: $id) { status } }',
      { id: target.id }
    );
    assert.equal(verify.potionOrder.status, nextStatus);

    await graphql(
      'mutation($id: ID!, $status: String!) { updatePotionOrderStatus(id: $id, status: $status) { id status } }',
      { id: target.id, status: originalStatus }
    );
  });
});

describe('integration smoke — frontend proxy', () => {
  it('frontend serves the app shell', async () => {
    const response = await fetch(FRONTEND_BASE_URL);
    assert.equal(response.ok, true);
    const html = await response.text();
    assert.match(html, /Bubbling Cauldron/i);
  });

  it('frontend proxies /graphql to the backend', async () => {
    const response = await fetch(`${FRONTEND_BASE_URL}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ potionOrders { id } }' }),
    });
    assert.equal(response.ok, true);
    const body = await response.json();
    assert.ok(Array.isArray(body.data?.potionOrders));
  });
});
