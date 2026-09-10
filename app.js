const SESSION_GAP_SECONDS = 60 * 60;
const PLAYER_ORDER = ["Bobby", "Hole", "Door"];
const ARCHETYPES = {"8": "Maestro", "11": "Magician"};
const PLAYER_META = {
  Bobby: {fullName: "Ricky Bobby", number: "29", comparison: "Bradley Barcola", playoffLabel: "THE OUTLET", image: "assets/players/barcola-29-cutout.webp", imageClass: "cutout"},
  Hole: {fullName: "Closed Hole", number: "51", comparison: "Lionel Messi", playoffLabel: "THE CONNECTOR", image: "assets/players/messi.jpeg", imageClass: "photo messi"},
  Door: {fullName: "Car Door", number: "47", comparison: "Jorginho", playoffLabel: "THE CONTROL", image: "assets/players/jorginho.jpeg", imageClass: "photo jorginho"}
};
const PLAYOFF_CONFIG = {
  startAt: "2026-09-10T00:00:00Z",
  totalMatches: 15
};
const PLAYOFF_TARGETS = [
  {rank: "1ST", label: "THE CROWN", club: "Big4snortmore", played: "15 / 15", points: 45, goalDifference: 68},
  {rank: "TOP 100", label: "THE LINE", club: "FC Hagen Hagen", points: 30, goalDifference: 32}
];
const MILESTONE_THRESHOLDS = {
  games_played: [50, 100, 150, 200, 250, 300, 400, 500],
  goals: [50, 100, 150, 200, 250, 300, 400, 500],
  assists: [50, 100, 150, 200, 250, 300, 400, 500],
  contributions: [100, 200, 300, 400, 500, 750, 1000],
  motm: [10, 25, 50, 75, 100, 150, 200]
};
const MILESTONE_LABELS = {
  games_played: "appearances", goals: "club goals", assists: "assists",
  contributions: "goal contributions", motm: "POTM awards"
};

const sum = (items, key) => items.reduce((total, item) => total + (Number(item[key]) || 0), 0);
const pct = (made, attempted) => attempted ? `${Math.round((made / attempted) * 100)}%` : "—";
const oneDecimal = value => Number(value || 0).toFixed(1);
const signed = value => `${value > 0 ? "+" : ""}${oneDecimal(value)}`;
const contributionInvolvement = (player, goals) => goals ? pct(Number(player.goals) + Number(player.assists), goals) : "—";
const metresToFeet = cm => {
  if (!cm) return "—";
  const inches = Math.round(Number(cm) / 2.54);
  return `${Math.floor(inches / 12)}'${inches % 12}\"`;
};

function groupSessions(matches) {
  const chronological = [...matches].sort((a, b) => a.timestamp - b.timestamp);
  const sessions = [];
  for (const match of chronological) {
    const current = sessions.at(-1);
    if (!current || match.timestamp - current.at(-1).timestamp > SESSION_GAP_SECONDS) sessions.push([match]);
    else current.push(match);
  }
  return sessions.reverse().map(session => session.sort((a, b) => b.timestamp - a.timestamp));
}

function aggregatePlayers(matches) {
  const groups = new Map();
  for (const match of matches) {
    for (const player of match.players) {
      if (!groups.has(player.display_name)) groups.set(player.display_name, []);
      groups.get(player.display_name).push(player);
    }
  }
  return PLAYER_ORDER.map(name => {
    const appearances = groups.get(name) || [];
    return {
      name,
      appearances: appearances.length,
      archetype_id: appearances.find(player => player.archetype_id)?.archetype_id,
      rating: appearances.length ? sum(appearances, "rating") / appearances.length : 0,
      goals: sum(appearances, "goals"), assists: sum(appearances, "assists"),
      second_assists: sum(appearances, "second_assists"), shots: sum(appearances, "shots"),
      passes_made: sum(appearances, "passes_made"), passes_attempted: sum(appearances, "passes_attempted"),
      tackles_made: sum(appearances, "tackles_made"), tackles_attempted: sum(appearances, "tackles_attempted"),
      through_passes: sum(appearances, "through_passes"),
      dribbles_completed: sum(appearances, "dribbles_completed"), take_ons: sum(appearances, "take_ons"),
      interceptions: sum(appearances, "interceptions"), motm: sum(appearances, "motm")
    };
  });
}

