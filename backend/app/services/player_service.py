from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models.assignment import PlayerGroupAssignment
from app.models.group import Group
from app.models.measurement import Measurement
from app.models.player import Player
from app.models.training_session import TrainingSession
from app.schemas.player import PlayerCreate, PlayerUpdate

_PARAM_FIELDS = ('scanning_rate', 'decision_quality', 'anticipation', 'transition_reset', 'verbal_comm')


class PlayerService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def list(
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
                self.db.query(Player, Group.name)
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
                self.db.query(Player, Group.name)
                .join(
                    PlayerGroupAssignment,
                    (PlayerGroupAssignment.player_id == Player.id)
                    & PlayerGroupAssignment.is_current.is_(True),
                )
                .join(Group, Group.id == PlayerGroupAssignment.group_id)
                .filter(
                    Player.is_active.is_(True),
                    PlayerGroupAssignment.group_id.in_(allowed_group_ids),
                )
                .order_by(Player.last_name.asc(), Player.first_name.asc())
            )
        else:
            q = (
                self.db.query(Player, Group.name)
                .outerjoin(
                    PlayerGroupAssignment,
                    (PlayerGroupAssignment.player_id == Player.id)
                    & PlayerGroupAssignment.is_current.is_(True),
                )
                .outerjoin(Group, Group.id == PlayerGroupAssignment.group_id)
                .filter(Player.is_active.is_(True))
                .order_by(Player.last_name.asc(), Player.first_name.asc())
            )
        return q.offset(skip).limit(limit).all()

    def count(
        self,
        group_id: uuid.UUID | None = None,
        allowed_group_ids: set[uuid.UUID] | None = None,
    ) -> int:
        if group_id is not None:
            return (
                self.db.query(func.count(Player.id))
                .join(
                    PlayerGroupAssignment,
                    (PlayerGroupAssignment.player_id == Player.id)
                    & (PlayerGroupAssignment.group_id == group_id)
                    & PlayerGroupAssignment.is_current.is_(True),
                )
                .scalar()
                or 0
            )
        elif allowed_group_ids is not None:
            return (
                self.db.query(func.count(Player.id))
                .join(
                    PlayerGroupAssignment,
                    (PlayerGroupAssignment.player_id == Player.id)
                    & PlayerGroupAssignment.is_current.is_(True),
                )
                .filter(
                    Player.is_active.is_(True),
                    PlayerGroupAssignment.group_id.in_(allowed_group_ids),
                )
                .scalar()
                or 0
            )
        else:
            return (
                self.db.query(func.count(Player.id))
                .filter(Player.is_active.is_(True))
                .scalar()
                or 0
            )

    def create(self, body: PlayerCreate) -> Player:
        player = Player(**body.model_dump(exclude={"group_id"}))
        self.db.add(player)
        self.db.commit()
        self.db.refresh(player)

        if body.group_id:
            assignment = PlayerGroupAssignment(
                player_id=player.id,
                group_id=body.group_id,
                start_date=date.today(),
                is_current=True,
            )
            self.db.add(assignment)
            self.db.commit()

        return player

    def get(self, player_id: uuid.UUID) -> Player | None:
        return self.db.get(Player, player_id)

    def get_with_group(
        self,
        player_id: uuid.UUID,
        allowed_group_ids: set[uuid.UUID] | None = None,
    ) -> tuple[Player, str | None] | None:
        q = (
            self.db.query(Player, Group.name)
            .outerjoin(
                PlayerGroupAssignment,
                (PlayerGroupAssignment.player_id == Player.id)
                & PlayerGroupAssignment.is_current.is_(True),
            )
            .outerjoin(Group, Group.id == PlayerGroupAssignment.group_id)
            .filter(Player.id == player_id, Player.is_active.is_(True))
        )
        if allowed_group_ids is not None:
            q = q.filter(PlayerGroupAssignment.group_id.in_(allowed_group_ids))
        return q.first()

    def update(self, player_id: uuid.UUID, body: PlayerUpdate) -> Player | None:
        player = self.db.get(Player, player_id)
        if player is None:
            return None
        for field, value in body.model_dump(exclude_none=True).items():
            setattr(player, field, value)
        self.db.commit()
        self.db.refresh(player)
        return player

    def deactivate(self, player_id: uuid.UUID) -> bool:
        player = self.db.get(Player, player_id)
        if player is None:
            return False
        player.is_active = False
        self.db.commit()
        return True

    def get_history(
        self,
        player_id: uuid.UUID,
        allowed_group_ids: set[uuid.UUID] | None = None,
    ) -> list[dict]:
        """
        allowed_group_ids=None → storia completa (admin/responsabile).
        allowed_group_ids=set  → solo sessioni nei gruppi dell'allenatore.
        Filtro applicato a livello DB, non in Python.
        """
        q = (
            self.db.query(Measurement, TrainingSession, Group)
            .join(TrainingSession, TrainingSession.id == Measurement.session_id)
            .join(Group, Group.id == TrainingSession.group_id)
            .filter(
                Measurement.player_id == player_id,
                Measurement.is_absent.is_(False),
            )
        )
        if allowed_group_ids is not None:
            q = q.filter(TrainingSession.group_id.in_(allowed_group_ids))

        rows = q.order_by(TrainingSession.session_date.asc()).all()
        return [
            {
                "session_id": str(m.session_id),
                "session_date": str(ts.session_date),
                "session_type": ts.session_type,
                "group_id": str(ts.group_id),
                "group_name": g.name,
                "scanning_rate": float(m.scanning_rate) if m.scanning_rate is not None else None,
                "decision_quality": float(m.decision_quality) if m.decision_quality is not None else None,
                "anticipation": float(m.anticipation) if m.anticipation is not None else None,
                "transition_reset": float(m.transition_reset) if m.transition_reset is not None else None,
                "verbal_comm": float(m.verbal_comm) if m.verbal_comm is not None else None,
                "is_absent": m.is_absent,
            }
            for m, ts, g in rows
        ]

    def get_at_risk_players(
        self,
        min_sessions: int = 3,
        allowed_group_ids: set[uuid.UUID] | None = None,
    ) -> list[dict]:
        """
        Returns players whose last `min_sessions` non-absent measurements
        all have an average score below the group's avg insufficient_max.
        Groups without targets are excluded.
        """
        group_q = (
            self.db.query(Group)
            .options(joinedload(Group.targets))
            .filter(Group.is_active.is_(True))
        )
        if allowed_group_ids is not None:
            group_q = group_q.filter(Group.id.in_(allowed_group_ids))

        thresholds: dict[uuid.UUID, float] = {}
        group_names: dict[uuid.UUID, str] = {}
        for g in group_q.all():
            group_names[g.id] = g.name
            if g.targets:
                thresholds[g.id] = sum(float(t.insufficient_max) for t in g.targets) / len(g.targets)

        if not thresholds:
            return []

        player_rows = (
            self.db.query(Player, PlayerGroupAssignment.group_id)
            .join(
                PlayerGroupAssignment,
                (PlayerGroupAssignment.player_id == Player.id)
                & PlayerGroupAssignment.is_current.is_(True),
            )
            .filter(
                Player.is_active.is_(True),
                PlayerGroupAssignment.group_id.in_(thresholds.keys()),
            )
            .all()
        )

        result = []
        for player, group_id in player_rows:
            threshold = thresholds[group_id]

            measurements = (
                self.db.query(Measurement)
                .join(TrainingSession, TrainingSession.id == Measurement.session_id)
                .filter(
                    Measurement.player_id == player.id,
                    Measurement.is_absent.is_(False),
                    TrainingSession.group_id == group_id,
                )
                .order_by(TrainingSession.session_date.desc())
                .limit(min_sessions)
                .all()
            )

            if len(measurements) < min_sessions:
                continue

            scores = []
            for m in measurements:
                vals = [float(getattr(m, f)) for f in _PARAM_FIELDS if getattr(m, f) is not None]
                if vals:
                    scores.append(sum(vals) / len(vals))

            if len(scores) < min_sessions or not all(s < threshold for s in scores):
                continue

            result.append({
                "player_id": str(player.id),
                "first_name": player.first_name,
                "last_name": player.last_name,
                "group_id": str(group_id),
                "group_name": group_names[group_id],
                "consecutive_low_sessions": min_sessions,
                "avg_score_last_session": round(scores[0], 2),
                "threshold": round(threshold, 2),
            })

        return result

    def assign_to_group(self, player_id: uuid.UUID, group_id: uuid.UUID) -> bool:
        """Returns False if player not found."""
        player = self.db.get(Player, player_id)
        if player is None:
            return False

        current = (
            self.db.query(PlayerGroupAssignment)
            .filter(
                PlayerGroupAssignment.player_id == player_id,
                PlayerGroupAssignment.is_current.is_(True),
            )
            .first()
        )
        if current:
            current.end_date = date.today()
            current.is_current = False

        self.db.add(PlayerGroupAssignment(
            player_id=player_id,
            group_id=group_id,
            start_date=date.today(),
            is_current=True,
        ))
        self.db.commit()
        return True
