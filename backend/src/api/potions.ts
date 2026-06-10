import { buildSchema } from 'graphql';
import { db } from '../database/init';
import { VALID_STATUSES } from '../constants';

export const schema = buildSchema(`
  type PotionOrder {
    id: ID!
    customer_name: String!
    location: String!
    potion: String!
    assigned_alchemist: String!
    status: String!
    notes: String
  }

  input PotionOrderFilter {
    status: String
    assigned_alchemist: String
  }

  input PotionOrderInput {
    customer_name: String!
    location: String!
    potion: String!
    assigned_alchemist: String!
    notes: String
  }

  type Query {
    potionOrders(filter: PotionOrderFilter): [PotionOrder!]!
    potionOrder(id: ID!): PotionOrder
  }

  type Mutation {
    addPotionOrder(input: PotionOrderInput!): PotionOrder!
    updatePotionOrderStatus(id: ID!, status: String!): PotionOrder!
    updatePotionOrderAlchemist(id: ID!, assigned_alchemist: String!): PotionOrder!
  }
`);

export const root = {
  potionOrders: ({ filter }: { filter?: { status?: string; assigned_alchemist?: string } }) => {
    let query = 'SELECT * FROM potion_orders';
    const conditions: string[] = [];
    const values: any[] = [];

    if (filter?.status) {
      conditions.push('status = ?');
      values.push(filter.status);
    }
    if (filter?.assigned_alchemist) {
      conditions.push('assigned_alchemist = ?');
      values.push(filter.assigned_alchemist);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    return db.prepare(query).all(...values);
  },

  potionOrder: ({ id }: { id: string }) => {
    return db.prepare('SELECT * FROM potion_orders WHERE id = ?').get(id) || null;
  },

  addPotionOrder: ({ input }: { input: { customer_name: string; location: string; potion: string; assigned_alchemist: string; notes?: string } }) => {
    const id = Date.now().toString();
    const status = 'To Do';

    db.prepare(
      `INSERT INTO potion_orders (id, customer_name, location, potion, assigned_alchemist, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, input.customer_name, input.location, input.potion, input.assigned_alchemist, status, input.notes || null);

    return db.prepare('SELECT * FROM potion_orders WHERE id = ?').get(id);
  },

  updatePotionOrderStatus: ({ id, status }: { id: string; status: string }) => {
    if (!VALID_STATUSES.includes(status as any)) {
      throw new Error(`Invalid status: ${status}. Must be one of: ${VALID_STATUSES.join(', ')}`);
    }

    const row = db.prepare('SELECT * FROM potion_orders WHERE id = ?').get(id);
    if (!row) {
      throw new Error(`Potion order with id ${id} not found`);
    }
    return row;
  },

  updatePotionOrderAlchemist: ({ id, assigned_alchemist }: { id: string; assigned_alchemist: string }) => {
    const row = db
      .prepare('UPDATE potion_orders SET assigned_alchemist = ? WHERE id = ? RETURNING *')
      .get(assigned_alchemist, id);
    if (!row) {
      throw new Error(`Potion order with id ${id} not found`);
    }
    return row;
  },
};