function sessionLabel(matches, index) {
  const date = new Date(matches.at(-1).timestamp * 1000);
  return `${index === 0 ? "Latest · " : ""}${date.toLocaleDateString(undefined, {day:"numeric", month:"short", year:"numeric"})} · ${matches.length} games`;
}

function playerProfile(data, player) {
  const profile = (data.profiles || []).find(item => item.display_name === player.name) || {};
  return {
    height: profile.height_cm ? `${profile.height_cm} cm · ${metresToFeet(profile.height_cm)}` : "Height pending",
    overall: profile.overall ? `${profile.overall} OVR` : null,
    archetype: ARCHETYPES[String(player.archetype_id)] || "Archetype pending"
  };
}

function profileTotals(profile = {}) {
  const season = profile.season || {};
  const goals = Number(season.goals) || 0;
  const assists = Number(season.assists) || 0;
  return {
    games_played: Number(season.games_played) || 0,
    goals,
    assists,
    contributions: goals + assists,
    motm: Number(season.motm) || 0
  };
}

function formState(recentRating, ratingDelta, outputDelta = 0) {
  if (recentRating >= 8.8 || (recentRating >= 8.4 && outputDelta >= .65)) return {label: "On fire", className: "hot"};
  if (ratingDelta >= .35 || outputDelta >= .75) return {label: "Rising", className: "rising"};
  if (recentRating >= 8) return {label: "Strong", className: "strong"};
  if (ratingDelta <= -.45 || outputDelta <= -1) return {label: "Cooling", className: "cooling"};
  if (recentRating < 7) return {label: "Searching", className: "searching"};
  return {label: "Steady", className: "steady"};
}

function teamFormState(ppg, delta) {
  if (ppg >= 2.4) return {label: "On fire", className: "hot"};
  if (delta >= .6) return {label: "Rising", className: "rising"};
  if (ppg >= 1.8) return {label: "Strong", className: "strong"};
  if (delta <= -.6) return {label: "Cooling", className: "cooling"};
  if (ppg < 1) return {label: "Searching", className: "searching"};
  return {label: "Steady", className: "steady"};
}

function pointsPerGame(matches) {
  if (!matches.length) return 0;
  return matches.reduce((total, match) => total + (match.result === "W" ? 3 : match.result === "D" ? 1 : 0), 0) / matches.length;
}

function renderForm(data) {
  const allMatches = [...(data.matches || [])].sort((a, b) => b.timestamp - a.timestamp);
  const recentTeam = allMatches.slice(0, 5);
  const priorTeam = allMatches.slice(5, 10);
  const ppg = pointsPerGame(recentTeam);
  const priorPpg = pointsPerGame(priorTeam);
  const teamState = teamFormState(ppg, priorTeam.length ? ppg - priorPpg : 0);
  const teamFor = sum(recentTeam, "score_for");
  const teamAgainst = sum(recentTeam, "score_against");
  const sequence = [...recentTeam].reverse().map(match => `<span class="form-result ${match.result}">${match.result}</span>`).join("");
  const teamCard = `
    <article class="form-card team-form">
      <div class="form-top"><div><p class="label">BASKET CARRIERS</p><h3>Team form</h3></div><span class="form-status ${teamState.className}">${teamState.label}</span></div>
      <div class="form-sequence">${sequence}</div>
      <div class="form-stats">
        <div><strong>${oneDecimal(ppg)}</strong><span>Points / game</span></div>
        <div><strong>${teamFor}–${teamAgainst}</strong><span>Goal balance</span></div>
        <div><strong>${priorTeam.length ? signed(ppg - priorPpg) : "—"}</strong><span>PPG movement</span></div>
      </div>
      <p class="form-context">${recentTeam.length} most recent match${recentTeam.length === 1 ? "" : "es"}; the arrow only becomes meaningful once ten are stored.</p>
    </article>`;

  const playerCards = PLAYER_ORDER.map(name => {
    const appearances = allMatches.map(match => match.players.find(player => player.display_name === name)).filter(Boolean);
    const recent = appearances.slice(0, 5);
    const prior = appearances.slice(5, 10);
    const recentRating = recent.length ? sum(recent, "rating") / recent.length : 0;
    const priorRating = prior.length ? sum(prior, "rating") / prior.length : recentRating;
    const recentOutput = recent.length ? (sum(recent, "goals") + sum(recent, "assists")) / recent.length : 0;
    const priorOutput = prior.length ? (sum(prior, "goals") + sum(prior, "assists")) / prior.length : recentOutput;
    const state = formState(recentRating, recentRating - priorRating, recentOutput - priorOutput);
    const meta = PLAYER_META[name];
    const passesMade = sum(recent, "passes_made");
    const passesAttempted = sum(recent, "passes_attempted");
    const roleMetric = name === "Door"
      ? `<div><strong>${oneDecimal(sum(recent, "through_passes") / Math.max(recent.length, 1))}</strong><span>Throughs / game</span></div>`
      : `<div><strong>${pct(sum(recent, "goals"), sum(recent, "shots"))}</strong><span>Conversion</span></div>`;
    return `
      <article class="form-card player-form">
        <div class="form-top"><div><p class="label">#${meta.number}</p><h3>${meta.fullName}</h3></div><span class="form-status ${state.className}">${state.label}</span></div>
        <div class="form-stats">
          <div><strong>${oneDecimal(recentRating)}</strong><span>Avg rating</span></div>
          <div><strong>${oneDecimal(recentOutput)}</strong><span>G+A / game</span></div>
          <div><strong>${prior.length ? signed(recentRating - priorRating) : "—"}</strong><span>Rating movement</span></div>
          ${roleMetric}
          <div><strong>${pct(passesMade, passesAttempted)}</strong><span>Pass accuracy</span></div>
        </div>
        <p class="form-context">Last ${recent.length} appearance${recent.length === 1 ? "" : "s"} versus the previous ${prior.length || "pending"}.</p>
      </article>`;
  }).join("");
  document.querySelector("#form").innerHTML = teamCard + playerCards;
}

