const SESSION_GAP_SECONDS = 60 * 60;
const PLAYER_ORDER = ["Bobby", "Hole", "Door"];

const sum = (items, key) => items.reduce((total, item) => total + (Number(item[key]) || 0), 0);
const pct = (made, attempted) => attempted ? `${Math.round((made / attempted) * 100)}%` : "—";
const oneDecimal = value => Number(value || 0).toFixed(1);

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

function render(data, sessions, selected) {
  const matches = sessions[selected];
  const wins = matches.filter(m => m.result === "W").length;
  const draws = matches.filter(m => m.result === "D").length;
  const losses = matches.filter(m => m.result === "L").length;
  const goalsFor = sum(matches, "score_for");
  const goalsAgainst = sum(matches, "score_against");
  const players = aggregatePlayers(matches);

  document.querySelector("#session-record").textContent = `${wins}W ${draws}D ${losses}L`;
  document.querySelector("#session-window").textContent = sessionLabel(matches, selected);
  document.querySelector("#session-kpis").innerHTML = [
    [matches.length, "Matches"], [goalsFor, "Goals for"], [goalsAgainst, "Goals against"],
    [oneDecimal(goalsFor / matches.length), "Goals / game"],
    [`${Math.round(wins / matches.length * 100)}%`, "Win rate"],
    [matches.filter(m => m.score_against === 0).length, "Clean sheets"],
    [Math.max(...matches.map(m => m.opponent.human_players)), "Most opponents"],
    [goalsFor - goalsAgainst >= 0 ? `+${goalsFor - goalsAgainst}` : goalsFor - goalsAgainst, "Goal difference"]
  ].map(([value, label]) => `<div class="kpi"><strong>${value}</strong><span>${label}</span></div>`).join("");

  document.querySelector("#players").innerHTML = players.map(player => `
    <article class="player-card">
      <header><div><p class="label">${player.appearances} APPEARANCES</p><h3>${player.name}</h3></div><span class="rating">${oneDecimal(player.rating)}</span></header>
      <div class="headline">${player.goals}G · ${player.assists}A</div>
      <div class="stat-list">
        <div><span>Conversion</span><strong>${pct(player.goals, player.shots)}</strong></div>
        <div><span>Pass accuracy</span><strong>${pct(player.passes_made, player.passes_attempted)}</strong></div>
        <div><span>Shots</span><strong>${player.shots}</strong></div>
        <div><span>Through passes</span><strong>${player.through_passes}</strong></div>
        <div><span>Completed dribbles</span><strong>${player.dribbles_completed}</strong></div>
        <div><span>Take-ons</span><strong>${player.take_ons}</strong></div>
        <div><span>Tackles</span><strong>${player.tackles_made}/${player.tackles_attempted}</strong></div>
        <div><span>Second assists</span><strong>${player.second_assists}</strong></div>
      </div>
    </article>`).join("");

  document.querySelector("#matches").innerHTML = matches.map(match => `
    <article class="match">
      <span class="result ${match.result}">${match.result}</span>
      <div><div class="opponent">${match.opponent.name}</div><div class="meta">${new Date(match.timestamp * 1000).toLocaleString()}</div></div>
      <div class="humans">${match.human_players}v${match.opponent.human_players} humans</div>
      <div class="score">${match.score_for}–${match.score_against}</div>
    </article>`).join("");

  const bobby = players.find(p => p.name === "Bobby");
  const hole = players.find(p => p.name === "Hole");
  const door = players.find(p => p.name === "Door");
  const signals = [
    `<strong>Front-two production:</strong> Bobby and Hole combined for ${bobby.goals + bobby.assists + hole.goals + hole.assists} direct contributions.`,
    `<strong>Door’s security:</strong> ${pct(door.passes_made, door.passes_attempted)} passing across ${door.passes_attempted} attempts, with ${door.tackles_made}/${door.tackles_attempted} tackles.`,
    `<strong>Numbers context:</strong> ${matches.filter(m => m.opponent.human_players > m.human_players).length} match${matches.filter(m => m.opponent.human_players > m.human_players).length === 1 ? "" : "es"} against a team with more human players.`,
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
    select.innerHTML = sessions.map((session, index) => `<option value="${index}">${sessionLabel(session, index)}</option>`).join("");
    select.addEventListener("change", event => render(data, sessions, Number(event.target.value)));
    render(data, sessions, 0);
  })
  .catch(error => {
    document.querySelector("main").insertAdjacentHTML("beforeend", `<p class="error">${error.message}</p>`);
    document.querySelector("#updated").textContent = "Feed unavailable";
  });
