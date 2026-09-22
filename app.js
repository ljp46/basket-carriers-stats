const routeLinks = [...document.querySelectorAll("[data-route]")];
const pages = [...document.querySelectorAll("[data-page]")];
const lockers = [...document.querySelectorAll("[data-locker]")];
const squadCards = [...document.querySelectorAll("[data-player]")];
const dossier = document.querySelector("#player-dossier");

const PLAYER_META = {
  Lamin: { name: "LAMIN JAWARA", number: "47", image: "assets/car-door-signing.webp", position: "CM / CDM", seasonOffset: { apps: 5, goals: 2, assists: 2, motm: 1 } },
  Trey: { name: "TREY OSHIWAMBO", number: "88", image: "assets/trey-oshiwambo-signing.webp", position: "CAM / CM" },
  Wormax: { name: "WORMAX HIPPYHAIR", number: "10", image: "assets/wormax-hippyhair-signing.webp", position: "ST / CAM" },
};

const PLAYER_ORDER = ["Lamin", "Trey", "Wormax"];
const MILESTONE_THRESHOLDS = {
  apps: [10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500],
  goals: [10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500],
  assists: [10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500],
  contributions: [10, 25, 50, 75, 100, 200, 300, 400, 500, 750, 1000],
  motm: [5, 10, 25, 50, 75, 100, 150, 200],
};
const MILESTONE_LABELS = { apps: "APPEARANCES", goals: "GOALS", assists: "ASSISTS", contributions: "GOAL CONTRIBUTIONS", motm: "POTM AWARDS" };
const CLUB_RECORDS = [
  { key: "apps", label: "APPEARANCES", value: 99, holder: "CAR DOOR" },
  { key: "goals", label: "GOALS", value: 137, holder: "CLOSED HOLE" },
  { key: "assists", label: "ASSISTS", value: 114, holder: "RICKY BOBBY" },
  { key: "contributions", label: "GOAL CONTRIBUTIONS", value: 224, holder: "RICKY BOBBY" },
  { key: "motm", label: "POTM AWARDS", value: 43, holder: "RICKY BOBBY" },
];

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

function officialSeasonStats(player) {
  const detailed = aggregate(player, archive.matches || []);
  const season = profileFor(player).season || {};
  if (!Object.keys(season).length) return detailed;
  const offset = PLAYER_META[player]?.seasonOffset || {};
  const official = {
    ...detailed,
    apps: Math.max(detailed.apps, Number(season.games_played || 0) - Number(offset.apps || 0)),
    goals: Math.max(detailed.goals, Number(season.goals || 0) - Number(offset.goals || 0)),
    assists: Math.max(detailed.assists, Number(season.assists || 0) - Number(offset.assists || 0)),
    motm: Math.max(detailed.motm, Number(season.motm || 0) - Number(offset.motm || 0)),
    redCards: Math.max(detailed.redCards, Number(season.red_cards || 0) - Number(offset.redCards || 0)),
  };
  if (!PLAYER_META[player]?.seasonOffset && official.apps) official.averageRating = Number(season.average_rating || detailed.averageRating || 0);
  return official;
}

function setGroup(name, entries) {
  const group = dossier.querySelector(`[data-stat-group="${name}"]`);
  group.innerHTML = entries.map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join("");
}

function scopeStats(player, scope) {
  const all = officialSeasonStats(player);
  if (scope === "session") return aggregate(player, recentSession(archive.matches || []));
  if (scope === "career") return careerStats(player, all);
  return all;
}

function achievedMilestones(stats) {
  const values = { ...stats, contributions: stats.goals + stats.assists };
  return Object.entries(MILESTONE_THRESHOLDS).flatMap(([metric, thresholds]) =>
    thresholds.filter((threshold) => values[metric] >= threshold).map((threshold) => ({ metric, threshold }))
  );
}

function milestonesReachedInLatestSession(player, currentStats) {
  const sessionStats = aggregate(player, recentSession(archive.matches || []));
  const current = { ...currentStats, contributions: currentStats.goals + currentStats.assists };
  const session = { ...sessionStats, contributions: sessionStats.goals + sessionStats.assists };
  return Object.entries(MILESTONE_THRESHOLDS).flatMap(([metric, thresholds]) => {
    const beforeSession = Math.max(0, Number(current[metric] || 0) - Number(session[metric] || 0));
    return thresholds
      .filter((threshold) => threshold > beforeSession && threshold <= Number(current[metric] || 0))
      .map((threshold) => ({ metric, threshold }));
  });
}

function nextMilestone(stats) {
  const values = { ...stats, contributions: stats.goals + stats.assists };
  return Object.entries(MILESTONE_THRESHOLDS).flatMap(([metric, thresholds]) => {
    const target = thresholds.find((threshold) => threshold > values[metric]);
    return target ? [{ metric, target, away: target - values[metric] }] : [];
  }).sort((a, b) => a.away - b.away)[0];
}