function renderMilestones(data) {
  const profiles = new Map((data.profiles || []).map(profile => [profile.display_name, profile]));
  document.querySelector("#milestones").innerHTML = PLAYER_ORDER.map(name => {
    const meta = PLAYER_META[name];
    const totals = profileTotals(profiles.get(name));
    const honours = Object.entries(MILESTONE_THRESHOLDS).map(([metric, thresholds]) => {
      const reached = thresholds.filter(threshold => threshold <= totals[metric]).at(-1);
      return reached ? {metric, threshold: reached} : null;
    }).filter(Boolean);
    const targets = Object.entries(MILESTONE_THRESHOLDS).map(([metric, thresholds]) => {
      const target = thresholds.find(threshold => threshold > totals[metric]);
      return target ? {metric, target, away: target - totals[metric]} : null;
    }).filter(Boolean).sort((a, b) => a.away - b.away);
    const next = targets[0];
    return `
      <article class="milestone-card">
        <div class="milestone-player"><span class="milestone-number">${meta.number}</span><div><p class="label">HONOURS</p><h3>${meta.fullName}</h3></div></div>
        <div class="honour-list">${honours.length ? honours.map(item => `<span><strong>${item.threshold}</strong>${MILESTONE_LABELS[item.metric]}</span>`).join("") : `<span class="honour-pending">First landmark loading…</span>`}</div>
        ${next ? `<div class="next-landmark"><span>Next landmark</span><strong>${next.target} ${MILESTONE_LABELS[next.metric]}</strong><small>${next.away} away</small></div>` : ""}
      </article>`;
  }).join("");
  }

