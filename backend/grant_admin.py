#!/usr/bin/env python3
"""Assegna il ruolo admin a un utente esistente nel DB.

Uso:
    python grant_admin.py admin@admin.it
    python grant_admin.py admin@admin.it --create --password scegli_password
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal
from app.models.user import User
from app.services.auth_service import hash_password


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("email", help="Email dell'utente da promuovere ad admin")
    parser.add_argument("--create", action="store_true", help="Crea l'utente se non esiste")
    parser.add_argument("--password", help="Password (obbligatoria con --create)")
    parser.add_argument("--name", default="Admin", help="Nome completo (solo con --create)")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        user = db.query(User).filter_by(email=args.email).first()

        if user is None:
            if not args.create:
                print(f"[!] Utente '{args.email}' non trovato. Usa --create per crearlo.", file=sys.stderr)
                sys.exit(1)
            if not args.password:
                print("[!] --password è obbligatoria con --create.", file=sys.stderr)
                sys.exit(1)
            user = User(
                email=args.email,
                full_name=args.name,
                hashed_password=hash_password(args.password),
                is_active=True,
                status="active",
                roles=["admin"],
                assigned_group_ids=[],
            )
            db.add(user)
            db.commit()
            print(f"[+] Utente '{args.email}' creato con ruolo admin.")
        else:
            roles = list(user.roles or [])
            if "admin" not in roles:
                roles.append("admin")
                user.roles = roles
                db.commit()
                print(f"[+] Ruolo 'admin' aggiunto a '{args.email}'. Ruoli ora: {roles}")
            else:
                print(f"[=] '{args.email}' ha già il ruolo 'admin'. Nessuna modifica.")
    except Exception as exc:
        db.rollback()
        print(f"[!] Errore: {exc}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
