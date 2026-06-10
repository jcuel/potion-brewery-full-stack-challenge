import sqlite3
import os
import base64
import random
from datetime import datetime, timedelta

from src.database.sample_data import (
    ELIXIR_COUNT,
    SAMPLE_FIRST_NAMES,
    SAMPLE_LAST_NAMES,
    SAMPLE_LOCATIONS,
    ELIXIR_TYPES,
    NOTE_GREETINGS,
    NOTE_REQUESTS,
    NOTE_REASONS,
    NOTE_EXTRAS,
    NOTE_CLOSINGS,
)

db = sqlite3.connect(':memory:', check_same_thread=False)
db.row_factory = sqlite3.Row


def get_db():
    return db


def load_image_as_base64(filename: str) -> str:
    """Load an image file from the images directory and return as base64 data URI."""
    images_dir = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'images')
    filepath = os.path.join(images_dir, filename)
    try:
        with open(filepath, 'rb') as f:
            data = f.read()
        b64 = base64.b64encode(data).decode('utf-8')
        return f'data:image/jpeg;base64,{b64}'
    except FileNotFoundError:
        print(f"Warning: Image file not found: {filepath}")
        return ''


def generate_note(seed: int) -> str:
    """Generate a quirky customer note using seed for deterministic selection."""
    rng = random.Random(seed)
    greeting = rng.choice(NOTE_GREETINGS)
    request = rng.choice(NOTE_REQUESTS)
    reason = rng.choice(NOTE_REASONS)
    extra = rng.choice(NOTE_EXTRAS)
    closing = rng.choice(NOTE_CLOSINGS)
    return f"{greeting} {request}. {reason} {extra} {closing}"


def initialize_database():
    """Create tables and seed with sample data."""
    cursor = db.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS alchemist_profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            service_start_date TEXT,
            profile_image TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS potion_orders (
            id TEXT PRIMARY KEY,
            customer_name TEXT NOT NULL,
            location TEXT NOT NULL,
            potion TEXT NOT NULL,
            assigned_alchemist TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'To Do',
            notes TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    db.commit()

    bramblewood_img = load_image_as_base64('Bramblewood.png')
    thistle_img = load_image_as_base64('Thistle.png')
    sage_img = load_image_as_base64('Sage.png')

    now = datetime.now()
    bramblewood_start = (now.replace(year=now.year - 127)).strftime('%Y-%m-%d')
    thistle_start = (now.replace(year=now.year - 43)).strftime('%Y-%m-%d')
    sage_start = (now.replace(year=now.year - 15)).strftime('%Y-%m-%d')

    alchemists = [
        ('Bramblewood Fizzwick', bramblewood_start, bramblewood_img),
        ('Thistle Moonwhisper', thistle_start, thistle_img),
        ('Sage Emberstone', sage_start, sage_img),
    ]

    for name, start_date, image in alchemists:
        cursor.execute(
            'INSERT OR IGNORE INTO alchemist_profiles (name, service_start_date, profile_image) VALUES (?, ?, ?)',
            (name, start_date, image)
        )

    sample_orders = [
        ('1', 'Elena Vasquez', 'Barcelona, Spain', 'Essence of Invisibility',
         'Thistle Moonwhisper', 'To Do',
         'Last time the Invisibility Potion only made my left arm disappear. Please do better.'),
        ('2', 'Marcus Chen', 'San Francisco, USA', 'Dragonfire Breath Tonic',
         'Sage Emberstone', 'Brewing',
         'Need this for a talent show next week. Extra spicy please.'),
        ('4', 'Oliver Smith', 'London, UK', 'Elixir of Eloquence',
         'Bramblewood Fizzwick', 'Ready for Pickup',
         'For my dissertation defense. The examiners are brutal.'),
        ('5', 'Aisha Patel', 'Mumbai, India', 'Nightshade Sleep Draught',
         'Thistle Moonwhisper', 'To Do',
         'Strong enough to knock out a grown elephant, please. My neighbor plays drums at midnight.'),
        ('6', 'Lucas Dubois', 'Paris, France', 'Bottled Starlight',
         'Sage Emberstone', 'Brewing',
         'For a very romantic dinner. It needs to literally glow. No pressure.'),
    ]

    for order in sample_orders:
        cursor.execute(
            'INSERT OR IGNORE INTO potion_orders (id, customer_name, location, potion, assigned_alchemist, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
            order
        )

    rng = random.Random(42)
    for i in range(ELIXIR_COUNT):
        order_id = str(7 + i)
        first_name = rng.choice(SAMPLE_FIRST_NAMES)
        last_name = rng.choice(SAMPLE_LAST_NAMES)
        customer_name = f"{first_name} {last_name}"
        location = rng.choice(SAMPLE_LOCATIONS)
        potion = rng.choice(ELIXIR_TYPES)
        note = generate_note(seed=i)

        cursor.execute(
            'INSERT OR IGNORE INTO potion_orders (id, customer_name, location, potion, assigned_alchemist, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
            (order_id, customer_name, location, potion, 'Bramblewood Fizzwick', 'Quality Control', note)
        )

    db.commit()
    print("Database initialized with sample data.")