function renderCareer(data) {
  const profiles = new Map((data.profiles || []).map(profile => [profile.display_name, profile]));
  const tracked = new Map(aggregatePlayers(data.matches || []).map(player => [player.name, player]));
  document.querySelector("#career-stats").innerHTML = PLAYER_ORDER.map(name => {
    const meta = PLAYER_META[name];
    const profile = profiles.get(name) || {};
    const season = profile.season || {};
    const totals = profileTotals(profile);
    const archive = tracked.get(name) || {};
    const appearances = Math.max(totals.games_played, 1);
    return `
      <article class="career-card">
        <header><div><p class="label">#${meta.number} · CLUB CAREER</p><h4>${meta.fullName}</h4></div><strong>${totals.games_played}</strong></header>
        <p class="career-section-label">EA cumulative record</p>
        <div class="career-total-grid">
          <div><strong>${totals.goals}</strong><span>Goals</span></div>
          <div><strong>${totals.assists}</strong><span>Assists</span></div>
          <div><strong>${totals.contributions}</strong><span>G+A</span></div>
          <div><strong>${oneDecimal(totals.goals / appearances)}</strong><span>Goals / app</span></div>
          <div><strong>${oneDecimal(totals.assists / appearances)}</strong><span>Assists / app</span></div>
          <div><strong>${oneDecimal(totals.contributions / appearances)}</strong><span>G+A / app</span></div>
          <div><strong>${totals.motm}</strong><span>POTM</span></div>
          <div><strong>${oneDecimal(season.average_rating)}</strong><span>Avg rating</span></div>
          <div><strong>${season.win_rate ?? "—"}%</strong><span>Win rate</span></div>
          <div><strong>${season.red_cards ?? 0}</strong><span>Red cards</span></div>
        </div>
        <p class="career-section-label tracked-label">Tracked advanced archive · ${archive.appearances || 0} matches</p>
        <div class="career-advanced-grid">
          <div><span>Goals / assists</span><strong>${archive.goals || 0} / ${archive.assists || 0}</strong></div>
          <div><span>Second assists</span><strong>${archive.second_assists || 0}</strong></div>
          <div><span>Shots · conversion</span><strong>${archive.shots || 0} · ${pct(archive.goals, archive.shots)}</strong></div>
          <div><span>Passes · accuracy</span><strong>${archive.passes_made || 0}/${archive.passes_attempted || 0} · ${pct(archive.passes_made, archive.passes_attempted)}</strong></div>
          <div><span>Through passes</span><strong>${archive.through_passes || 0}</strong></div>
          <div><span>Dribbles · take-ons</span><strong>${archive.dribbles_completed || 0} · ${archive.take_ons || 0}</strong></div>
          <div><span>Tackles</span><strong>${archive.tackles_made || 0}/${archive.tackles_attempted || 0}</strong></div>
          <div><span>Archive rating</span><strong>${oneDecimal(archive.rating)}</strong></div>
        </div>
      </article>`;
  }).join("");
}

function celebrationFor(data, playerName, matches) {
  const matchIds = new Set(matches.map(match => String(match.match_id)));
  return (data.milestones || []).filter(item => item.player === playerName && item.celebrate_match_id && matchIds.has(String(item.celebrate_match_id))).at(-1);
}

function renderMatchPlayer(player, teamGoals) {
  const contribution = contributionInvolvement(player, teamGoals);
  const meta = PLAYER_META[player.display_name] || {fullName: player.display_name, number: "—"};
  return `
    <article class="match-player">
      <header>
        <div><h4><span class="mini-number">${meta.number}</span>${meta.fullName}</h4><span>${player.position_group || "player"}</span></div>
        <div class="match-rating">${oneDecimal(player.rating)}</div>
      </header>
      ${player.motm ? `<div class="motm-badge">★ PLAYER OF THE MATCH</div>` : ""}
      <div class="match-headline"><strong>${player.goals}G · ${player.assists}A</strong><span>${contribution} involvement</span></div>
      <div class="match-stat-grid">
        <div><span>Second assists</span><strong>${player.second_assists}</strong></div>
        <div><span>Shots</span><strong>${player.shots}</strong></div>
        <div><span>Conversion</span><strong>${pct(player.goals, player.shots)}</strong></div>
        <div><span>Passes</span><strong>${player.passes_made}/${player.passes_attempted}</strong></div>
        <div><span>Pass accuracy</span><strong>${pct(player.passes_made, player.passes_attempted)}</strong></div>
        <div><span>Through passes</span><strong>${player.through_passes}</strong></div>
        <div><span>Completed dribbles</span><strong>${player.dribbles_completed}</strong></div>
        <div><span>Take-ons</span><strong>${player.take_ons}</strong></div>
        <div><span>Tackles</span><strong>${player.tackles_made}/${player.tackles_attempted}</strong></div>
        <div><span>Tackle success</span><strong>${pct(player.tackles_made, player.tackles_attempted)}</strong></div>
        <div><span>Interceptions</span><strong>${player.interceptions ?? 0}</strong></div>
      </div>
    </article>`;
}

function renderMatchCard(match, index, prefix = "match") {
  const motm = match.players.find(player => player.motm);
  const orderedPlayers = PLAYER_ORDER.map(name => match.players.find(player => player.display_name === name)).filter(Boolean);
  return `
    <details class="match" id="${prefix}-${match.match_id}" ${index === 0 ? "open" : ""}>
      <summary>
        <span class="result ${match.result}">${match.result}</span>
        <div><div class="opponent">${match.opponent.name}</div><div class="meta">${new Date(match.timestamp * 1000).toLocaleString()}</div></div>
        <div class="match-context">
          <span class="humans">${match.human_players}v${match.opponent.human_players} humans</span>
          ${motm ? `<span class="motm-summary">★ ${(PLAYER_META[motm.display_name] || {fullName: motm.display_name}).fullName} POTM</span>` : ""}
        </div>
        <div class="score">${match.score_for}–${match.score_against}</div>
        <span class="chevron" aria-hidden="true">⌄</span>
      </summary>
      <div class="match-details">
        <div class="match-detail-note">Contribution involvement counts goals plus assists as a share of the club’s goals in this match.</div>
        <div class="match-player-grid">${orderedPlayers.map(player => renderMatchPlayer(player, match.score_for)).join("")}</div>
      </div>
    </details>`;
}

