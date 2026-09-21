#!/usr/bin/env python3
"""Read-only FC27 Clubs API schema diagnostic for Basket Carriers."""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


BASE_URL = "https://proclubs.ea.com/api/fc"
PLATFORM = "common-gen5"
CLUB_ID = "27257"
MATCH_TYPES = ("leagueMatch", "friendlyMatch", "playoffMatch")
OUTPUT = Path("fc27-diagnostic.json")
HEADERS = {
    "accept": "application/json",
    "accept-language": "en-US,en;q=0.9",
    "sec-fetch-site": "same-origin",
    "user-agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 Chrome/153.0.0.0 Safari/537.36"
    ),
}


def request_json(endpoint: str, params: dict[str, str]) -> Any:
    url = f"{BASE_URL}/{endpoint}?{urllib.parse.urlencode(params)}"
    request = urllib.request.Request(url, headers=HEADERS)
    last_error: Exception | None = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return json.load(response)
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            last_error = exc
            if attempt < 2:
                time.sleep(2**attempt)
    raise RuntimeError(str(last_error))


def scalar(value: Any) -> bool:
    return value is None or isinstance(value, (str, int, float, bool))


def schema_inventory(payload: Any) -> dict[str, Any]:
    paths: dict[str, set[str]] = defaultdict(set)
    sample_values: dict[str, dict[str, Any]] = defaultdict(dict)
    event_codes: dict[str, dict[str, Any]] = defaultdict(
        lambda: {"occurrences": 0, "values": set(), "aggregate_fields": set()}
    )
    player_rows: list[dict[str, Any]] = []

    def visit(value: Any, path: str = "$") -> None:
        if isinstance(value, list):
            paths[path].add("[]")
            for item in value:
                visit(item, f"{path}[]")
            return
        if not isinstance(value, dict):
            return

        paths[path].update(str(key) for key in value)
        for key, child in value.items():
            key = str(key)
            if scalar(child) and key not in sample_values[path]:
                sample_values[path][key] = child
            if key.startswith("match_event_aggregate_") and isinstance(child, str):
                for item in child.split(","):
                    if ":" not in item:
                        continue
                    code, amount = item.split(":", 1)
                    record = event_codes[code]
                    record["occurrences"] += 1
                    record["values"].add(amount)
                    record["aggregate_fields"].add(key)
            visit(child, f"{path}.{key}")

        if "playername" in value:
            player_rows.append(
                {
                    "playername": value.get("playername"),
                    "keys": sorted(value),
                    "samples": {
                        key: child
                        for key, child in value.items()
                        if scalar(child)
                    },
                }
            )

    visit(payload)
    return {
        "paths": {path: sorted(keys) for path, keys in sorted(paths.items())},
        "samples": dict(sorted(sample_values.items())),
        "event_codes": {
            code: {
                "occurrences": item["occurrences"],
                "values": sorted(item["values"]),
                "aggregate_fields": sorted(item["aggregate_fields"]),
            }
            for code, item in sorted(event_codes.items(), key=lambda pair: int(pair[0]))
        },
        "player_rows": player_rows,
    }


def fetch(label: str, endpoint: str, params: dict[str, str]) -> dict[str, Any]:
    try:
        payload = request_json(endpoint, params)
    except RuntimeError as exc:
        return {"ok": False, "error": str(exc)}
    return {
        "ok": True,
        "response_type": type(payload).__name__,
        "schema": schema_inventory(payload),
        "raw": payload,
    }


def main() -> None:
    common = {"platform": PLATFORM}
    report: dict[str, Any] = {
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "club_id": CLUB_ID,
        "platform": PLATFORM,
        "endpoints": {},
    }
    endpoints = report["endpoints"]
    endpoints["club_info"] = fetch(
        "club_info", "clubs/info", {**common, "clubIds": CLUB_ID}
    )
    endpoints["overall_stats"] = fetch(
        "overall_stats", "clubs/overallStats", {**common, "clubIds": CLUB_ID}
    )
    endpoints["members"] = fetch(
        "members", "members/stats", {**common, "clubId": CLUB_ID}
    )
    for match_type in MATCH_TYPES:
        endpoints[f"matches_{match_type}"] = fetch(
            f"matches_{match_type}",
            "clubs/matches",
            {
                **common,
                "clubIds": CLUB_ID,
                "matchType": match_type,
                "maxResultCount": "10",
            },
        )

    OUTPUT.write_text(
        json.dumps(report, indent=2, ensure_ascii=False, sort_keys=True) + "\n",
        encoding="utf-8",
    )

    summary = {
        name: {
            "ok": result["ok"],
            "top_level_type": result.get("response_type"),
            "event_codes": sorted(result.get("schema", {}).get("event_codes", {})),
            "player_rows": len(result.get("schema", {}).get("player_rows", [])),
            "error": result.get("error"),
        }
        for name, result in endpoints.items()
    }
    print("FC27_DIAGNOSTIC_SUMMARY=" + json.dumps(summary, sort_keys=True))
    if not any(item["ok"] for item in endpoints.values()):
        raise SystemExit("Every FC27 API request failed")


if __name__ == "__main__":
    main()