function renderLegacyTracking() {
  const totals = new Map(PLAYER_ORDER.map((player) => [player, officialSeasonStats(player)]));
  const recordsByPlayer = new Map(PLAYER_ORDER.map((player) => [player, []]));
  const recordHost = document.querySelector("#record-banners");
  const milestoneHost = document.querySelector("#milestone-banners");
  if (!recordHost || !milestoneHost) return;

  recordHost.innerHTML = CLUB_RECORDS.map((record) => {
    const challengers = PLAYER_ORDER.map((player) => {
      const stats = totals.get(player);
      return { player, value: record.key === "contributions" ? stats.goals + stats.assists : Number(stats[record.key] || 0) };
    }).sort((a, b) => b.value - a.value);
    const leader = challengers[0];
    const broken = leader.value > record.value;
    const gap = Math.max(0, record.value + 1 - leader.value);
    if (broken) recordsByPlayer.get(leader.player).push({ ...record, current: leader.value });
    return `<article class="record-banner ${broken ? "record-broken" : ""}">
      <div class="record-crown">${broken ? "NEW RECORD" : "CLUB RECORD"}</div>
      <span>${record.label}</span><strong>${broken ? leader.value : record.value}</strong>
      <small>${broken ? PLAYER_META[leader.player].name : record.holder}</small>
      <div><b>${PLAYER_META[leader.player].name}</b><em>${leader.value} CURRENT · ${broken ? "RECORD BROKEN" : `${gap} TO BREAK`}</em></div>
    </article>`;
  }).join("");

  milestoneHost.innerHTML = PLAYER_ORDER.map((player) => {
    const stats = totals.get(player);
    const achieved = achievedMilestones(stats);
    const next = nextMilestone(stats);
    return `<article class="milestone-banner ${achieved.length ? "has-honours" : ""}">
      <header><span>${PLAYER_META[player].number}</span><div><small>PLAYER HONOURS</small><strong>${PLAYER_META[player].name}</strong></div></header>
      <div class="milestone-ribbons">${achieved.length ? achieved.map((item) => `<span><b>${item.threshold}</b>${MILESTONE_LABELS[item.metric]}</span>`).join("") : `<p>THE FIRST BANNER AWAITS.</p>`}</div>
      ${next ? `<footer><span>NEXT LANDMARK</span><b>${next.target} ${MILESTONE_LABELS[next.metric]}</b><small>${next.away} AWAY</small></footer>` : ""}
    </article>`;
  }).join("");

  squadCards.forEach((card) => {
    card.querySelector(".achievement-ribbon")?.remove();
    card.querySelector(".club-record-ribbon")?.remove();
    card.classList.remove("has-club-record");

    const playerRecords = recordsByPlayer.get(card.dataset.player) || [];
    if (playerRecords.length) {
      const banner = document.createElement("div");
      banner.className = "club-record-ribbon";
      const recordSummary = playerRecords.map((record) => `${record.label} ${record.current}`).join(" · ");
      const formerSummary = playerRecords.map((record) => `${record.holder} ${record.value}`).join(" · ");
      banner.innerHTML = `<span>BC · CLUB RECORD HOLDER</span><strong>${recordSummary}</strong><small>FC26 MARKS SURPASSED · ${formerSummary}</small>`;
      card.classList.add("has-club-record");
      card.prepend(banner);
    }

    const achievedThisSession = milestonesReachedInLatestSession(card.dataset.player, totals.get(card.dataset.player));
    const latest = achievedThisSession.at(-1);
    if (!latest) return;
    const ribbon = document.createElement("span");
    ribbon.className = "achievement-ribbon";
    const extra = achievedThisSession.length > 1 ? ` · +${achievedThisSession.length - 1} MORE` : "";
    ribbon.textContent = `★ ${latest.threshold} ${MILESTONE_LABELS[latest.metric]}${extra}`;
    card.querySelector(".squad-card-body").prepend(ribbon);
  });
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
    const stats = officialSeasonStats(card.dataset.player);
    card.querySelectorAll("[data-card-stat]").forEach((element) => {
      const key = element.dataset.cardStat;
      element.textContent = key === "averageRating" ? (stats.apps ? formatNumber(stats[key], 1) : "—") : formatNumber(stats[key]);
    });
  });
  const detailedGames = (archive.matches || []).length;
  const summary = archive.club?.playoff_summary;
  const useSummary = Number(summary?.games_played || 0) > detailedGames;
  const games = useSummary ? Number(summary.games_played) : detailedGames;
  const wins = useSummary ? Number(summary.wins) : (archive.matches || []).filter((match) => match.result === "W").length;
  const draws = useSummary ? Number(summary.draws) : (archive.matches || []).filter((match) => match.result === "D").length;
  const losses = useSummary ? Number(summary.losses) : (archive.matches || []).filter((match) => match.result === "L").length;
  const goalsFor = useSummary ? Number(summary.goals_for) : (archive.matches || []).reduce((sum, match) => sum + Number(match.score_for || 0), 0);
  const goalsAgainst = useSummary ? Number(summary.goals_against) : (archive.matches || []).reduce((sum, match) => sum + Number(match.score_against || 0), 0);
  const gd = useSummary ? Number(summary.goal_difference) : goalsFor - goalsAgainst;
  document.querySelector("#data-summary").textContent = games ? `${games} MATCHES · ${wins}W ${draws}D ${losses}L · GD ${gd >= 0 ? "+" : ""}${gd}` : "AWAITING FIRST MATCH";
  document.querySelector("#data-status").textContent = games ? "LIVE ARCHIVE" : "SQUAD COMPLETE";
  renderLegacyTracking();
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