function playoffMatchesFrom(matches) {
  const start = Date.parse(PLAYOFF_CONFIG.startAt) / 1000;
  const inWindow = [...matches].filter(match => Number(match.timestamp) >= start).sort((a, b) => a.timestamp - b.timestamp);
  const explicitlyPlayoffs = inWindow.filter(match => match.match_type === "playoffMatch");
  return (explicitlyPlayoffs.length ? explicitlyPlayoffs : inWindow).slice(0, PLAYOFF_CONFIG.totalMatches);
}

function renderPlayoffTargets(points, goalDifference, gamesPlayed) {
  const remaining = Math.max(0, PLAYOFF_CONFIG.totalMatches - gamesPlayed);
  const maxPoints = points + remaining * 3;

  document.querySelector("#playoff-targets").innerHTML = PLAYOFF_TARGETS.map((target, index) => {
    const pointsOff = Math.max(0, target.points - points);
    const goalDifferenceOff = Math.max(0, target.goalDifference - goalDifference);
    const goalDifferenceToPass = Math.max(0, target.goalDifference + 1 - goalDifference);
    const pointsPace = remaining ? pointsOff / remaining : null;
    const marginPace = remaining ? goalDifferenceToPass / remaining : null;
    const cleared = points > target.points || (points === target.points && goalDifference > target.goalDifference);
    const reachable = maxPoints >= target.points;
    const pointsProgress = target.points ? Math.min(100, Math.max(0, (points / target.points) * 100)) : 100;
    const gdProgress = target.goalDifference ? Math.min(100, Math.max(0, (goalDifference / target.goalDifference) * 100)) : 100;
    let status = "IN THE CHASE";
    if (cleared) status = "TARGET CLEARED";
    else if (!remaining) status = "RUN COMPLETE";
    else if (!reachable) status = "NO LONGER REACHABLE";
    else if (maxPoints === target.points) status = "PERFECT POINTS · GD DECIDES";

    return `<article class="target-card target-${index === 0 ? "crown" : "line"}">
      <div class="target-stamp"><span>${target.rank}</span><strong>${target.label}</strong></div>
      <div class="target-club"><p>${target.played ? `${target.played} PLAYED · ` : ""}${target.points} PTS · +${target.goalDifference} GD</p><h3>${target.club}</h3></div>
      <div class="target-live-status ${cleared ? "cleared" : reachable ? "active" : "closed"}">${status}</div>
      <div class="target-bars">
        <div><span>POINTS</span><strong>${points}<small> / ${target.points}</small></strong><i style="--target-progress:${pointsProgress}%"></i></div>
        <div><span>GOAL DIFFERENCE</span><strong>${goalDifference > 0 ? "+" : ""}${goalDifference}<small> / +${target.goalDifference}</small></strong><i style="--target-progress:${gdProgress}%"></i></div>
      </div>
      <div class="target-metrics">
        <div><strong>${pointsOff}</strong><span>POINTS OFF</span></div>
        <div><strong>${goalDifferenceOff}</strong><span>GD OFF</span></div>
        <div><strong>${pointsPace === null ? "—" : oneDecimal(pointsPace)}</strong><span>PPG TO MATCH</span></div>
        <div><strong>${marginPace === null ? "—" : `+${marginPace.toFixed(2)}`}</strong><span>AVG WIN MARGIN TO PASS</span></div>
      </div>
      <p class="target-route">${cleared
        ? `Basket Carriers are ahead of this mark.`
        : remaining
          ? `${remaining} game${remaining === 1 ? "" : "s"} left · ${pointsOff} point${pointsOff === 1 ? "" : "s"} to match · +${goalDifferenceToPass} GD needed to pass the tiebreak.`
          : `${pointsOff} point${pointsOff === 1 ? "" : "s"} and ${goalDifferenceToPass} GD short of passing this mark.`}</p>
    </article>`;
  }).join("");
}

