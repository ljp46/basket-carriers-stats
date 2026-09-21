const routeLinks = [...document.querySelectorAll("[data-route]")];
const pages = [...document.querySelectorAll("[data-page]")];
const lockers = [...document.querySelectorAll("[data-locker]")];
const squadCards = [...document.querySelectorAll("[data-player]")];
const dossier = document.querySelector("#player-dossier");

const PLAYER_META = {
  Lamin: { name: "LAMIN JAWARA", number: "47", image: "assets/car-door-signing.webp", position: "CM / CDM" },
  Trey: { name: "TREY OSHIWAMBO", number: "88", image: "assets/trey-oshiwambo-signing.webp", position: "CM" },
  Wormax: { name: "WORMAX HIPPYHAIR", number: "10", image: "assets/wormax-hippyhair-signing.webp", position: "ST / CAM" },
};

const emptyStats = () => ({ apps: 0, goals: 0, assists: 0, motm: 0, redCards: 0, ratingTotal: 0, averageRating: 0, seconds: 0, secondAssists: 0, shots: 0, passesMade: 0, passesAttempted: 0, throughPasses: 0, dribbles: 0, takeOns: 0, tacklesMade: 0, tacklesAttempted: 0, interceptions: 0, wins: 0, draws: 0, losses: 0 });

let archive = { matches: [], profiles: [], last_updated: null };
let currentPlayer = null;
let currentScope = sessionStorage.getItem("bc-stat-scope") || "fc27";

function showRoute(name) {
  const target = pages.some((page) => page.dataset.page === name) ? name : "main";
  pages.forEach((page) => { const active = page.dataset.page === target; page.hidden = !active; page.classList.toggle("active", active); });
  routeLinks.forEach((link) => { const active = link.dataset.route === target; link.classList.toggle("active", active); if (link.closest("nav")) link.setAttribute("aria-current", active ? "page" : "false"); });
  document.title = target === "museum" ? "THE MUSEUM — Basket Carriers" : "BASKET CARRIERS — SEASON TWO";
  document.body.dataset.route = target;
}

function recentSession(matches) {
  const ordered = [...matches].sort((a, b) => b.timestamp - a.timestamp);
  if (!ordered.length) return [];
  const selected = [ordered[0]];
  for (let index = 1; index < ordered.length; index += 1) {
    if ((ordered[index - 1].timestamp - ordered[index].timestamp) > 60 * 60) break;
    selected.push(ordered[index]);
  }
  return selected;
}

function aggregate(player, matches) {
  const totals = emptyStats();
  matches.forEach((match) => {
    const row = (match.players || []).find((item) => item.display_name === player);
    if (!row) return;
    totals.apps += 1;
    totals.goals += Number(row.goals || 0); totals.assists += Number(row.assists || 0);
    totals.motm += Number(row.motm || 0); totals.redCards += Number(row.red_cards || 0);
    totals.ratingTotal += Number(row.rating || 0); totals.seconds += Number(row.seconds_played || 0);
    totals.secondAssists += Number(row.second_assists || 0); totals.shots += Number(row.shots || 0);
    totals.passesMade += Number(row.passes_made || 0); totals.passesAttempted += Number(row.passes_attempted || 0);
    totals.throughPasses += Number(row.through_passes || 0); totals.dribbles += Number(row.dribbles_completed || 0);
    totals.takeOns += Number(row.take_ons || 0); totals.tacklesMade += Number(row.tackles_made || 0);
    totals.tacklesAttempted += Number(row.tackles_attempted || 0); totals.interceptions += Number(row.interceptions || 0);
    if (match.result === "W") totals.wins += 1;
    if (match.result === "D") totals.draws += 1;
    if (match.result === "L") totals.losses += 1;
  });
  totals.averageRating = totals.apps ? totals.ratingTotal / totals.apps : 0;
  return totals;
}

function careerStats(player, fc27) {
  const base = PLAYER_META[player]?.careerBase;
  if (!base) return { ...fc27 };
  const combined = { ...fc27 };
  Object.entries(base).forEach(([key, value]) => { if (key !== "averageRating") combined[key] = Number(combined[key] || 0) + Number(value || 0); });
  combined.trackedGoals = Number(base.trackedGoals || 0) + fc27.goals;
  combined.averageRating = combined.apps ? ((base.apps * base.averageRating) + (fc27.apps * fc27.averageRating)) / combined.apps : 0;
  combined.seconds = null;
  return combined;
}

