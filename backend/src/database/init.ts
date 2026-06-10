import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import {
  ELIXIR_COUNT,
  SAMPLE_FIRST_NAMES,
  SAMPLE_LAST_NAMES,
  SAMPLE_LOCATIONS,
  ELIXIR_TYPES,
  NOTE_GREETINGS,
  NOTE_REQUESTS,
  NOTE_REASONS,
  NOTE_EXTRAS,
  NOTE_CLOSINGS
} from './sampleData';

const db = new DatabaseSync(':memory:');

function loadImageAsBase64(filename: string): string | null {
  try {
    const imagePath = path.join(__dirname, '..', '..', '..', 'images', filename);
    const imageBuffer = fs.readFileSync(imagePath);
    const ext = path.extname(filename).toLowerCase().replace('.', '');
    const mimeType = ext === 'jpg' ? 'jpeg' : ext;
    return `data:image/${mimeType};base64,${imageBuffer.toString('base64')}`;
  } catch (err) {
    console.error(`Failed to load image ${filename}:`, err);
    return null;
  }
}

function generateNote(index: number): string {
  const greeting = NOTE_GREETINGS[index % NOTE_GREETINGS.length];
  const request = NOTE_REQUESTS[index % NOTE_REQUESTS.length];
  const reason = NOTE_REASONS[index % NOTE_REASONS.length];
  const extra = NOTE_EXTRAS[index % NOTE_EXTRAS.length];
  const closing = NOTE_CLOSINGS[index % NOTE_CLOSINGS.length];
  return `${greeting}! ${request} a healing elixir. ${reason}. ${extra} ${closing}`;
}

export function initializeDatabase(): DatabaseSync {
  db.exec(`
    CREATE TABLE IF NOT EXISTS alchemist_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      service_start_date TEXT NOT NULL,
      profile_image TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS potion_orders (
      id TEXT PRIMARY KEY,
      customer_name TEXT NOT NULL,
      location TEXT NOT NULL,
      potion TEXT NOT NULL,
      assigned_alchemist TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'To Do',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const bramblewoodImage = loadImageAsBase64('Bramblewood.png');
  const thistleImage = loadImageAsBase64('Thistle.png');
  const sageImage = loadImageAsBase64('Sage.png');

  const now = new Date();
  const bramblewoodStart = new Date(now.getFullYear() - 127, now.getMonth(), now.getDate()).toISOString().split('T')[0];
  const thistleStart = new Date(now.getFullYear() - 43, now.getMonth(), now.getDate()).toISOString().split('T')[0];
  const sageStart = new Date(now.getFullYear() - 15, now.getMonth(), now.getDate()).toISOString().split('T')[0];

  const insertAlchemist = db.prepare(`
    INSERT INTO alchemist_profiles (name, service_start_date, profile_image)
    VALUES (?, ?, ?)
  `);

  insertAlchemist.run('Bramblewood Fizzwick', bramblewoodStart, bramblewoodImage);
  insertAlchemist.run('Thistle Moonwhisper', thistleStart, thistleImage);
  insertAlchemist.run('Sage Emberstone', sageStart, sageImage);

  const insertOrder = db.prepare(`
    INSERT INTO potion_orders (id, customer_name, location, potion, assigned_alchemist, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertOrder.run('1', 'Elena Vasquez', 'Barcelona, Spain', 'Essence of Invisibility', 'Thistle Moonwhisper', 'To Do', 'Last time the Invisibility Potion only made my left arm disappear. Please do better.');
  insertOrder.run('2', 'Marcus Chen', 'San Francisco, USA', 'Dragonfire Breath Tonic', 'Sage Emberstone', 'Brewing', 'Need this for a talent show next week. Extra spicy please.');
  insertOrder.run('4', 'Oliver Smith', 'London, UK', 'Elixir of Eloquence', 'Bramblewood Fizzwick', 'Ready for Pickup', 'For my dissertation defense. The examiners are brutal.');
  insertOrder.run('5', 'Aisha Patel', 'Mumbai, India', 'Nightshade Sleep Draught', 'Thistle Moonwhisper', 'To Do', 'Strong enough to knock out a grown elephant, please. My neighbor plays drums at midnight.');
  insertOrder.run('6', 'Lucas Dubois', 'Paris, France', 'Bottled Starlight', 'Sage Emberstone', 'Brewing', 'For a very romantic dinner. It needs to literally glow. No pressure.');

  for (let i = 0; i < ELIXIR_COUNT; i++) {
    const id = (7 + i).toString();
    const firstName = SAMPLE_FIRST_NAMES[i % SAMPLE_FIRST_NAMES.length];
    const lastName = SAMPLE_LAST_NAMES[i % SAMPLE_LAST_NAMES.length];
    const customerName = `${firstName} ${lastName}`;
    const location = SAMPLE_LOCATIONS[i % SAMPLE_LOCATIONS.length];
    const potion = ELIXIR_TYPES[i % ELIXIR_TYPES.length];
    const notes = generateNote(i);

    insertOrder.run(id, customerName, location, potion, 'Bramblewood Fizzwick', 'Quality Control', notes);
  }
  console.log('🧪 Database initialized with sample data');
  return db;
}

export { db };