function renderPlayoffs(data) {
  const matches = playoffMatchesFrom(data.matches || []);
  const wins = matches.filter(match => match.result === "W").length;
  const draws = matches.filter(match => match.result === "D").length;
  const losses = matches.filter(match => match.result === "L").length;
  const points = wins * 3 + draws;
  const goalsFor = sum(matches, "score_for");
  const goalsAgainst = sum(matches, "score_against");
  const goalDifference = goalsFor - goalsAgainst;
  const players = aggregatePlayers(matches);
  const chapters = groupSessions(matches).reverse();

  document.querySelector("#playoff-points").textContent = points;
  document.querySelector("#playoff-record").textContent = `${wins}–${draws}–${losses}`;
  document.querySelector("#playoff-progress").textContent = `${matches.length} of ${PLAYOFF_CONFIG.totalMatches} complete`;
  document.querySelector("#playoff-kpis").innerHTML = [
    [PLAYOFF_CONFIG.totalMatches - matches.length, "Games remaining"],
    [goalsFor, "Goals for"],
    [goalsAgainst, "Goals against"],
    [goalDifference > 0 ? `+${goalDifference}` : goalDifference, "Goal difference"],
    [matches.length ? oneDecimal(points / matches.length) : "—", "Points / game"],
    [matches.filter(match => match.score_against === 0).length, "Clean sheets"]
  ].map(([value, label]) => `<div><strong>${value}</strong><span>${label}</span></div>`).join("");

  renderPlayoffTargets(points, goalDifference, matches.length);

  document.querySelector("#playoff-journey").innerHTML = Array.from({length: PLAYOFF_CONFIG.totalMatches}, (_, index) => {
    const match = matches[index];
    if (!match) return `<span class="journey-game pending"><b>${String(index + 1).padStart(2, "0")}</b><small>WAITING</small></span>`;
    return `<button class="journey-game complete ${match.result}" type="button" data-match-target="playoff-${match.match_id}" aria-label="Game ${index + 1}, ${match.result} ${match.score_for} to ${match.score_against} against ${match.opponent.name}"><b>${match.result}</b><strong>${match.score_for}–${match.score_against}</strong><small>${String(index + 1).padStart(2, "0")}</small></button>`;
  }).join("");

  document.querySelector("#playoff-players").innerHTML = players.map(player => {
    const meta = PLAYER_META[player.name];
    return `
      <article class="playoff-player-card player-${player.name.toLowerCase()}">
        <img class="player-ghost ${meta.imageClass}" src="${meta.image}" alt="" />
        <div class="playoff-player-top"><div><p class="label">#${meta.number} · ${meta.playoffLabel}</p><h3>${meta.fullName}</h3></div><span class="playoff-rating">${player.appearances ? oneDecimal(player.rating) : "—"}</span></div>
        <div class="playoff-output"><strong>${player.goals + player.assists}</strong><span>GOAL<br />CONTRIBUTIONS</span></div>
        <div class="playoff-player-stats">
          <div><strong>${player.goals}</strong><span>Goals</span></div>
          <div><strong>${player.assists}</strong><span>Assists</span></div>
          <div><strong>${player.motm}</strong><span>POTM</span></div>
          <div><strong>${player.shots}</strong><span>Shots</span></div>
          <div><strong>${pct(player.goals, player.shots)}</strong><span>Conversion</span></div>
          <div><strong>${pct(player.passes_made, player.passes_attempted)}</strong><span>Pass accuracy</span></div>
          <div><strong>${player.through_passes}</strong><span>Through passes</span></div>
          <div><strong>${player.interceptions}</strong><span>Interceptions</span></div>
        </div>
      </article>`;
  }).join("");

  document.querySelector("#playoff-sessions").innerHTML = chapters.length ? chapters.map((session, index) => {
    const sessionWins = session.filter(match => match.result === "W").length;
    const sessionDraws = session.filter(match => match.result === "D").length;
    const sessionLosses = session.filter(match => match.result === "L").length;
    const sessionPoints = sessionWins * 3 + sessionDraws;
    const date = new Date(session.at(-1).timestamp * 1000).toLocaleDateString(undefined, {day: "numeric", month: "long"});
    return `<article class="playoff-session-card"><div><p class="label">NIGHT ${String(index + 1).padStart(2, "0")}</p><h3>${date}</h3></div><strong>${sessionPoints}<span>PTS</span></strong><div class="chapter-results">${[...session].reverse().map(match => `<span class="${match.result}">${match.result}</span>`).join("")}</div><p>${sessionWins}–${sessionDraws}–${sessionLosses} · ${session.length} game${session.length === 1 ? "" : "s"}</p></article>`;
  }).join("") : `<div class="playoff-empty"><strong>The stage is set.</strong><span>The first playoff session will become Night 01.</span></div>`;

  document.querySelector("#playoff-matches").innerHTML = matches.length
    ? [...matches].reverse().map((match, index) => renderMatchCard(match, index, "playoff")).join("")
    : `<div class="playoff-empty"><strong>No whistle yet.</strong><span>Completed playoff games will appear here after the match feed updates.</span></div>`;

  const leader = [...players].sort((a, b) => (b.goals + b.assists) - (a.goals + a.assists) || b.rating - a.rating)[0];
  const signals = matches.length ? [
    `<strong>Points pace:</strong> ${oneDecimal(points / matches.length)} per game through ${matches.length} fixture${matches.length === 1 ? "" : "s"}.`,
    `<strong>Leading the run:</strong> ${PLAYER_META[leader.name].fullName} has ${leader.goals + leader.assists} direct contribution${leader.goals + leader.assists === 1 ? "" : "s"}.`,
    `<strong>Defensive level:</strong> ${oneDecimal(goalsAgainst / matches.length)} conceded per game with ${matches.filter(match => match.score_against === 0).length} clean sheet${matches.filter(match => match.score_against === 0).length === 1 ? "" : "s"}.`,
    `<strong>Campaign shape:</strong> ${chapters.length} session${chapters.length === 1 ? "" : "s"} completed; ${PLAYOFF_CONFIG.totalMatches - matches.length} games remain.`
  ] : [
    `<strong>Opening night:</strong> The playoff tracker is ready for the first result.`,
    `<strong>Full campaign:</strong> Player totals and sessions will combine automatically across all fifteen games.`
  ];
  document.querySelector("#playoff-signals").innerHTML = signals.map(text => `<div class="signal">${text}</div>`).join("");
}

