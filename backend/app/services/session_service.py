from __future__ import annotations

import uuid

from sqlalchemy import Float, case, cast, desc, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.group import Group
from app.models.measurement import Measurement
from app.models.player import Player
from app.models.season import Season
from app.models.training_session import TrainingSession
from app.schemas.session import MeasurementsBatchInput, SessionCreate, SessionUpdate


class SessionService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list(
        self,
        group_id: uuid.UUID | None,
        skip: int,
        limit: int,
        allowed_group_ids: set[uuid.UUID] | None = None,
        season_id: uuid.UUID | None = None,
    ) -> list[TrainingSession]:
        """
        allowed_group_ids=None → nessun filtro (admin/responsabile).
        allowed_group_ids=set  → restringe ai gruppi dell'allenatore.
        Se group_id è specificato ha la precedenza (già validato al livello router).
        """
        q = select(TrainingSession).where(TrainingSession.is_active.is_(True))
        if group_id:
            q = q.where(TrainingSession.group_id == group_id)
        elif allowed_group_ids is not None:
            q = q.where(TrainingSession.group_id.in_(allowed_group_ids))
        if season_id:
            q = q.where(TrainingSession.season_id == season_id)
        q = q.order_by(TrainingSession.session_date.desc()).offset(skip).limit(limit)
        result = await self.db.execute(q)
        return result.scalars().all()

    async def count(
        self,
        group_id: uuid.UUID | None = None,
        allowed_group_ids: set[uuid.UUID] | None = None,
        season_id: uuid.UUID | None = None,
    ) -> int:
        q = select(func.count(TrainingSession.id)).where(TrainingSession.is_active.is_(True))
        if group_id:
            q = q.where(TrainingSession.group_id == group_id)
        elif allowed_group_ids is not None:
            q = q.where(TrainingSession.group_id.in_(allowed_group_ids))
        if season_id:
            q = q.where(TrainingSession.season_id == season_id)
        result = await self.db.execute(q)
        return result.scalar() or 0

    async def update(self, session_id: uuid.UUID, body: SessionUpdate) -> TrainingSession | None:
        session = await self.db.get(TrainingSession, session_id)
        if session is None or not session.is_active:
            return None
        for field, value in body.model_dump(exclude_unset=True).items():
            setattr(session, field, value)
        await self.db.commit()
        await self.db.refresh(session)
        return session

    async def deactivate(self, session_id: uuid.UUID) -> bool:
        session = await self.db.get(TrainingSession, session_id)
        if session is None or not session.is_active:
            return False
        session.is_active = False
        await self.db.commit()
        return True

    async def create(self, body: SessionCreate) -> TrainingSession | None:
        """Returns None if no current season or group is found. Raises ValueError if date is outside season range."""
        result = await self.db.execute(select(Season).where(Season.is_current.is_(True)))
        season = result.scalars().first()
        if not season:
            return None

        group = await self.db.get(Group, body.group_id)
        if not group:
            return None

        if season.start_date and body.session_date < season.start_date:
            raise ValueError(f"La data è precedente all'inizio della stagione ({season.start_date})")
        if season.end_date and body.session_date > season.end_date:
            raise ValueError(f"La data è successiva alla fine della stagione ({season.end_date})")

        session = TrainingSession(
            group_id=body.group_id,
            season_id=season.id,
            session_date=body.session_date,
            session_type=body.session_type,
            duration_min=body.duration_min,
            notes=body.notes,
        )
        self.db.add(session)
        await self.db.commit()
        await self.db.refresh(session)
        return session

    async def get(self, session_id: uuid.UUID) -> TrainingSession | None:
        """Eager-loads measurements and their players."""
        result = await self.db.execute(
            select(TrainingSession)
            .options(joinedload(TrainingSession.measurements).joinedload(Measurement.player))
            .where(TrainingSession.id == session_id)
        )
        return result.scalars().first()

    async def get_averages(self, session_id: uuid.UUID) -> dict | None:
        if not await self.db.get(TrainingSession, session_id):
            return None

        result = await self.db.execute(
            select(
                func.avg(Measurement.scanning_rate).label("avg_sr"),
                func.avg(Measurement.decision_quality).label("avg_dqi"),
                func.avg(Measurement.anticipation).label("avg_ai"),
                func.avg(Measurement.transition_reset).label("avg_trs"),
                func.avg(Measurement.verbal_comm).label("avg_vci"),
                func.count(Measurement.id).label("player_count"),
            )
            .where(
                Measurement.session_id == session_id,
                Measurement.is_absent.is_(False),
            )
        )
        row = result.first()
        return {
            "avg_sr": float(row.avg_sr) if row.avg_sr is not None else None,
            "avg_dqi": float(row.avg_dqi) if row.avg_dqi is not None else None,
            "avg_ai": float(row.avg_ai) if row.avg_ai is not None else None,
            "avg_trs": float(row.avg_trs) if row.avg_trs is not None else None,
            "avg_vci": float(row.avg_vci) if row.avg_vci is not None else None,
            "player_count": row.player_count or 0,
        }

    async def get_rankings(
        self,
        session_id: uuid.UUID,
        skip: int = 0,
        limit: int = 50,
    ) -> list[dict]:
        _FIELDS = ("scanning_rate", "decision_quality", "anticipation", "transition_reset", "verbal_comm")

        # Build row-level mean of non-NULL columns entirely in SQL.
        sum_expr = None
        count_expr = None
        for f in _FIELDS:
            col = getattr(Measurement, f)
            s = func.coalesce(col, 0.0)
            c = case((col.isnot(None), 1), else_=0)
            sum_expr = s if sum_expr is None else sum_expr + s
            count_expr = c if count_expr is None else count_expr + c

        avg_expr = cast(sum_expr, Float) / func.nullif(count_expr, 0)

        result = await self.db.execute(
            select(
                Measurement.player_id,
                Player.first_name,
                Player.last_name,
                avg_expr.label("avg_score"),
            )
            .join(Player, Measurement.player_id == Player.id)
            .where(
                Measurement.session_id == session_id,
                Measurement.is_absent.is_(False),
                count_expr > 0,
            )
            .order_by(desc(avg_expr))
        )
        rows = result.all()

        if not rows:
            return []

        ranked = [
            {
                "player_id": r.player_id,
                "first_name": r.first_name,
                "last_name": r.last_name,
                "avg_score": round(float(r.avg_score), 2),
            }
            for r in rows
        ]

        total = len(ranked)

        # Dense ranking: players with equal avg_score share rank and percentile.
        current_rank = 1
        for i, r in enumerate(ranked):
            if i > 0 and r["avg_score"] < ranked[i - 1]["avg_score"]:
                current_rank = i + 1
            r["rank"] = current_rank
            r["total"] = total

        # Percentile based on the first position of each rank group.
        rank_first_pos: dict[int, int] = {}
        for i, r in enumerate(ranked):
            rank_first_pos.setdefault(r["rank"], i)
        for r in ranked:
            pos = rank_first_pos[r["rank"]]
            r["percentile"] = round((total - pos - 1) / total * 100) if total > 1 else 100

        return ranked[skip : skip + limit]

    async def get_measurements(self, session_id: uuid.UUID) -> list[Measurement] | None:
        """Returns None if session not found, empty list if no measurements."""
        session = await self.get(session_id)
        if session is None:
            return None
        return session.measurements

    async def upsert_measurements(
        self, session: TrainingSession, body: MeasurementsBatchInput
    ) -> list[Measurement]:
        """Raises ValueError if any player_id is not found."""
        player_ids = {m.player_id for m in body.measurements}
        found_result = await self.db.execute(
            select(Player.id).where(Player.id.in_(player_ids))
        )
        found_ids = {row.id for row in found_result.all()}
        missing = player_ids - found_ids
        if missing:
            raise ValueError(f"Giocatori non trovati: {sorted(str(i) for i in missing)}")

        values = [
            {
                "session_id": session.id,
                "player_id": m.player_id,
                "group_id": session.group_id,
                "scanning_rate": m.scanning_rate,
                "decision_quality": m.decision_quality,
                "anticipation": m.anticipation,
                "transition_reset": m.transition_reset,
                "verbal_comm": m.verbal_comm,
                "is_absent": m.is_absent,
                "notes": m.notes,
            }
            for m in body.measurements
        ]

        ins = insert(Measurement)
        stmt = ins.values(values).on_conflict_do_update(
            constraint="uq_measurement_session_player",
            set_={
                "scanning_rate": ins.excluded.scanning_rate,
                "decision_quality": ins.excluded.decision_quality,
                "anticipation": ins.excluded.anticipation,
                "transition_reset": ins.excluded.transition_reset,
                "verbal_comm": ins.excluded.verbal_comm,
                "is_absent": ins.excluded.is_absent,
                "notes": ins.excluded.notes,
            },
        )
        await self.db.execute(stmt)
        await self.db.commit()

        return await self.get_measurements(session.id)
