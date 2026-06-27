from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.assignment import PlayerGroupAssignment
from app.models.group import Group
from app.models.measurement import Measurement
from app.models.player import Player
from app.models.training_session import TrainingSession
from app.models.attendance import Attendance
from app.models.injury_log import InjuryLog
from app.models.match import Match, MatchLineup
from app.schemas.player import PlayerCreate, PlayerSummaryResponse, PlayerUpdate

_PARAM_FIELDS = ('scanning_rate', 'decision_quality', 'anticipation', 'transition_reset', 'verbal_comm')


class PlayerService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list(
        self,
        group_id: uuid.UUID | None,
        skip: int,
        limit: int,
        allowed_group_ids: set[uuid.UUID] | None = None,
    ) -> list[tuple[Player, str | None]]:
        """
        allowed_group_ids=None → nessun filtro (admin/responsabile).
        allowed_group_ids=set  → restringe ai gruppi dell'allenatore.
        """
        if group_id is not None:
            q = (
                select(Player, Group.name)
                .join(
                    PlayerGroupAssignment,
                    (PlayerGroupAssignment.player_id == Player.id)
                    & (PlayerGroupAssignment.group_id == group_id)
                    & PlayerGroupAssignment.is_current.is_(True),
                )
                .join(Group, Group.id == PlayerGroupAssignment.group_id)
                .order_by(Player.last_name.asc(), Player.first_name.asc())
            )
        elif allowed_group_ids is not None:
            q = (
                select(Player, Group.name)
                .join(
                    PlayerGroupAssignment,
                    (PlayerGroupAssignment.player_id == Player.id)
                    & PlayerGroupAssignment.is_current.is_(True),
                )
                .join(Group, Group.id == PlayerGroupAssignment.group_id)
                .where(
                    Player.is_active.is_(True),
                    PlayerGroupAssignment.group_id.in_(allowed_group_ids),
                )
                .order_by(Player.last_name.asc(), Player.first_name.asc())
            )
        else:
            q = (
                select(Player, Group.name)
                .outerjoin(
                    PlayerGroupAssignment,
                    (PlayerGroupAssignment.player_id == Player.id)
                    & PlayerGroupAssignment.is_current.is_(True),
                )
                .outerjoin(Group, Group.id == PlayerGroupAssignment.group_id)
                .where(Player.is_active.is_(True))
                .order_by(Player.last_name.asc(), Player.first_name.asc())
            )
        result = await self.db.execute(q.offset(skip).limit(limit))
        return result.all()

    async def count(
        self,
        group_id: uuid.UUID | None = None,
        allowed_group_ids: set[uuid.UUID] | None = None,
    ) -> int:
        if group_id is not None:
            result = await self.db.execute(
                select(func.count(Player.id))
                .join(
                    PlayerGroupAssignment,
                    (PlayerGroupAssignment.player_id == Player.id)
                    & (PlayerGroupAssignment.group_id == group_id)
                    & PlayerGroupAssignment.is_current.is_(True),
                )
            )
            return result.scalar() or 0
        elif allowed_group_ids is not None:
            result = await self.db.execute(
                select(func.count(Player.id))
                .join(
                    PlayerGroupAssignment,
                    (PlayerGroupAssignment.player_id == Player.id)
                    & PlayerGroupAssignment.is_current.is_(True),
                )
                .where(
                    Player.is_active.is_(True),
                    PlayerGroupAssignment.group_id.in_(allowed_group_ids),
                )
            )
            return result.scalar() or 0
        else:
            result = await self.db.execute(
                select(func.count(Player.id))
                .where(Player.is_active.is_(True))
            )
            return result.scalar() or 0

    async def create(self, body: PlayerCreate) -> Player:
        player = Player(**body.model_dump(exclude={"group_id"}))
        self.db.add(player)
        if body.group_id:
            # flush within the transaction so player.id is populated before building the FK
            await self.db.flush()
            self.db.add(PlayerGroupAssignment(
                player_id=player.id,
                group_id=body.group_id,
                start_date=date.today(),
                is_current=True,
            ))
        await self.db.commit()
        await self.db.refresh(player)
        return player

    async def get(self, player_id: uuid.UUID) -> Player | None:
        return await self.db.get(Player, player_id)

    async def get_with_group(
        self,
        player_id: uuid.UUID,
        allowed_group_ids: set[uuid.UUID] | None = None,
    ) -> tuple[Player, str | None] | None:
        q = (
            select(Player, Group.name)
            .outerjoin(
                PlayerGroupAssignment,
                (PlayerGroupAssignment.player_id == Player.id)
                & PlayerGroupAssignment.is_current.is_(True),
            )
            .outerjoin(Group, Group.id == PlayerGroupAssignment.group_id)
            .where(Player.id == player_id, Player.is_active.is_(True))
        )
        if allowed_group_ids is not None:
            q = q.where(PlayerGroupAssignment.group_id.in_(allowed_group_ids))
        result = await self.db.execute(q)
        return result.first()

    async def update(self, player_id: uuid.UUID, body: PlayerUpdate) -> Player | None:
        player = await self.db.get(Player, player_id)
        if player is None:
            return None
        for field, value in body.model_dump(exclude_unset=True).items():
            setattr(player, field, value)
        await self.db.commit()
        await self.db.refresh(player)
        return player

    async def deactivate(self, player_id: uuid.UUID) -> bool:
        player = await self.db.get(Player, player_id)
        if player is None:
            return False
        player.is_active = False
        await self.db.commit()
        return True

    async def get_history(
        self,
        player_id: uuid.UUID,
        skip: int = 0,
        limit: int = 200,
        allowed_group_ids: set[uuid.UUID] | None = None,
    ) -> list[dict]:
        """
        allowed_group_ids=None → storia completa (admin/responsabile).
        allowed_group_ids=set  → solo sessioni nei gruppi dell'allenatore.
        Filtro applicato a livello DB, non in Python.
        Esclude sessioni soft-deleted (is_active=False).
        """
        q = (
            select(Measurement, TrainingSession, Group)
            .join(TrainingSession, TrainingSession.id == Measurement.session_id)
            .join(Group, Group.id == TrainingSession.group_id)
            .where(
                Measurement.player_id == player_id,
                Measurement.is_absent.is_(False),
                TrainingSession.is_active.is_(True),
            )
        )
        if allowed_group_ids is not None:
            q = q.where(TrainingSession.group_id.in_(allowed_group_ids))

        q = q.order_by(TrainingSession.session_date.asc()).offset(skip).limit(limit)
        result = await self.db.execute(q)
        rows = result.all()
        return [
            {
                "session_id": m.session_id,
                "session_date": ts.session_date,
                "session_type": ts.session_type,
                "group_id": ts.group_id,
                "group_name": g.name,
                "scanning_rate": float(m.scanning_rate) if m.scanning_rate is not None else None,
                "decision_quality": float(m.decision_quality) if m.decision_quality is not None else None,
                "anticipation": float(m.anticipation) if m.anticipation is not None else None,
                "transition_reset": float(m.transition_reset) if m.transition_reset is not None else None,
                "verbal_comm": float(m.verbal_comm) if m.verbal_comm is not None else None,
            }
            for m, ts, g in rows
        ]

    async def get_at_risk_players(
        self,
        min_sessions: int = 3,
        allowed_group_ids: set[uuid.UUID] | None = None,
    ) -> list[dict]:
        """
        Returns players whose last `min_sessions` non-absent measurements
        all have an average score below the group's avg insufficient_max.
        Groups without targets are excluded.
        """
        q = (
            select(Group)
            .options(joinedload(Group.targets))
            .where(Group.is_active.is_(True))
        )
        if allowed_group_ids is not None:
            q = q.where(Group.id.in_(allowed_group_ids))

        result = await self.db.execute(q)
        groups = result.scalars().unique().all()

        thresholds: dict[uuid.UUID, float] = {}
        group_names: dict[uuid.UUID, str] = {}
        for g in groups:
            group_names[g.id] = g.name
            if g.targets:
                thresholds[g.id] = sum(float(t.insufficient_max) for t in g.targets) / len(g.targets)

        if not thresholds:
            return []

        player_result = await self.db.execute(
            select(Player, PlayerGroupAssignment.group_id)
            .join(
                PlayerGroupAssignment,
                (PlayerGroupAssignment.player_id == Player.id)
                & PlayerGroupAssignment.is_current.is_(True),
            )
            .where(
                Player.is_active.is_(True),
                PlayerGroupAssignment.group_id.in_(thresholds.keys()),
            )
        )
        player_rows = player_result.all()

        player_ids = [p.id for p, _ in player_rows]
        player_to_group: dict[uuid.UUID, uuid.UUID] = {p.id: gid for p, gid in player_rows}

        # Single batch query replaces the previous per-player N+1 loop.
        all_meas_result = await self.db.execute(
            select(Measurement, TrainingSession.session_date)
            .join(TrainingSession, TrainingSession.id == Measurement.session_id)
            .where(
                Measurement.player_id.in_(player_ids),
                Measurement.is_absent.is_(False),
                Measurement.group_id.in_(thresholds.keys()),
            )
            .order_by(TrainingSession.session_date.desc())
        )
        all_meas = all_meas_result.all()

        measurements_by_player: dict[uuid.UUID, list[Measurement]] = defaultdict(list)
        for m, _ in all_meas:
            expected_gid = player_to_group.get(m.player_id)
            if expected_gid and m.group_id == expected_gid:
                bucket = measurements_by_player[m.player_id]
                if len(bucket) < min_sessions:
                    bucket.append(m)

        result_list = []
        for player, group_id in player_rows:
            threshold = thresholds[group_id]
            measurements = measurements_by_player.get(player.id, [])

            if len(measurements) < min_sessions:
                continue

            scores = []
            for m in measurements:
                vals = [float(getattr(m, f)) for f in _PARAM_FIELDS if getattr(m, f) is not None]
                if vals:
                    scores.append(sum(vals) / len(vals))

            if len(scores) < min_sessions or not all(s < threshold for s in scores):
                continue

            result_list.append({
                "player_id": str(player.id),
                "first_name": player.first_name,
                "last_name": player.last_name,
                "group_id": str(group_id),
                "group_name": group_names[group_id],
                "consecutive_low_sessions": min_sessions,
                "avg_score_last_session": round(scores[0], 2),
                "threshold": round(threshold, 2),
            })

        return result_list

    async def get_assignments(self, player_id: uuid.UUID) -> list[dict] | None:
        if not await self.db.get(Player, player_id):
            return None
        result = await self.db.execute(
            select(PlayerGroupAssignment, Group.name)
            .join(Group, Group.id == PlayerGroupAssignment.group_id)
            .where(PlayerGroupAssignment.player_id == player_id)
            .order_by(PlayerGroupAssignment.start_date.desc())
        )
        rows = result.all()
        return [
            {
                "id": a.id,
                "group_id": a.group_id,
                "group_name": name,
                "start_date": a.start_date,
                "end_date": a.end_date,
                "is_current": a.is_current,
            }
            for a, name in rows
        ]

    async def get_summary(
        self,
        player_id: uuid.UUID,
        season_id: uuid.UUID | None = None,
    ) -> PlayerSummaryResponse:
        # Match stats
        q_matches = (
            select(
                func.count(MatchLineup.match_id).label("matches_played"),
                func.coalesce(func.sum(MatchLineup.goals), 0).label("goals"),
                func.coalesce(func.sum(MatchLineup.assists), 0).label("assists"),
                func.avg(MatchLineup.rating).label("avg_rating"),
            )
            .join(Match, Match.id == MatchLineup.match_id)
            .where(MatchLineup.player_id == player_id)
        )
        if season_id:
            q_matches = q_matches.where(Match.season_id == season_id)
        match_row = (await self.db.execute(q_matches)).one()

        # Attendance stats
        q_att = select(
            func.count(Attendance.id).label("total"),
            func.count(Attendance.id).filter(Attendance.status == "present").label("present"),
        ).join(TrainingSession, TrainingSession.id == Attendance.session_id).where(
            Attendance.player_id == player_id
        )
        if season_id:
            q_att = q_att.where(TrainingSession.season_id == season_id)
        att_row = (await self.db.execute(q_att)).one()

        # Active injury (most recent without actual_return)
        inj_result = await self.db.execute(
            select(InjuryLog)
            .where(InjuryLog.player_id == player_id, InjuryLog.actual_return.is_(None))
            .order_by(InjuryLog.start_date.desc())
            .limit(1)
        )
        injury = inj_result.scalars().first()

        total = att_row.total or 0
        present = att_row.present or 0
        return PlayerSummaryResponse(
            matches_played=match_row.matches_played or 0,
            goals=int(match_row.goals or 0),
            assists=int(match_row.assists or 0),
            avg_rating=float(match_row.avg_rating) if match_row.avg_rating is not None else None,
            sessions_total=total,
            sessions_present=present,
            attendance_pct=round(present / total * 100, 1) if total > 0 else None,
            active_injury_type=injury.injury_type if injury else None,
            active_injury_since=injury.start_date if injury else None,
        )

    async def get_streak(self, player_id: uuid.UUID) -> dict:
        result = await self.db.execute(
            select(Measurement, TrainingSession.session_date)
            .join(TrainingSession, Measurement.session_id == TrainingSession.id)
            .where(
                Measurement.player_id == player_id,
                Measurement.is_absent.is_(False),
                TrainingSession.is_active.is_(True),
            )
            .order_by(TrainingSession.session_date.desc())
            .limit(30)
        )
        rows = result.all()

        OTTIMO_MIN = 8.0
        streak = 0
        for m, _ in rows:
            vals = [float(getattr(m, f)) for f in _PARAM_FIELDS if getattr(m, f) is not None]
            if not vals:
                break
            if sum(vals) / len(vals) >= OTTIMO_MIN:
                streak += 1
            else:
                break

        return {"streak": streak, "sessions_checked": len(rows)}

    async def assign_to_group(self, player_id: uuid.UUID, group_id: uuid.UUID) -> None:
        """Raises ValueError('player') or ValueError('group') if not found."""
        if await self.db.get(Player, player_id) is None:
            raise ValueError("player")
        if await self.db.get(Group, group_id) is None:
            raise ValueError("group")

        result = await self.db.execute(
            select(PlayerGroupAssignment)
            .where(
                PlayerGroupAssignment.player_id == player_id,
                PlayerGroupAssignment.is_current.is_(True),
            )
        )
        current = result.scalars().first()
        if current:
            current.end_date = date.today()
            current.is_current = False

        self.db.add(PlayerGroupAssignment(
            player_id=player_id,
            group_id=group_id,
            start_date=date.today(),
            is_current=True,
        ))
        await self.db.commit()

    async def bulk_assign_to_group(
        self, player_ids: list[uuid.UUID], group_id: uuid.UUID
    ) -> dict:
        """Assign multiple players to a group in one commit."""
        found_result = await self.db.execute(
            select(Player.id).where(Player.id.in_(player_ids))
        )
        found_players = {row.id for row in found_result.all()}

        current_result = await self.db.execute(
            select(PlayerGroupAssignment)
            .where(
                PlayerGroupAssignment.player_id.in_(player_ids),
                PlayerGroupAssignment.is_current.is_(True),
            )
        )
        current_assignments = {
            a.player_id: a
            for a in current_result.scalars().all()
        }

        assigned, not_found = [], []
        today = date.today()
        for pid in player_ids:
            if pid not in found_players:
                not_found.append(str(pid))
                continue

            current = current_assignments.get(pid)
            if current:
                current.end_date = today
                current.is_current = False

            self.db.add(PlayerGroupAssignment(
                player_id=pid,
                group_id=group_id,
                start_date=today,
                is_current=True,
            ))
            assigned.append(str(pid))

        if assigned:
            await self.db.commit()

        return {"assigned": len(assigned), "not_found": not_found}
