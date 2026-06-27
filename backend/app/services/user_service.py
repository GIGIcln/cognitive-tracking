from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate
from app.services.auth_service import hash_password


class UserService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(self, user_id: uuid.UUID) -> User | None:
        return await self.db.get(User, user_id)

    async def get_by_email(self, email: str) -> User | None:
        result = await self.db.execute(
            select(User).where(User.email == email.lower())
        )
        return result.scalars().first()

    async def list(self) -> list[User]:
        result = await self.db.execute(select(User).order_by(User.email))
        return result.scalars().all()

    async def create(self, body: UserCreate) -> User:
        user = User(
            email=body.email.lower(),
            hashed_password=hash_password(body.password),
            full_name=body.full_name,
            is_active=body.is_active,
            status=body.status,
            roles=body.roles,
            assigned_group_ids=[str(gid) for gid in body.assigned_group_ids],
        )
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def update(self, user_id: uuid.UUID, body: UserUpdate) -> User | None:
        user = await self.db.get(User, user_id)
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
        if body.status is not None:
            user.status = body.status
            # status e is_active rimangono in sync
            user.is_active = body.status == "active"
        elif body.is_active is not None:
            user.is_active = body.is_active
        await self.db.commit()
        await self.db.refresh(user)
        return user

    async def delete(self, user_id: uuid.UUID) -> bool:
        user = await self.db.get(User, user_id)
        if user is None:
            return False
        await self.db.delete(user)
        await self.db.commit()
        return True
