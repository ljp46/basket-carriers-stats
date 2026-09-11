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
MILESTONE_THRESHOLDS = {
    "games_played": (50, 100, 150, 200, 250, 300, 400, 500),
    "goals": (50, 100, 150, 200, 250, 300, 400, 500),
    "assists": (50, 100, 150, 200, 250, 300, 400, 500),
    "contributions": (100, 200, 300, 400, 500, 750, 1000),
    "motm": (10, 25, 50, 75, 100, 150, 200),
}

# Decoded from EA's match event counters and verified against independent
# three-match BASKET CARRIERS sessions. Interceptions can spill into a later
# aggregate field for players with a larger event payload.
EVENT_CODES = {
    "second_assists": "218",
    "through_passes": "152",
    "dribbles_completed": "174",
    "take_ons": "112",
    "interceptions": "6",
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


def matching_club_ids(payload: Any, club_name: str) -> list[str]:
    """Return every exact-name club ID from EA's leaderboard search response."""
    wanted = club_name.casefold().strip()
    found: set[str] = set()

    def visit(value: Any) -> None:
        if isinstance(value, list):
            for item in value:
                visit(item)
            return
        if not isinstance(value, dict):
            return

        info = value.get("clubInfo") if isinstance(value.get("clubInfo"), dict) else value
        name = info.get("name") or info.get("clubName")
        club_id = info.get("clubId") or info.get("club_id") or info.get("id")
        if name and club_id and str(name).casefold().strip() == wanted:
            found.add(str(club_id))

        for child in value.values():
            if child is not info:
                visit(child)

    visit(payload)
    return sorted(found)


def exact_club_records(payload: Any, club_name: str) -> list[dict[str, Any]]:
    """Return exact-name leaderboard rows while preserving their aggregate stats."""
    wanted = club_name.casefold().strip()
    records: list[dict[str, Any]] = []

    def visit(value: Any) -> None:
        if isinstance(value, list):
            for item in value:
                visit(item)
            return
        if not isinstance(value, dict):
            return
        info = value.get("clubInfo") if isinstance(value.get("clubInfo"), dict) else {}
        name = value.get("clubName") or value.get("name") or info.get("name")
        if name and str(name).casefold().strip() == wanted:
            records.append(value)
            # A leaderboard row can contain clubInfo; do not record it twice.
            return
        for child in value.values():
            if child is not info:
                visit(child)

    visit(payload)
    return records


def matching_overall_stats(payload: Any, club_id: str) -> dict[str, Any] | None:
    """Unwrap EA's aggregate club stats response for the requested club."""
    wanted = str(club_id)
    candidates = payload if isinstance(payload, list) else [payload]
    for value in candidates:
        if not isinstance(value, dict):
            continue
        if str(value.get("clubId")) == wanted:
            return value
    return None


def playoff_summary(record: dict[str, Any]) -> dict[str, int]:
    """Normalize the current leaderboard row used when EA withholds match details."""
    wins = as_int(record.get("wins"))
    draws = as_int(record.get("ties"))
    losses = as_int(record.get("losses"))
    games_played = as_int(record.get("gamesPlayedPlayoff"))
    if not games_played:
        games_played = wins + draws + losses
    goals_for = as_int(record.get("goals"))
    goals_against = as_int(record.get("goalsAgainst"))
    return {
        "games_played": games_played,
        "wins": wins,
        "draws": draws,
        "losses": losses,
        "points": wins * 3 + draws,
        "goals_for": goals_for,
        "goals_against": goals_against,
        "goal_difference": goals_for - goals_against,
        "clean_sheets": as_int(record.get("cleanSheets")),
    }


def match_has_configured_player(raw: dict[str, Any], club_id: str, aliases: dict[str, str]) -> bool:
    """Reject same-name clubs unless one of our configured players appears."""
    own_players = raw.get("players", {}).get(str(club_id), {})
    configured = {name.casefold() for name in aliases}
    return any(
        str(player.get("playername") or player_id).casefold() in configured
        for player_id, player in own_players.items()
    )


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
    interception_events: dict[str, int] = {}
    for index in range(4):
        for code, value in parse_events(raw.get(f"match_event_aggregate_{index}")).items():
            interception_events[code] = interception_events.get(code, 0) + value
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
        "interceptions": interception_events.get(EVENT_CODES["interceptions"], 0),
    }


def profile_totals(profile: dict[str, Any]) -> dict[str, int]:
    season = profile.get("season", {})
    goals = as_int(season.get("goals"))
    assists = as_int(season.get("assists"))
    return {
        "games_played": as_int(season.get("games_played")),
        "goals": goals,
        "assists": assists,
        "contributions": goals + assists,
        "motm": as_int(season.get("motm")),
    }