function setupViewTabs() {
  const allowed = ["playoffs", "sessions", "archive"];
  const requested = window.location.hash.replace("#", "");
  const initial = allowed.includes(requested) ? requested : (document.body.classList.contains("playoff-season") ? "playoffs" : "sessions");
  const setView = view => {
    document.querySelectorAll("[data-view-panel]").forEach(panel => { panel.hidden = panel.dataset.viewPanel !== view; });
    document.querySelectorAll("[data-view]").forEach(button => {
      const active = button.dataset.view === view;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
    });
    history.replaceState(null, "", `#${view}`);
    window.scrollTo({top: 0, behavior: "smooth"});
  };
  document.querySelectorAll("[data-view]").forEach(button => button.addEventListener("click", () => setView(button.dataset.view)));
  setView(initial);
}

function render(data, sessions, selected) {
  const matches = sessions[selected];
  const wins = matches.filter(m => m.result === "W").length;
  const draws = matches.filter(m => m.result === "D").length;
  const losses = matches.filter(m => m.result === "L").length;
  const goalsFor = sum(matches, "score_for");
  const goalsAgainst = sum(matches, "score_against");
  const players = aggregatePlayers(matches);

  document.querySelector("#session-record").textContent = `${wins}–${draws}–${losses}`;
  document.querySelector("#session-window").textContent = sessionLabel(matches, selected);
  document.querySelector("#session-kpis").innerHTML = [
    [matches.length, "Matches"], [goalsFor, "Goals for"], [goalsAgainst, "Goals against"],
    [oneDecimal(goalsFor / matches.length), "Goals / game"],
    [`${Math.round(wins / matches.length * 100)}%`, "Win rate"],
    [matches.filter(m => m.score_against === 0).length, "Clean sheets"],
    [Math.max(...matches.map(m => m.opponent.human_players)), "Most opponents"],
    [goalsFor - goalsAgainst >= 0 ? `+${goalsFor - goalsAgainst}` : goalsFor - goalsAgainst, "Goal difference"]
  ].map(([value, label]) => `<div class="kpi"><strong>${value}</strong><span>${label}</span></div>`).join("");

  document.querySelector("#players").innerHTML = players.map(player => {
    const profile = playerProfile(data, player);
    const meta = PLAYER_META[player.name];
    const celebration = celebrationFor(data, player.name, matches);
    return `
      <article class="player-card player-${player.name.toLowerCase()} ${player.motm ? "has-motm" : ""}">
        <img class="player-ghost ${meta.imageClass}" src="${meta.image}" alt="" />
        <div class="player-content">
          ${celebration ? `<div class="milestone-ribbon">★ ${celebration.threshold} ${MILESTONE_LABELS[celebration.metric]}</div>` : ""}
          <header><div><p class="label">${player.appearances} APPEARANCES · THE GAMBIA</p><h3><span class="shirt-number">${meta.number}</span>${meta.fullName}</h3><p class="comparison">PLAYER PROFILE · ${meta.comparison}</p></div><span class="rating">${oneDecimal(player.rating)}</span></header>
          <div class="profile-line"><span>${profile.height}</span><span>${profile.archetype}</span>${profile.overall ? `<span>${profile.overall}</span>` : ""}</div>
          <div class="headline">${player.goals}G · ${player.assists}A</div>
          <div class="stat-list">
          <div><span>Contribution involvement</span><strong>${contributionInvolvement(player, goalsFor)}</strong></div>
          <div><span>Player of the match</span><strong>${player.motm}</strong></div>
          <div><span>Conversion</span><strong>${pct(player.goals, player.shots)}</strong></div>
          <div><span>Pass accuracy</span><strong>${pct(player.passes_made, player.passes_attempted)}</strong></div>
          <div><span>Shots</span><strong>${player.shots}</strong></div>
          <div><span>Through passes</span><strong>${player.through_passes}</strong></div>
          <div><span>Completed dribbles</span><strong>${player.dribbles_completed}</strong></div>
          <div><span>Take-ons</span><strong>${player.take_ons}</strong></div>
          <div><span>Tackles</span><strong>${player.tackles_made}/${player.tackles_attempted}</strong></div>
          <div><span>Second assists</span><strong>${player.second_assists}</strong></div>
          </div>
        </div>
      </article>`;
  }).join("");

  document.querySelector("#matches").innerHTML = matches.map((match, index) => renderMatchCard(match, index, "session")).join("");

  const bobby = players.find(p => p.name === "Bobby");
  const hole = players.find(p => p.name === "Hole");
  const door = players.find(p => p.name === "Door");
  const numbersMismatch = matches.filter(m => m.opponent.human_players > m.human_players).length;
  const signals = [
    `<strong>Front-two production:</strong> Bobby and Hole combined for ${bobby.goals + bobby.assists + hole.goals + hole.assists} direct contributions.`,
    `<strong>Door’s security:</strong> ${pct(door.passes_made, door.passes_attempted)} passing across ${door.passes_attempted} attempts, with ${door.tackles_made}/${door.tackles_attempted} tackles.`,
    `<strong>Numbers context:</strong> ${numbersMismatch} match${numbersMismatch === 1 ? "" : "es"} against a team with more human players.`,
    `<strong>Defensive baseline:</strong> ${oneDecimal(goalsAgainst / matches.length)} conceded per game and ${matches.filter(m => m.score_against === 0).length} clean sheet${matches.filter(m => m.score_against === 0).length === 1 ? "" : "s"}.`
  ];
  document.querySelector("#signals").innerHTML = signals.map(text => `<div class="signal">${text}</div>`).join("");
}

