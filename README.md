# BASKET CARRIERS Stats

Automated EA SPORTS FC 27 Clubs match archive and dashboard for BASKET CARRIERS, club `27257` on `common-gen5`.

The collector runs hourly through GitHub Actions, keeps matches beyond EA's rolling recent-match window, and publishes the dashboard through GitHub Pages. The dashboard shows the current squad, session and player totals, milestone honours, record watch, departures, and a museum for former player identities.

## Player changes

The fictional player identity owns the stats, not the human controlling the EA account. For a new identity, archive the outgoing player's career and move their card to the museum. Add the new account to `config.json` only when its gamertag and player identity are known; its stats must begin at its own registration point. Never map a replacement account to the former player's display name or transfer the former player's EA career totals.

`config.json` maps active gamertags to player identities. `player_identity_history` keeps earlier matches under their original identity through a timestamp. The collector preserves all matches from the known club ID, including rows for an as-yet-unknown account, and reapplies identity mappings to the saved archive when an account is registered. `data/matches.json` also contains frozen `former_players` career snapshots used to retain archived honours.

Wormax Hippyhair (`Leechy1234335`) transferred for £175M after his last archived appearance on 13 October 2026 (`through_timestamp: 1791920363`). His 58 appearances, 118 goals, 23 assists and other career stats are frozen in the FC27 museum and `former_players`. Leech's replacement account and new player are pending. Before registering them, check saved unknown-player match rows and establish the new identity's start and any EA season-stat offsets so it starts at zero without losing matches already captured.

## Manual refresh

Open **Actions → Collect FC Clubs matches → Run workflow** to collect immediately after a session.

This is an unofficial community project and is not affiliated with or endorsed by Electronic Arts.