function profileFor(player) { return archive.profiles.find((profile) => profile.display_name === player) || {}; }
function formatNumber(value, decimals = 0) { return value === null || value === undefined || Number.isNaN(value) ? "—" : Number(value).toFixed(decimals); }
function percent(made, attempted) { return attempted ? `${Math.round((made / attempted) * 100)}%` : "—"; }
function per90(value, stats) { return stats.seconds ? ((Number(value || 0) * 5400) / stats.seconds).toFixed(2) : "—"; }

function setGroup(name, entries) {
  const group = dossier.querySelector(`[data-stat-group="${name}"]`);
  group.innerHTML = entries.map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join("");
}

function scopeStats(player, scope) {
  const all = aggregate(player, archive.matches || []);
  if (scope === "session") return aggregate(player, recentSession(archive.matches || []));
  if (scope === "career") return careerStats(player, all);
  return all;
}

function renderDossier() {
  if (!currentPlayer) return;
  const meta = PLAYER_META[currentPlayer];
  const profile = profileFor(currentPlayer);
  const stats = scopeStats(currentPlayer, currentScope);
  const historicCareer = currentScope === "career" && Boolean(meta.careerBase);
  const contribution = stats.goals + stats.assists;
  dossier.querySelector("#dossier-image").src = meta.image;
  dossier.querySelector("#dossier-image").alt = `${meta.name} in the Basket Carriers kit`;
  dossier.querySelector("#dossier-number").textContent = meta.number;
  dossier.querySelector("#dossier-name").textContent = meta.name;
  dossier.querySelector("#dossier-position").textContent = meta.position;
  dossier.querySelector("#dossier-height").textContent = profile.height_cm ? `${profile.height_cm} CM` : "—";
  dossier.querySelector("#dossier-minutes").textContent = stats.seconds === null ? `${formatNumber(aggregate(currentPlayer, archive.matches || []).seconds / 60)} FC27` : formatNumber(stats.seconds / 60);
  dossier.querySelector("#dossier-scope-label").textContent = currentScope === "session" ? "LATEST SESSION" : currentScope === "career" ? "BASKET CARRIERS CAREER" : "FC27 RECORD";
  dossier.querySelector("#dossier-updated").textContent = archive.last_updated ? `UPDATED ${new Date(archive.last_updated).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).toUpperCase()}` : "AWAITING LIVE ARCHIVE";
  dossier.querySelectorAll("[data-scope]").forEach((button) => button.classList.toggle("active", button.dataset.scope === currentScope));
  dossier.querySelectorAll("[data-dossier-stat]").forEach((element) => {
    const key = element.dataset.dossierStat;
    element.textContent = key === "averageRating" ? (stats.apps ? formatNumber(stats[key], 1) : "—") : formatNumber(stats[key]);
  });
  setGroup("output", [["GOAL CONTRIBUTIONS", contribution], ["PLAYER OF THE MATCH", stats.motm], ["SECOND ASSISTS", stats.secondAssists], [historicCareer ? "FC27 MATCH RECORD" : "MATCH RECORD", `${stats.wins}W · ${stats.draws}D · ${stats.losses}L`], ["GOALS / 90", per90(stats.goals, stats)], ["ASSISTS / 90", per90(stats.assists, stats)], ["G+A / 90", per90(contribution, stats)], ["SECOND ASSISTS / 90", per90(stats.secondAssists, stats)]]);
  setGroup("shooting", [[historicCareer ? "TRACKED SHOTS" : "SHOTS", stats.shots], [historicCareer ? "TRACKED CONVERSION" : "CONVERSION", percent(historicCareer ? stats.trackedGoals : stats.goals, stats.shots)], ["SHOTS / 90", per90(stats.shots, stats)], ["RED CARDS", stats.redCards]]);
  setGroup("passing", [["PASSES COMPLETED", stats.passesMade], ["PASSES ATTEMPTED", stats.passesAttempted], ["PASS ACCURACY", percent(stats.passesMade, stats.passesAttempted)], ["THROUGH PASSES", stats.throughPasses], ["PASSES / 90", per90(stats.passesMade, stats)], ["THROUGH PASSES / 90", per90(stats.throughPasses, stats)]]);
  setGroup("possession", [["DRIBBLES", stats.dribbles], ["TAKE-ONS", stats.takeOns], ["DRIBBLES / 90", per90(stats.dribbles, stats)], ["TAKE-ONS / 90", per90(stats.takeOns, stats)]]);
  setGroup("defending", [["TACKLES WON", stats.tacklesMade], ["TACKLES ATTEMPTED", stats.tacklesAttempted], ["TACKLE SUCCESS", percent(stats.tacklesMade, stats.tacklesAttempted)], ["INTERCEPTIONS", stats.interceptions], ["TACKLES WON / 90", per90(stats.tacklesMade, stats)], ["INTERCEPTIONS / 90", per90(stats.interceptions, stats)]]);
  dossier.querySelector("#dossier-note").textContent = historicCareer ? "FC26 minutes were not supplied by EA, so Career per-90 values are intentionally left blank. All raw Career totals remain combined." : "Per-90 figures use verified match minutes. A Session closes after a 60-minute break between matches.";
}

