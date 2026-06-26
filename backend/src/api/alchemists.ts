import { Router, Request, Response } from 'express';
import { db } from '../database/init';
import { validateServiceStartDate } from '../utils/validation';

const router = Router();

router.get('/alchemists', (_req: Request, res: Response) => {
  try {
    const rows = db.prepare('SELECT name, profile_image FROM alchemist_profiles').all();
    res.json(rows);
  } catch (err) {
    console.error('Error fetching alchemists:', err);
    res.status(500).json({ error: 'Failed to fetch alchemists' });
  }
});

router.get('/alchemist/:name', (req: Request, res: Response) => {
  const { name } = req.params;

  try {
    const alchemist: any = db
      .prepare('SELECT * FROM alchemist_profiles WHERE name = ?')
      .get(name);

    if (!alchemist) {
      return res.status(404).json({ error: 'Alchemist not found' });
    }

    const countResult: any = db
      .prepare(
        `SELECT COUNT(*) as potions_completed FROM potion_orders
         WHERE assigned_alchemist = ? AND status = 'Ready for Pickup'`
      )
      .get(name);

    res.json({
      ...alchemist,
      potions_completed: countResult.potions_completed
    });
  } catch (err) {
    console.error('Error fetching alchemist:', err);
    res.status(500).json({ error: 'Failed to fetch alchemist' });
  }
});

router.post('/alchemist', (req: Request, res: Response) => {
  const { name, service_start_date, profile_image } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  const startDate = service_start_date || new Date().toISOString().split('T')[0];

  const dateError = validateServiceStartDate(startDate);
  if (dateError) {
    return res.status(400).json({ error: dateError });
  }

  try {
    const info = db
      .prepare(
        `INSERT INTO alchemist_profiles (name, service_start_date, profile_image)
         VALUES (?, ?, ?)`
      )
      .run(name, startDate, profile_image || null);

    const row = db
      .prepare('SELECT * FROM alchemist_profiles WHERE id = ?')
      .get(info.lastInsertRowid);

    res.status(201).json(row);
  } catch (err: any) {
    console.error('Error creating alchemist:', err);
    if (typeof err?.message === 'string' && err.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'Alchemist with this name already exists' });
    }
    res.status(500).json({ error: 'Failed to create alchemist' });
  }
});

router.put('/alchemist/:name', (req: Request, res: Response) => {
  const { name } = req.params;
  const { service_start_date, profile_image } = req.body;

  const updates: string[] = [];
  const values: any[] = [];

  if (service_start_date !== undefined) {
    const dateError = validateServiceStartDate(service_start_date);
    if (dateError) {
      return res.status(400).json({ error: dateError });
    }
    updates.push('service_start_date = ?');
    values.push(service_start_date);
  }
  if (profile_image !== undefined) {
    updates.push('profile_image = ?');
    values.push(profile_image);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  values.push(name);

  try {
    const info = db
      .prepare(`UPDATE alchemist_profiles SET ${updates.join(', ')} WHERE name = ?`)
      .run(...values);

    if (info.changes === 0) {
      return res.status(404).json({ error: 'Alchemist not found' });
    }

    const row: any = db
      .prepare('SELECT * FROM alchemist_profiles WHERE name = ?')
      .get(name);

    const countResult: any = db
      .prepare(
        `SELECT COUNT(*) as potions_completed FROM potion_orders
         WHERE assigned_alchemist = ? AND status = 'Ready for Pickup'`
      )
      .get(name);

    res.json({
      ...row,
      potions_completed: countResult.potions_completed
    });
  } catch (err) {
    console.error('Error updating alchemist:', err);
    res.status(500).json({ error: 'Failed to update alchemist' });
  }
});

export default router;
