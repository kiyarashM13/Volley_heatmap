"""Export attack directions from a DataVolley file.

Parsing is done by pydatavolley, the Python port of the R datavolley
package (https://datavolley.openvolley.org/). Court coordinates use the
same openvolley system: x in [0, 4], y in [0, 7], net at y = 3.5.
"""

from __future__ import annotations

import json
import math
import re
import sys
import warnings
from pathlib import Path

warnings.filterwarnings("ignore")

import pandas as pd
from datavolley import read_dv

# Zone centres on the lower half of an openvolley court.
# Zone 4 (front left, facing the net) is (1, 3), matching dv_xy(4, "lower").
LOWER_ZONES = {
    "1": (3.0, 1.0),
    "2": (3.0, 3.0),
    "3": (2.0, 3.0),
    "4": (1.0, 3.0),
    "5": (1.0, 1.0),
    "6": (2.0, 1.0),
    "7": (1.0, 2.0),
    "8": (2.0, 2.0),
    "9": (3.0, 2.0),
}

# Subzone letters split a zone into four quadrants.
SUBZONE = {
    "A": (-0.22, -0.22),
    "B": (0.22, -0.22),
    "C": (-0.22, 0.22),
    "D": (0.22, 0.22),
}

SKILL_RE = re.compile(r"^[*a](\d+)([SREABDF])")
HIT_CODES = {"H": "hard", "T": "tip", "P": "soft"}


def _missing(value) -> bool:
    if value is None:
        return True
    try:
        if pd.isna(value):
            return True
    except TypeError:
        return False
    if isinstance(value, float) and math.isnan(value):
        return True
    text = str(value).strip()
    return text in {"", "nan", "None", "~", "-1-1"}


def _num(value):
    if _missing(value):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _int(value):
    number = _num(value)
    if number is None:
        return None
    return int(number)


def _zone(value):
    if _missing(value):
        return None
    text = str(value).strip()
    if text.endswith(".0"):
        text = text[:-2]
    return text if text in LOWER_ZONES else None


def _flip(x, y):
    return 4.0 - x, 7.0 - y


def _on_court(x: float | None, y: float | None) -> bool:
    if x is None or y is None:
        return False
    return -0.35 <= x <= 4.35 and -0.35 <= y <= 7.6


def _place(zone: str | None, subzone: str | None, upper: bool):
    if zone is None:
        return None
    x, y = LOWER_ZONES[zone]
    if upper:
        x, y = _flip(x, y)
    dx, dy = SUBZONE.get(subzone or "", (0.0, 0.0))
    if upper:
        dx, dy = -dx, -dy
    return x + dx, y + dy


def _hit(code: str) -> str:
    match = SKILL_RE.match(code or "")
    if not match:
        return "other"
    payload = code[match.start(2) :]
    if len(payload) <= 9:
        return "other"
    return HIT_CODES.get(payload[9], "other")


def _phase(value) -> str:
    if _missing(value):
        return "other"
    text = str(value)
    if text == "Reception":
        return "reception"
    if "Transition" in text:
        return "transition"
    return "other"


def _rotation(row) -> int | None:
    team = "" if _missing(row.get("team")) else str(row.get("team"))
    home = "" if _missing(row.get("home_team")) else str(row.get("home_team"))
    raw = row.get("home_setter_position") if team == home else row.get("visiting_setter_position")
    number = _int(raw)
    if number is None or number < 1 or number > 6:
        return None
    return number


def export_match(path: Path, file_name: str | None = None) -> dict:
    match = read_dv.DataVolley(str(path))
    plays = match.get_plays()
    attacks = plays[plays["skill"] == "Attack"] if "skill" in plays.columns else plays.iloc[0:0]

    exported = []
    unplotted = 0
    for _, row in attacks.iterrows():
        code = "" if _missing(row.get("code")) else str(row.get("code"))
        sub = None if _missing(row.get("end_subzone")) else str(row.get("end_subzone")).strip()[:1]
        start = (_num(row.get("start_coordinate_x")), _num(row.get("start_coordinate_y")))
        end = (_num(row.get("end_coordinate_x")), _num(row.get("end_coordinate_y")))
        mid = (_num(row.get("mid_coordinate_x")), _num(row.get("mid_coordinate_y")))
        located = "coordinate"
        # A few VolleyStation rows store an end index far outside the 0–7 court.
        if not _on_court(start[0], start[1]):
            start = (None, None)
        if not _on_court(end[0], end[1]):
            end = (None, None)
            located = "zone"
        if not _on_court(mid[0], mid[1]):
            mid = (None, None)

        if start[0] is None or start[1] is None:
            placed = _place(_zone(row.get("start_zone")), None, upper=False)
            if placed is None:
                unplotted += 1
                continue
            start = placed
            located = "zone"
        if end[0] is None or end[1] is None:
            placed = _place(_zone(row.get("end_zone")), sub, upper=True)
            if placed is None:
                unplotted += 1
                continue
            end = placed
            located = "zone"

        sx, sy = start
        ex, ey = end
        mx, my = mid
        if sy > 3.5:
            sx, sy = _flip(sx, sy)
            ex, ey = _flip(ex, ey)
            if mx is not None and my is not None:
                mx, my = _flip(mx, my)

        player_number = "" if _missing(row.get("player_number")) else str(row.get("player_number")).strip()
        if player_number.endswith(".0"):
            player_number = player_number[:-2]
        player_name = "" if _missing(row.get("player_name")) else str(row.get("player_name")).strip()
        evaluation = "" if _missing(row.get("evaluation_code")) else str(row.get("evaluation_code")).strip()

        exported.append(
            {
                "team": "" if _missing(row.get("team")) else str(row.get("team")).strip(),
                "playerNumber": player_number,
                "playerName": player_name,
                "evaluation": evaluation,
                "phase": _phase(row.get("attack_phase")),
                "hit": _hit(code),
                "rotation": _rotation(row),
                "setNumber": _int(row.get("set_number")),
                "attackCode": None if _missing(row.get("attack_code")) else str(row.get("attack_code")).strip(),
                "startZone": _zone(row.get("start_zone")),
                "endZone": _zone(row.get("end_zone")),
                "located": located,
                "sx": round(sx, 4),
                "sy": round(sy, 4),
                "ex": round(ex, 4),
                "ey": round(ey, 4),
                "mx": None if mx is None else round(mx, 4),
                "my": None if my is None else round(my, 4),
            }
        )

    def sets_won(value):
        try:
            if value is None or value == "":
                return None
            return int(value)
        except (TypeError, ValueError):
            return None

    return {
        "fileName": file_name or path.name,
        "homeTeam": match.home_team,
        "visitingTeam": match.visiting_team,
        "homeSets": sets_won(match.home_setswon),
        "visitingSets": sets_won(match.visiting_setswon),
        "unplotted": unplotted,
        "attacks": exported,
    }


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: export_match.py <file.dvw> | --sample", file=sys.stderr)
        return 2
    if sys.argv[1] == "--sample":
        path = Path(__file__).resolve().parent / "fixtures" / "ukr-rom-2026.dvw"
        file_name = "2026-09-20 EC UKR-ROM.dvw"
    else:
        path = Path(sys.argv[1])
        file_name = Path(sys.argv[2]).name if len(sys.argv) > 2 else path.name
    if not path.is_file():
        print(f"file not found: {path}", file=sys.stderr)
        return 1
    try:
        payload = export_match(path, file_name)
    except Exception as exc:  # noqa: BLE001 - surface parser failures to the API
        print(str(exc), file=sys.stderr)
        return 1
    json.dump(payload, sys.stdout, ensure_ascii=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
