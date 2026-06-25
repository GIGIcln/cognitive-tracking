#!/usr/bin/env python3
"""
One-shot script: importa gli utenti da users.json nel database PostgreSQL.

Uso:
    cd backend
    DATABASE_URL=postgresql+psycopg2://... python scripts/migrate_users_json.py

Idempotente: se l'utente esiste già (stessa email) viene saltato.
"""

from __future__ import annotations

import json
import sys
import uuid
from pathlib import Path

# Aggiunge la root del backend al path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import get_settings
from app.models.user import User


def main() -> None:
    settings = get_settings()
    users_path = Path(__file__).parent.parent / "users.json"

    if not users_path.exists():
        print(f"[ERRORE] File non trovato: {users_path}")
        sys.exit(1)

    with open(users_path, encoding="utf-8") as f:
        data = json.load(f)

    raw_users: list[dict] = data.get("users", [])
    if not raw_users:
        print("[INFO] Nessun utente da importare.")
        return

    engine = create_engine(settings.database_url)
    Session = sessionmaker(bind=engine)
    db = Session()

    imported = 0
    skipped = 0
    for u in raw_users:
        existing = db.query(User).filter(User.email == u["email"].lower()).first()
        if existing:
            print(f"[SKIP] {u['email']} — già presente nel DB")
            skipped += 1
            continue

        user_id = uuid.UUID(u["id"]) if "id" in u else uuid.uuid4()
        db.add(User(
            id=user_id,
            email=u["email"].lower(),
            hashed_password=u["hashed_password"],
            full_name=u.get("full_name"),
            is_active=u.get("is_active", True),
            roles=u.get("roles", []),
            assigned_group_ids=u.get("assigned_group_ids", []),
        ))
        print(f"[OK]   {u['email']} ({', '.join(u.get('roles', []))})")
        imported += 1

    db.commit()
    db.close()
    print(f"\nImportati: {imported}  |  Saltati: {skipped}")


if __name__ == "__main__":
    main()
