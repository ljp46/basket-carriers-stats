# BASKET CARRIERS Stats

Automated EA SPORTS FC 27 Clubs match archive and dashboard for BASKET CARRIERS, club `27257` on `common-gen5`.

The collector runs hourly through GitHub Actions, keeps matches beyond EA's rolling recent-match window, and publishes the dashboard through GitHub Pages. The dashboard shows the current squad, session and player totals, milestone honours, record watch, departures, and a museum for former player identities.

## Wacky Wombats (from 29 October 2026)

The squad moved to a new club, WACKY WOMBATS. The collector now archives that club, with `kidljp46` as Little Magician (88), `Leechy1234335` as Robin Banks (32) and `Sidney257965`/`Joe97618` as Lamin Jawara. Everyone starts from zero at the new club.

The club ID is `1991204`, found by name after the first match on 29 October 2026 and now set in `config.json`. For a future club, `club_id` can be left blank: each run then searches EA for the exact club name and only accepts a same-name club whose matches include a configured player. The first match found stores the ID in `data/matches.json`, and later runs reuse it. Until then the run stays green and reports `waiting_for_club` in `data/status.json`.

Basket Carriers is retired. Its FC27 archive is frozen in `data/archive/basket-carriers-fc27.json` (with its old config alongside), and the collector never writes to it. That file's `former_players` holds the frozen careers of Wormax, Trey and Basket Carriers-era Lamin, which the dashboard shows in the museum and on the honours wall. The main page shows the Wacky Wombats squad from `data/matches.json` and ignores that file until it holds the new club.

Player images in `assets/` are 800×1200 transparent cutouts, bottom-aligned. When replacing one, keep that format and bump its `?v=` query in `index.html` and `app.js` so browsers fetch the new file.

## Player changes

The fictional player identity owns the stats, not the human controlling the EA account. For a new identity, archive the outgoing player's career and move their card to the museum. Add the new account to `config.json` only when its gamertag and player identity are known; its stats must begin at its own registration point. Never map a replacement account to the former player's display name or transfer the former player's EA career totals.

`config.json` maps active gamertags to player identities. `player_identity_history` keeps earlier matches under their original identity through a timestamp. The collector preserves all matches from the known club ID, including rows for an as-yet-unknown account, and reapplies identity mappings to the saved archive when an account is registered. `data/matches.json` also contains frozen `former_players` career snapshots used to retain archived honours.

Wormax Hippyhair (`Leechy1234335`) transferred for £175M after his last archived appearance on 13 October 2026 (`through_timestamp: 1791920363`). His 58 appearances, 118 goals, 23 assists and other career stats are frozen in the FC27 museum and `former_players`. Leech's replacement account and new player are pending. Before registering them, check saved unknown-player match rows and establish the new identity's start and any EA season-stat offsets so it starts at zero without losing matches already captured.

## Manual refresh

Open **Actions → Collect FC Clubs matches → Run workflow** to collect immediately after a session.

The dashboard shows **ARCHIVE DELAYED** if a successful collection has not been published for six hours. If EA returns HTTP 403 to GitHub Actions, the failed run leaves `data/matches.json` unchanged. Running `python collect.py` from a connection EA accepts and committing the updated `data/` files can preserve the recent matches while the hosted collector is unavailable; EA only returns its latest 10 matches per type.

This is an unofficial community project and is not affiliated with or endorsed by Electronic Arts.
