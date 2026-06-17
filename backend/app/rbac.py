from __future__ import annotations

import uuid

from fastapi import Depends, HTTPException, status

from app.schemas.auth import UserContext
from app.services.auth_service import get_current_user


def require_admin(user: UserContext = Depends(get_current_user)) -> UserContext:
    """Accesso riservato agli admin."""
    if not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permessi insufficienti")
    return user


def require_staff(user: UserContext = Depends(get_current_user)) -> UserContext:
    """Accesso riservato ad admin e responsabili tecnici (sola lettura globale)."""
    if not user.is_staff:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permessi insufficienti")
    return user


def require_auth(user: UserContext = Depends(get_current_user)) -> UserContext:
    """Qualsiasi utente autenticato. Usare con assert_group_access per lo scoping."""
    return user


def assert_group_access(user: UserContext, group_id: uuid.UUID) -> None:
    """Lancia 403 se l'utente non ha accesso in lettura a questo gruppo."""
    scope = user.read_scope()
    if scope is not None and group_id not in scope:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accesso non autorizzato a questo gruppo",
        )


def assert_write_access(user: UserContext, group_id: uuid.UUID) -> None:
    """
    Valida il permesso di scrittura (creazione sessioni, inserimento misurazioni).
    - admin: accesso a tutti i gruppi
    - allenatore: solo ai propri gruppi (anche se ha anche responsabile_tecnico)
    - solo responsabile_tecnico: nessuna scrittura
    """
    if user.is_admin:
        return
    if "allenatore" in user.roles:
        scope = {uuid.UUID(gid) for gid in user.group_ids}
        if group_id not in scope:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Accesso in scrittura non autorizzato per questo gruppo",
            )
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Permessi insufficienti per operazioni di scrittura",
    )
