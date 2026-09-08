# BASKET CARRIERS Stats

Automated EA SPORTS FC 26 Clubs match archive and session dashboard for club `8837357` on `common-gen5`.

## What it tracks

- Match results, opponents and human-player counts
- Ratings, goals, assists, shots, passes and tackles
- Verified encoded event counters for second assists, through passes, completed dribbles and take-ons
- Automatic session grouping and player comparisons for Bobby, Hole and Door

The collector runs hourly through GitHub Actions. It preserves matches beyond EA's rolling recent-match window and publishes the dashboard through GitHub Pages.

Interceptions are intentionally shown as pending until their encoded event mapping is validated against another known session.

## Manual refresh

Open **Actions → Collect FC Clubs matches → Run workflow** to collect immediately after a session.

This is an unofficial community project and is not affiliated with or endorsed by Electronic Arts.