def update_milestones(
    previous: dict[str, Any], profiles: list[dict[str, Any]], matches: list[dict[str, Any]], detected_at: str
) -> list[dict[str, Any]]:
    milestones = list(previous.get("milestones", []))
    known = {
        (item.get("player"), item.get("metric"), as_int(item.get("threshold")))
        for item in milestones
    }
    old_profiles = {item.get("display_name"): item for item in previous.get("profiles", [])}
    latest_match_id = str(matches[0]["match_id"]) if matches else None

    for profile in profiles:
        player = profile.get("display_name")
        current = profile_totals(profile)
        old_profile = old_profiles.get(player)
        old = profile_totals(old_profile) if old_profile else {}
        for metric, thresholds in MILESTONE_THRESHOLDS.items():
            for threshold in thresholds:
                if current[metric] < threshold or (player, metric, threshold) in known:
                    continue
                witnessed = bool(old_profile and old.get(metric, 0) < threshold <= current[metric])
                milestones.append({
                    "player": player,
                    "metric": metric,
                    "threshold": threshold,
                    "value_when_detected": current[metric],
                    "detected_at": detected_at,
                    "celebrate_match_id": latest_match_id if witnessed else None,
                    "baseline": not witnessed,
                })
                known.add((player, metric, threshold))
    return milestones


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
    source_club_ids = {str(config["club_id"])}
    current_playoff_summary: dict[str, int] | None = None
    overall_stats_by_club: dict[str, dict[str, Any]] = {}
    try:
        current_season = request_json(
            "currentSeasonLeaderboard/search",
            {"platform": config["platform"], "clubName": config["club_name"]},
        )
        current_records = exact_club_records(current_season, config["club_name"])
        source_club_ids.update(matching_club_ids(current_season, config["club_name"]))
        if current_records:
            current_playoff_summary = playoff_summary(current_records[0])
    except RuntimeError as exc:
        failures.append(f"current season search: {exc}")
    try:
        club_search = request_json(
            "allTimeLeaderboard/search",
            {"platform": config["platform"], "clubName": config["club_name"]},
        )
        source_club_ids.update(matching_club_ids(club_search, config["club_name"]))
    except RuntimeError as exc:
        failures.append(f"club search: {exc}")

    match_type_counts: dict[str, int] = {}
    newest_by_club: dict[str, int] = {}
    for club_id in sorted(source_club_ids):
        candidate_config = {**config, "club_id": club_id}
        try:
            overall_response = request_json(
                "clubs/overallStats",
                {"platform": config["platform"], "clubIds": club_id},
            )
            overall = matching_overall_stats(overall_response, club_id)
            if overall:
                diagnostic_fields = (
                    "gamesPlayed", "gamesPlayedPlayoff", "wins", "ties", "losses",
                    "goals", "goalsAgainst", "lastMatch0", "lastMatch1", "lastMatch2",
                    "lastOpponent0", "lastOpponent1", "lastOpponent2",
                )
                overall_stats_by_club[club_id] = {
                    field: overall.get(field) for field in diagnostic_fields
                }
        except RuntimeError as exc:
            failures.append(f"{club_id}:overallStats: {exc}")
        for match_type in MATCH_TYPES:
            source_key = f"{club_id}:{match_type}"
            try:
                response = request_json(
                    "clubs/matches",
                    {
                        "platform": config["platform"],
                        "clubIds": club_id,
                        "matchType": match_type,
                        "maxResultCount": "10",
                    },
                )
                raw_matches = response if isinstance(response, list) else []
                match_type_counts[source_key] = len(raw_matches)
                for raw_match in raw_matches:
                    if not match_has_configured_player(raw_match, club_id, config["players"]):
                        continue
                    match = normalize_match(raw_match, match_type, candidate_config)
                    if match:
                        fetched.append(match)
                        newest_by_club[club_id] = max(newest_by_club.get(club_id, 0), match["timestamp"])
            except RuntimeError as exc:
                failures.append(f"{source_key}: {exc}")

    active_club_id = max(newest_by_club, key=newest_by_club.get, default=str(config["club_id"]))

    profiles = previous.get("profiles", [])
    try:
        member_response = request_json(
            "members/stats",
            {"platform": config["platform"], "clubId": active_club_id},
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

    updated_at = datetime.now(timezone.utc).isoformat()
    milestones = update_milestones(previous, profiles, matches, updated_at)
    payload = {
        "club": {
            "club_id": active_club_id,
            "name": config["club_name"],
            "platform": config["platform"],
            "playoff_summary": current_playoff_summary,
        },
        "event_code_status": {
            "verified": ["second_assists", "through_passes", "dribbles_completed", "take_ons"],
            "pending_validation": ["interceptions"],
        },
        "last_updated": updated_at,
        "profiles": profiles,
        "milestones": milestones,
        "matches": matches,
    }
    write_json_atomic(DATA_PATH, payload)
    write_json_atomic(
        STATUS_PATH,
        {
            "ok": bool(fetched or current_playoff_summary),
            "new_or_refreshed_matches": len(fetched),
            "stored_matches": len(matches),
            "profiles_refreshed": len(profiles),
            "source_club_ids": sorted(source_club_ids),
            "match_type_counts": match_type_counts,
            "overall_stats": overall_stats_by_club,
            "failures": failures,
            "checked_at": payload["last_updated"],
        },
    )
    print(
        f"Stored {len(matches)} matches; fetched {len(fetched)} records from "
        f"{len(source_club_ids)} club ID(s); refreshed {len(profiles)} profiles."
    )
    print("Match sources:", json.dumps(match_type_counts, sort_keys=True))
    print("Overall stats:", json.dumps(overall_stats_by_club, sort_keys=True))
    if failures:
        print("Partial failures:", "; ".join(failures))
    if not fetched and not current_playoff_summary:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
