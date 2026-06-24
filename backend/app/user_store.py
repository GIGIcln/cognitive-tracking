from __future__ import annotations

import json
import threading
import uuid
from pathlib import Path

_USERS_PATH = Path(__file__).parent.parent / "users.json"
_lock = threading.Lock()
_by_id: dict[str, dict] = {}
_by_email: dict[str, dict] = {}
_initialized = False

VALID_ROLES = frozenset({"admin", "responsabile_tecnico", "allenatore"})


def _load() -> None:
    global _by_id, _by_email, _initialized

    if not _USERS_PATH.exists():
        raise RuntimeError(
            f"File utenti non trovato: {_USERS_PATH}\n"
            "Copia users.example.json in users.json e configura le credenziali reali.\n"
            "Usa scripts/hash_password.py per generare gli hash bcrypt."
        )

    with open(_USERS_PATH, encoding="utf-8") as f:
        data = json.load(f)

    by_id: dict[str, dict] = {}
    by_email: dict[str, dict] = {}

    for u in data.get("users", []):
        required = {"id", "email", "hashed_password", "roles"}
        missing = required - u.keys()
        if missing:
            raise RuntimeError(f"Campi mancanti per utente '{u.get('email', '?')}': {missing}")

        if not u.get("roles"):
            raise RuntimeError(
                f"Utente '{u.get('email', '?')}' non ha ruoli assegnati. "
                "Almeno un ruolo è obbligatorio."
            )

        invalid_roles = set(u["roles"]) - VALID_ROLES
        if invalid_roles:
            raise RuntimeError(
                f"Ruoli non validi per '{u['email']}': {invalid_roles}. "
                f"Valori ammessi: {VALID_ROLES}"
            )

        for gid in u.get("assigned_group_ids", []):
            try:
                uuid.UUID(gid)
            except ValueError:
                raise RuntimeError(
                    f"UUID non valido in assigned_group_ids per '{u['email']}': {gid}"
                )

        by_id[u["id"]] = u
        by_email[u["email"].lower()] = u

    with _lock:
        _by_id = by_id
        _by_email = by_email
        _initialized = True


def get_by_id(user_id: str) -> dict | None:
    if not _initialized:
        _load()
    return _by_id.get(user_id)


def get_by_email(email: str) -> dict | None:
    if not _initialized:
        _load()
    return _by_email.get(email.lower())


def reload() -> None:
    """Ricarica users.json a caldo, senza riavviare il server."""
    global _initialized
    with _lock:
        _initialized = False
    _load()
