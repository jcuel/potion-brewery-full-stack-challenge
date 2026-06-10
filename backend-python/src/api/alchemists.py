from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from src.database.init import get_db

router = APIRouter()


class AlchemistProfileCreate(BaseModel):
    name: str
    service_start_date: Optional[str] = None


class AlchemistProfileUpdate(BaseModel):
    service_start_date: Optional[str] = None
    profile_image: Optional[str] = None


@router.get("/alchemists")
def list_alchemists():
    """List all alchemist profiles (name and profile_image only)."""
    db = get_db()
    cursor = db.cursor()
    cursor.execute('SELECT name, profile_image FROM alchemist_profiles')
    rows = cursor.fetchall()
    return [dict(row) for row in rows]


@router.get("/alchemist/{name}")
def get_alchemist(name: str):
    """Get a single alchemist profile with potions_completed count."""
    db = get_db()
    cursor = db.cursor()

    cursor.execute('SELECT * FROM alchemist_profiles WHERE name = ?', (name,))
    row = cursor.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail=f"Alchemist '{name}' not found")

    profile = dict(row)

    cursor.execute(
        "SELECT COUNT(*) as count FROM potion_orders WHERE assigned_alchemist = ? AND status = 'Ready for Pickup'",
        (name,)
    )
    count_row = cursor.fetchone()
    profile['potions_completed'] = count_row['count'] if count_row else 0

    return profile


@router.post("/alchemist")
def create_alchemist(data: AlchemistProfileCreate):
    """Create a new alchemist profile."""
    db = get_db()
    cursor = db.cursor()

    try:
        cursor.execute(
            'INSERT INTO alchemist_profiles (name, service_start_date) VALUES (?, ?)',
            (data.name, data.service_start_date)
        )
        db.commit()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    cursor.execute('SELECT * FROM alchemist_profiles WHERE name = ?', (data.name,))
    row = cursor.fetchone()
    return dict(row)


@router.put("/alchemist/{name}")
def update_alchemist(name: str, data: AlchemistProfileUpdate):
    """Update an alchemist profile (service_start_date and/or profile_image only)."""
    db = get_db()
    cursor = db.cursor()

    cursor.execute('SELECT * FROM alchemist_profiles WHERE name = ?', (name,))
    row = cursor.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail=f"Alchemist '{name}' not found")

    updates = []
    values = []

    if data.service_start_date is not None:
        updates.append('service_start_date = ?')
        values.append(data.service_start_date)

    if data.profile_image is not None:
        updates.append('profile_image = ?')
        values.append(data.profile_image)

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    values.append(name)
    query = f"UPDATE alchemist_profiles SET {', '.join(updates)} WHERE name = ?"
    cursor.execute(query, values)
    db.commit()

    cursor.execute('SELECT * FROM alchemist_profiles WHERE name = ?', (name,))
    row = cursor.fetchone()
    profile = dict(row)

    cursor.execute(
        "SELECT COUNT(*) as count FROM potion_orders WHERE assigned_alchemist = ? AND status = 'Ready for Pickup'",
        (name,)
    )
    count_row = cursor.fetchone()
    profile['potions_completed'] = count_row['count'] if count_row else 0

    return profile