function openDossier(player) {
  currentPlayer = player;
  const latest = Math.max(0, ...(archive.matches || []).map((match) => Number(match.timestamp || 0)));
  if (!sessionStorage.getItem("bc-stat-scope")) currentScope = latest && ((Date.now() / 1000) - latest) < (12 * 60 * 60) ? "session" : "fc27";
  renderDossier();
  if (!dossier.open) dossier.showModal();
}

function updateMainCards() {
  squadCards.forEach((card) => {
    const stats = aggregate(card.dataset.player, archive.matches || []);
    card.querySelectorAll("[data-card-stat]").forEach((element) => {
      const key = element.dataset.cardStat;
      element.textContent = key === "averageRating" ? (stats.apps ? formatNumber(stats[key], 1) : "—") : formatNumber(stats[key]);
    });
  });
  const games = (archive.matches || []).length;
  const wins = (archive.matches || []).filter((match) => match.result === "W").length;
  const draws = (archive.matches || []).filter((match) => match.result === "D").length;
  const losses = (archive.matches || []).filter((match) => match.result === "L").length;
  const goalsFor = (archive.matches || []).reduce((sum, match) => sum + Number(match.score_for || 0), 0);
  const goalsAgainst = (archive.matches || []).reduce((sum, match) => sum + Number(match.score_against || 0), 0);
  const gd = goalsFor - goalsAgainst;
  document.querySelector("#data-summary").textContent = games ? `${games} MATCHES · ${wins}W ${draws}D ${losses}L · GD ${gd >= 0 ? "+" : ""}${gd}` : "AWAITING FIRST MATCH";
  document.querySelector("#data-status").textContent = games ? "LIVE ARCHIVE" : "SQUAD COMPLETE";
}

async function loadArchive() {
  try {
    const response = await fetch(`data/matches.json?ts=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error("archive unavailable");
    archive = await response.json();
    updateMainCards();
  } catch (error) {
    document.querySelector("#data-summary").textContent = "ARCHIVE TEMPORARILY UNAVAILABLE";
    document.querySelector("#data-status").textContent = "RETRYING NEXT REFRESH";
  }
}

window.addEventListener("hashchange", () => showRoute(location.hash.slice(1)));
showRoute(location.hash.slice(1));

lockers.forEach((locker) => {
  const trigger = locker.querySelector(".locker-trigger");
  const record = locker.querySelector(".locker-record");
  trigger.addEventListener("click", () => {
    const opening = !locker.classList.contains("is-lit");
    lockers.forEach((item) => { item.classList.remove("is-lit"); item.querySelector(".locker-trigger").setAttribute("aria-expanded", "false"); item.querySelector(".locker-record").setAttribute("aria-hidden", "true"); });
    if (opening) { locker.classList.add("is-lit"); trigger.setAttribute("aria-expanded", "true"); record.setAttribute("aria-hidden", "false"); }
  });
});

squadCards.forEach((card) => {
  card.addEventListener("click", () => openDossier(card.dataset.player));
  card.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openDossier(card.dataset.player); } });
});

dossier.querySelector(".dossier-close").addEventListener("click", () => dossier.close());
dossier.addEventListener("click", (event) => { if (event.target === dossier) dossier.close(); });
dossier.querySelectorAll("[data-scope]").forEach((button) => button.addEventListener("click", () => { currentScope = button.dataset.scope; sessionStorage.setItem("bc-stat-scope", currentScope); renderDossier(); }));

loadArchive();