fetch("data/matches.json", {cache: "no-store"})
  .then(response => { if (!response.ok) throw new Error("Match archive is not available yet."); return response.json(); })
  .then(data => {
    const sessions = groupSessions(data.matches || []);
    if (!sessions.length) throw new Error("No matches have been collected yet.");
    document.querySelector("#updated").textContent = `Updated ${new Date(data.last_updated).toLocaleString()}`;
    const select = document.querySelector("#session-select");
    renderPlayoffs(data);
    renderForm(data);
    renderMilestones(data);
    renderCareer(data);
    select.innerHTML = sessions.map((session, index) => `<option value="${index}">${sessionLabel(session, index)}</option>`).join("");
    select.addEventListener("change", event => render(data, sessions, Number(event.target.value)));
    render(data, sessions, 0);
    setupViewTabs();
    document.querySelector("#playoff-journey").addEventListener("click", event => {
      const game = event.target.closest("[data-match-target]");
      if (!game) return;
      const target = document.getElementById(game.dataset.matchTarget);
      if (!target) return;
      target.open = true;
      target.scrollIntoView({behavior: "smooth", block: "center"});
    });
  })
  .catch(error => {
    document.querySelector("main").insertAdjacentHTML("beforeend", `<p class="error">${error.message}</p>`);
    document.querySelector("#updated").textContent = "Feed unavailable";
  });
