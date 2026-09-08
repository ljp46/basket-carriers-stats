#!/usr/bin/env python3
"""Collect and preserve EA FC Clubs matches for BASKET CARRIERS."""

from __future__ import annotations

import json
import os
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent
CONFIG_PATH = ROOT / "config.json"
DATA_PATH = ROOT / "data" / "matches.json"
STATUS_PATH = ROOT / "data" / "status.json"
BASE_URL = "https://proclubs.ea.com/api/fc"
MATCH_TYPES = ("leagueMatch", "friendlyMatch", "playoffMatch")

# Decoded from EA's match_event_aggregate_0 counters and verified against a
# known three-match BASKET CARRIERS session. Interceptions remain deliberately
# omitted until a second independent sample validates their event mapping.
EVENT_CODES = {
    "second_assists": "218",
    "through_passes": "152",
    "dribbles_completed": "174",
    "take_ons": "112",
}

HEADERS = {
    "accept": "application/json",
    "accept-language": "en-US,en;q=0.9",
    "sec-fetch-site": "same-origin",
    "user-agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 Chrome/141.0.0.0 Safari/537.36"
    ),
}


def load_json(path: Path, fallback: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return fallback


def write_json_atomic(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary_name = tempfile.mkstemp(prefix=path.name, dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(value, handle, indent=2, ensure_ascii=False, sort_keys=True)
            handle.write("\n")
        os.replace(temporary_name, path)
    finally:
        if os.path.exists(temporary_name):
            os.unlink(temporary_name)


def request_json(endpoint: str, params: dict[str, str]) -> Any:
    url = f"{BASE_URL}/{endpoint}?{urllib.parse.urlencode(params)}"
    request = urllib.request.Request(url, headers=HEADERS)
    last_error: Exception | None = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=25) as response:
                return json.load(response)
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            last_error = exc
            if attempt < 2:
                time.sleep(2 ** attempt)
    raise RuntimeError(f"EA request failed after three attempts: {last_error}")


def as_int(value: Any, default: int = 0) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def as_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def parse_events(raw: str | None) -> dict[str, int]:
    parsed: dict[str, int] = {}
    for item in (raw or "").split(","):
        if not item or ":" not in item:
            continue
        key, value = item.split(":", 1)
        parsed[key] = as_int(value)
    return parsed


def display_name(gamertag: str, aliases: dict[str, str]) -> str:
    direct = aliases.get(gamertag)
    if direct:
        return direct
    lowered = gamertag.casefold()
    return next((alias for name, alias in aliases.items() if name.casefold() == lowered), gamertag)


def normalize_profile(raw: dict[str, Any], aliases: dict[str, str]) -> dict[str, Any]:
    gamertag = raw.get("name", "Unknown")
    return {
        "display_name": display_name(gamertag, aliases),
        "gamertag": gamertag,
        "pro_name": raw.get("proName"),
        "height_cm": as_int(raw.get("proHeight")) or None,
        "overall": as_int(raw.get("proOverall")) or None,
        "nationality_id": raw.get("proNationality"),
        "preferred_position": raw.get("favoritePosition"),
        "position_id": raw.get("proPos"),
        "season": {
            "games_played": as_int(raw.get("gamesPlayed")),
            "win_rate": as_int(raw.get("winRate")),
            "goals": as_int(raw.get("goals")),
            "assists": as_int(raw.get("assists")),
            "average_rating": as_float(raw.get("ratingAve")),
            "motm": as_int(raw.get("manOfTheMatch")),
            "red_cards": as_int(raw.get("redCards")),
        },
    }


def normalize_player(player_id: str, raw: dict[str, Any], aliases: dict[str, str]) -> dict[str, Any]:
    events = parse_events(raw.get("match_event_aggregate_0"))
    name = raw.get("playername") or player_id
    return {
        "player_id": player_id,
        "gamertag": name,
        "display_name": display_name(name, aliases),
        "position_group": raw.get("pos", "unknown"),
        "archetype_id": raw.get("archetypeid"),
        "rating": as_float(raw.get("rating")),
        "goals": as_int(raw.get("goals")),
        "assists": as_int(raw.get("assists")),
        "shots": as_int(raw.get("shots")),
        "passes_made": as_int(raw.get("passesmade")),
        "passes_attempted": as_int(raw.get("passattempts")),
        "tackles_made": as_int(raw.get("tacklesmade")),
        "tackles_attempted": as_int(raw.get("tackleattempts")),
        "red_cards": as_int(raw.get("redcards")),
        "motm": as_int(raw.get("mom")),
        "seconds_played": as_int(raw.get("secondsPlayed")),
        "second_assists": events.get(EVENT_CODES["second_assists"], 0),
        "through_passes": events.get(EVENT_CODES["through_passes"], 0),
        "dribbles_completed": events.get(EVENT_CODES["dribbles_completed"], 0),
        "take_ons": events.get(EVENT_CODES["take_ons"], 0),
        "interceptions": None,
    }


def normalize_match(raw: dict[str, Any], match_type: str, config: dict[str, Any]) -> dict[str, Any] | None:
    club_id = str(config["club_id"])
    clubs = raw.get("clubs", {})
    own = clubs.get(club_id)
    if not own:
        return None

    opponent_entries = [(key, value) for key, value in clubs.items() if key != club_id]
    opponent_id, opponent = opponent_entries[0] if opponent_entries else ("unknown", {})
    own_score = as_int(own.get("goals", own.get("score")))
    opponent_score = as_int(own.get("goalsAgainst", opponent.get("score")))
    result = "W" if own_score > opponent_score else "L" if own_score < opponent_score else "D"

    player_groups = raw.get("players", {})
    own_players = player_groups.get(club_id, {})
    opponent_players = player_groups.get(opponent_id, {})
    timestamp = as_int(raw.get("timestamp"))
    return {
        "match_id": str(raw.get("matchId")),
        "timestamp": timestamp,
        "played_at": datetime.fromtimestamp(timestamp, timezone.utc).isoformat(),
        "match_type": match_type,
        "result": result,
        "score_for": own_score,
        "score_against": opponent_score,
        "winner_by_dnf": bool(as_int(own.get("winnerByDnf"))),
        "opponent": {
            "club_id": opponent_id,
            "name": opponent.get("details", {}).get("name", "Unknown club"),
            "human_players": len(opponent_players),
        },
        "human_players": len(own_players),
        "players": [
            normalize_player(player_id, player, config["players"])
            for player_id, player in own_players.items()
        ],
    }


def main() -> None:
    config = load_json(CONFIG_PATH, None)
    if not config:
        raise SystemExit("Missing or invalid config.json")

    previous = load_json(DATA_PATH, {"matches": [], "profiles": []})
    fetched: list[dict[str, Any]] = []
    failures: list[str] = []
    for match_type in MATCH_TYPES:
        try:
            response = request_json(
                "clubs/matches",
                {
                    "platform": config["platform"],
                    "clubIds": str(config["club_id"]),
                    "matchType": match_type,
                    "maxResultCount": "10",
                },
            )
            for raw_match in response if isinstance(response, list) else []:
                match = normalize_match(raw_match, match_type, config)
                if match:
                    fetched.append(match)
        except RuntimeError as exc:
            failures.append(f"{match_type}: {exc}")

    profiles = previous.get("profiles", [])
    try:
        member_response = request_json(
            "members/stats",
            {"platform": config["platform"], "clubId": str(config["club_id"])},
        )
        profiles = [
            normalize_profile(member, config["players"])
            for member in member_response.get("members", [])
            if display_name(member.get("name", ""), config["players"]) in config["players"].values()
        ]
    except RuntimeError as exc:
        failures.append(f"members/stats: {exc}")

    by_id = {str(match["match_id"]): match for match in previous.get("matches", [])}
    for match in fetched:
        by_id[str(match["match_id"])] = match
    matches = sorted(by_id.values(), key=lambda match: match["timestamp"], reverse=True)

    payload = {
        "club": {
            "club_id": str(config["club_id"]),
            "name": config["club_name"],
            "platform": config["platform"],
        },
        "event_code_status": {
            "verified": ["second_assists", "through_passes", "dribbles_completed", "take_ons"],
            "pending_validation": ["interceptions"],
        },
        "last_updated": datetime.now(timezone.utc).isoformat(),
        "profiles": profiles,
        "matches": matches,
    }
    write_json_atomic(DATA_PATH, payload)
    write_json_atomic(
        STATUS_PATH,
        {
            "ok": bool(fetched),
            "new_or_refreshed_matches": len(fetched),
            "stored_matches": len(matches),
            "profiles_refreshed": len(profiles),
            "failures": failures,
            "checked_at": payload["last_updated"],
        },
    )
    print(f"Stored {len(matches)} matches; fetched {len(fetched)} records; refreshed {len(profiles)} profiles.")
    if failures:
        print("Partial failures:", "; ".join(failures))
    if not fetched:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
