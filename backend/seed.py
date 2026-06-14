#!/usr/bin/env python3
"""Seed script — idempotente: skippa i record già presenti."""

import os
import sys
from datetime import date
from decimal import Decimal

sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal
from app.models import Group, GroupTarget, Season

SEASON_NAME = "2026-2027"

GROUPS = [
    # (name, category, birth_year, level, sub_group, max_players)
    ("Esordienti U13 2014 A", "Esordienti",  2014, "alto",        "A", 18),
    ("Esordienti U13 2014 B", "Esordienti",  2014, "medio",       "B", 18),
    ("Esordienti U12 2015 A", "Esordienti",  2015, "medio/alto",  "A", 18),
    ("Esordienti U12 2015 B", "Esordienti",  2015, "medio/basso", "B", 18),
    ("Pulcini U11 2016 A",    "Pulcini",     2016, "medio",       "A", 14),
    ("Pulcini U11 2016 B",    "Pulcini",     2016, "basso",       "B", 14),
    ("Pulcini U10 2017 A",    "Pulcini",     2017, "medio/alto",  "A", 14),
    ("Pulcini U10 2017 B",    "Pulcini",     2017, "basso",       "B", 14),
    ("Primi Calci U9 2018 A", "Primi Calci", 2018, "alto",        "A", 10),
]

# {group_name: {parameter: (insufficient_max, ottimo_min)}}
TARGETS: dict[str, dict[str, tuple[int, int]]] = {
    "Esordienti U13 2014 A": {"SR": (5, 9), "DQI": (6, 9), "AI": (5, 9), "TRS": (5, 9), "VCI": (6, 9)},
    "Esordienti U13 2014 B": {"SR": (4, 8), "DQI": (5, 8), "AI": (4, 8), "TRS": (4, 8), "VCI": (5, 8)},
    "Esordienti U12 2015 A": {"SR": (4, 8), "DQI": (4, 8), "AI": (3, 8), "TRS": (4, 8), "VCI": (4, 9)},
    "Esordienti U12 2015 B": {"SR": (3, 7), "DQI": (3, 7), "AI": (2, 7), "TRS": (3, 7), "VCI": (3, 8)},
    "Pulcini U11 2016 A":    {"SR": (3, 7), "DQI": (3, 7), "AI": (3, 6), "TRS": (3, 7), "VCI": (4, 7)},
    "Pulcini U11 2016 B":    {"SR": (2, 6), "DQI": (2, 6), "AI": (2, 5), "TRS": (2, 6), "VCI": (3, 6)},
    "Pulcini U10 2017 A":    {"SR": (3, 7), "DQI": (2, 7), "AI": (2, 7), "TRS": (3, 7), "VCI": (3, 8)},
    "Pulcini U10 2017 B":    {"SR": (2, 5), "DQI": (1, 5), "AI": (1, 5), "TRS": (2, 5), "VCI": (2, 6)},
    "Primi Calci U9 2018 A": {"SR": (3, 6), "DQI": (3, 6), "AI": (3, 6), "TRS": (3, 6), "VCI": (4, 7)},
}


def main() -> None:
    db = SessionLocal()
    try:
        # 1. Stagione
        season = db.query(Season).filter_by(name=SEASON_NAME).first()
        if season is None:
            season = Season(
                name=SEASON_NAME,
                start_date=date(2026, 9, 1),
                end_date=date(2027, 6, 15),
                is_current=True,
            )
            db.add(season)
            db.flush()
            print(f"[+] Stagione '{SEASON_NAME}' creata.")
        else:
            print(f"[=] Stagione '{SEASON_NAME}' già presente.")

        # 2. Gruppi
        group_map: dict[str, Group] = {}
        for name, category, birth_year, level, sub_group, max_players in GROUPS:
            g = db.query(Group).filter_by(name=name, season_id=season.id).first()
            if g is None:
                g = Group(
                    season_id=season.id,
                    name=name,
                    category=category,
                    birth_year=birth_year,
                    level=level,
                    sub_group=sub_group,
                    max_players=max_players,
                )
                db.add(g)
                db.flush()
                print(f"  [+] Gruppo '{name}' creato.")
            else:
                print(f"  [=] Gruppo '{name}' già presente.")
            group_map[name] = g

        # 3. Target
        for group_name, params in TARGETS.items():
            g = group_map[group_name]
            for param, (insuff, ottimo) in params.items():
                t = db.query(GroupTarget).filter_by(group_id=g.id, parameter=param).first()
                if t is None:
                    db.add(
                        GroupTarget(
                            group_id=g.id,
                            parameter=param,
                            insufficient_max=Decimal(insuff),
                            ottimo_min=Decimal(ottimo),
                        )
                    )
                    print(f"    [+] Target {group_name} / {param} ({insuff}/{ottimo}) creato.")
                else:
                    print(f"    [=] Target {group_name} / {param} già presente.")
            db.flush()

        db.commit()
        print("\nSeed completato con successo.")
    except Exception as exc:
        db.rollback()
        print(f"\nErrore durante il seed: {exc}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
