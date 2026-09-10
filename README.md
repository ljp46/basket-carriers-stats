# BASKET CARRIERS Stats

Automated EA SPORTS FC 26 Clubs match archive and session dashboard for club `8837357` on `common-gen5`.

## What it tracks

- Match results, opponents and human-player counts
- Ratings, goals, assists, shots, passes and tackles
- Verified encoded event counters for second assists, through passes, completed dribbles and take-ons
- Automatic session grouping and player comparisons for Bobby, Hole and Door

The collector runs hourly through GitHub Actions. It preserves matches beyond EA's rolling recent-match window and publishes the dashboard through GitHub Pages.

Interceptions use the verified EA event mapping stored in `collect.py`.

## Final FC 26 playoffs

The default dashboard is currently running its Playoff Night presentation. It aggregates playoff matches from `2026-09-10` into one campaign across sessions and assumes a 15-match limit. Both values live in `PLAYOFF_CONFIG` at the top of `app.js`.

The exact standard dashboard immediately before this redesign is preserved in Git history at commit `30b26d7` (and locally by the tag `fc26-pre-playoffs-layout`). The playoff colour system is also isolated behind the `playoff-season` class on `<body>`, so the normal skin can be restored independently of the data archive.

## Manual refresh

Open **Actions → Collect FC Clubs matches → Run workflow** to collect immediately after a session.

This is an unofficial community project and is not affiliated with or endorsed by Electronic Arts.
