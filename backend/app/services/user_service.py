from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate
from app.services.auth_service import hash_password


class UserService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_id(self, user_id: uuid.UUID) -> User | None:
        return self.db.get(User, user_id)

    def get_by_email(self, email: str) -> User | None:
        return self.db.query(User).filter(User.email == email.lower()).first()

    def list(self) -> list[User]:
        return self.db.query(User).order_by(User.email).all()

    def create(self, body: UserCreate) -> User:
        user = User(
            email=body.email.lower(),
            hashed_password=hash_password(body.password),
            full_name=body.full_name,
            is_active=body.is_active,
            roles=body.roles,
            assigned_group_ids=[str(gid) for gid in body.assigned_group_ids],
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def update(self, user_id: uuid.UUID, body: UserUpdate) -> User | None:
        user = self.db.get(User, user_id)
        if user is None:
            return None
        if body.email is not None:
            user.email = body.email.lower()
        if body.password is not None:
            user.hashed_password = hash_password(body.password)
        if body.full_name is not None:
            user.full_name = body.full_name
        if body.roles is not None:
            user.roles = body.roles
        if body.assigned_group_ids is not None:
            user.assigned_group_ids = [str(gid) for gid in body.assigned_group_ids]
        if body.is_active is not None:
            user.is_active = body.is_active
        self.db.commit()
        self.db.refresh(user)
        return user

    def delete(self, user_id: uuid.UUID) -> bool:
        user = self.db.get(User, user_id)
        if user is None:
            return False
        self.db.delete(user)
        self.db.commit()
        return True
