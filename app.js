const SESSION_GAP_SECONDS = 60 * 60;
const PLAYER_ORDER = ["Bobby", "Hole", "Door"];
const ARCHETYPES = {"8": "Maestro", "11": "Magician"};
const PLAYER_META = {
  Bobby: {fullName: "Ricky Bobby", number: "29", comparison: "Bradley Barcola", image: "assets/players/barcola-29-cutout.webp", imageClass: "cutout"},
  Hole: {fullName: "Closed Hole", number: "51", comparison: "Lionel Messi", image: "assets/players/messi.jpeg", imageClass: "photo messi"},
  Door: {fullName: "Car Door", number: "47", comparison: "Jorginho", image: "assets/players/jorginho.jpeg", imageClass: "photo jorginho"}
};
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
      motm: sum(appearances, "motm")
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
      </div>
    </article>`;
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

  document.querySelector("#matches").innerHTML = matches.map((match, index) => {
    const motm = match.players.find(player => player.motm);
    const orderedPlayers = PLAYER_ORDER.map(name => match.players.find(player => player.display_name === name)).filter(Boolean);
    return `
      <details class="match" ${index === 0 ? "open" : ""}>
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
  }).join("");

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
    renderForm(data);
    renderMilestones(data);
    select.innerHTML = sessions.map((session, index) => `<option value="${index}">${sessionLabel(session, index)}</option>`).join("");
    select.addEventListener("change", event => render(data, sessions, Number(event.target.value)));
    render(data, sessions, 0);
  })
  .catch(error => {
    document.querySelector("main").insertAdjacentHTML("beforeend", `<p class="error">${error.message}</p>`);
    document.querySelector("#updated").textContent = "Feed unavailable";
  });
