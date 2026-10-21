import * as E from "./engine.mjs";
import { createRenderer } from "./render.mjs";
import { escapeHTML as esc, shipSVG, portraitSVG, citySVG } from "./art.mjs";
const $ = (id) => document.getElementById(id),
  fmt = (n) => Math.round(n).toLocaleString("de-DE"),
  key = "weitraum:v1";
let saved = null,
  storageError = "";
try {
  const text = localStorage.getItem(key);
  if (text) saved = E.deserialize(text);
} catch {
  storageError =
    "Der gespeicherte Stand konnte nicht geladen werden. Du kannst eine Sicherung importieren oder eine neue Reise beginnen.";
}
let state = saved || E.newGame(),
  auto = null,
  lastFocus = null;
const ui = {
  view: "system",
  selected: {
    type: "planet",
    id: state.player.docked || state.systems[state.player.system].planets[0].id,
  },
  modal: null,
  tab: "overview",
  started: !!saved,
  route: [],
  destination: null,
  toast: storageError,
  toastKind: storageError ? "bad" : "info",
  storage: true,
};
const btn = (action, label, attrs = "", cls = "", disabled = false) =>
  `<button type="button" data-action="${action}" ${attrs} class="${cls}" ${disabled ? "disabled" : ""}>${label}</button>`;
const badge = (text, cls = "") => `<span class="badge ${cls}">${text}</span>`;
const roleName = (n) =>
  ({
    trader: E.CAREERS[n.career],
    ranger: "Ranger-Patrouille",
    pirate: "Pirat",
    dominator: "Dominator",
  })[n.role];
const health = (label, n, max, color) =>
  `<div class="meter" style="--meter:${color}"><span>${label}</span><div><i style="width:${E.clamp((n / max) * 100, 0, 100)}%"></i></div><b>${fmt(n)}<small> / ${max}</small></b></div>`;
$("app").innerHTML =
  `<header class="topbar"><a class="brand" href="#" aria-label="WEITRAUM Start"><span class="brand-mark">◈</span><span>WEITRAUM<small>FREIE HORIZONTE</small></span></a><div id="resources" class="resources"></div><div class="header-actions">${btn("save", "↧ <span>Speichern</span>", "", "icon-button")}${btn("help", "?", 'aria-label="Spielanleitung"', "icon-button")}${btn("menu", "☰", 'aria-label="Spielmenü"', "icon-button")}</div></header>
<main class="bridge"><aside class="sidebar left"><section id="commander"></section><section id="target-panel" class="target-panel"></section><section class="sector-brief"><div class="eyebrow">DAS FREIE ALL</div><p>Zwischen den Sternen liegt kein vorgezeichneter Weg.</p><span>Handeln. Erkunden. Entscheiden.</span></section></aside><section class="viewport"><div class="map-top"><div id="sector-title"></div><nav class="view-switch" aria-label="Kartenansicht">${btn("view", "System", 'data-view="system"')}${btn("view", "Galaxie", 'data-view="galaxy"')}</nav></div><canvas id="map" tabindex="0" aria-label="Interaktive Sternenkarte. Ziele sind auch über die Kontaktliste und Navigation erreichbar."></canvas><div class="map-coordinate" id="coordinates"></div><div class="map-tools">${btn("zoom", "＋", 'data-by="1.25" aria-label="Vergrößern"')}${btn("zoom", "−", 'data-by="0.8" aria-label="Verkleinern"')}${btn("center", "⌖", 'aria-label="System zentrieren"')}${btn("follow", "➤", 'aria-label="Eigenes Schiff zentrieren"')}</div><div class="map-legend"><span class="dot own"></span> DEIN SCHIFF <span class="dot ally"></span> FREIE FLOTTE <span class="dot enemy"></span> FEINDLICH</div><div id="flight-status" class="flight-status"></div><div id="toast" class="toast" role="status"></div></section><aside class="sidebar right"><section id="missions-panel"></section><section id="contacts-panel"></section><section id="news-panel"></section></aside></main>
<footer class="flight-deck"><div id="ship-status" class="ship-status"></div><div class="deck-actions">${btn("ship", "◇ <span>Schiff</span>", "", "deck-button")}${btn("missions", "▱ <span>Aufträge</span>", "", "deck-button")}${btn("signals", "⌁ <span>Signale</span>", "", "deck-button signals-button")}${btn("advance", "+1 <span>Tag</span>", "", "advance")}${btn("auto", "▶ <span>Weiterfliegen</span>", "", "auto-button")}</div></footer><dialog id="dialog" aria-labelledby="dialog-title"></dialog><input id="import-file" type="file" accept="application/json,.json" hidden><section id="welcome" class="welcome"></section>`;
const renderer = createRenderer($("map"), (hit) => {
  if (!ui.started) return;
  ui.selected = hit;
  render();
});
function stop() {
  if (auto) clearInterval(auto);
  auto = null;
}
function notify(r) {
  if (!r) return;
  ui.toast = r.message;
  ui.toastKind = r.ok === false ? "bad" : "info";
  $("announcer").textContent = r.message;
}
function save() {
  if (!ui.started) return;
  try {
    localStorage.setItem(key, E.serialize(state));
    ui.storage = true;
  } catch {
    ui.storage = false;
    ui.toast =
      "Browserspeicher nicht verfügbar. Sichere deine Reise über Menü → Exportieren.";
    ui.toastKind = "bad";
  }
}
function selectedShip() {
  return state.ships.find(
    (v) => v.id === ui.selected?.id && v.system === state.player.system,
  );
}
function targetHTML() {
  const p = state.player,
    s = state,
    sel = ui.selected;
  if (sel?.type === "planet") {
    const world = E.planet(s, sel.id);
    if (!world) return "";
    const local = world.system === p.system;
    return `<div class="panel-heading">NAVIGATION ${badge("PLANET")}</div><div class="planet-orb ${world.economy}" aria-hidden="true"></div><h2>${esc(world.name)}</h2><p>${E.ECONOMIES[world.economy].name} · ${E.SPECIES[world.species].name}</p><div class="detail-grid"><span>System<strong>${s.systems[world.system].name}</strong></span><span>${local ? "Entfernung" : "Reise"}<strong>${local ? fmt(E.distance(p, E.position(world, s.day))) + " AE" : E.route(s, p.system, world.system).length - 1 + " Sprünge"}</strong></span></div>${btn(local ? "dock" : "navigate", local ? (p.docked === world.id ? "Hafen betreten" : "Landeanflug") : "Route planen", `data-id="${world.id}"`, "primary wide", !!p.docked && p.docked !== world.id)}<small class="muted">${p.docked ? "Hafendienste stehen bereit." : "Der Kurs wird in Spieltagen ausgeführt."}</small>`;
  }
  if (sel?.type === "ship") {
    const n = selectedShip();
    if (!n)
      return '<div class="empty">Das Signal ist nicht mehr im System.</div>';
    return `<div class="panel-heading">KONTAKT ${badge(roleName(n), n.role === "pirate" || n.role === "dominator" ? "danger" : "")}</div><div class="contact-emblem ${n.role}">${n.role === "dominator" ? "⬡" : n.role === "pirate" ? "⌁" : "◇"}</div><h2>${esc(n.name.split(" ·")[0])}</h2><p>${n.role === "dominator" ? E.MACHINES[n.machine].name : E.SPECIES[n.species].name} · ${fmt(E.distance(p, n))} AE</p>${health("Schild", n.shield, n.maxShield, "#79bbc7")}${health("Panzerung", n.armor, n.maxArmor, "#c5b083")}${health("Hülle", n.hp, n.maxHp, "#96b194")}<div class="target-buttons">${btn("talk", "Funkkontakt", `data-id="${n.id}"`, "secondary", !!p.docked || E.distance(p, n) > 850)}${["pirate", "dominator"].includes(n.role) ? btn("combat", "Kampfsteuerung", `data-id="${n.id}"`, "danger-button", !!p.docked) : ""}</div><p class="muted">${n.target ? "Verfolgt ein Ziel" : n.role === "trader" ? `${E.CAREERS[n.career]} · Kurs ${E.planet(s, n.dest)?.name}` : n.role === "pirate" ? "Sucht ungeschützte Fracht" : "Sichert den Sektor"}</p>`;
  }
  if (sel?.type === "system") {
    const sys = s.systems[sel.id],
      path = E.route(s, p.system, sys.id);
    return `<div class="panel-heading">STERNENSYSTEM ${badge(sys.visited ? "BESUCHT" : "UNERKUNDET")}</div><div class="system-emblem">✧</div><h2>${sys.name}</h2><p>${sys.owner === "dominator" ? "Von Dominatoren besetzt" : E.SPECIES[sys.owner].name + " · Freier Raum"}</p><div class="detail-grid"><span>Welten<strong>3</strong></span><span>Route<strong>${path.length - 1} Sprünge</strong></span></div><p class="route-path">${path.map((i) => s.systems[i].name).join(" → ")}</p>${sys.id === p.system ? btn("view", "System erkunden", 'data-view="system"', "primary wide") : btn("navigate-system", "Kurs setzen", `data-id="${sys.id}"`, "primary wide", !!p.docked)}<div class="local-worlds">${sys.planets.map((v) => btn("select-planet", `${esc(v.name)} <span>↗</span>`, `data-id="${v.id}"`, "text-row")).join("")}</div>`;
  }
  if (sel?.type === "wreck") {
    const w = s.wrecks.find((w) => w.id === sel.id);
    return w
      ? `<div class="panel-heading">BERGUNG ${badge("WRACK")}</div><h2>Verlorenes Signal</h2><p>${esc(w.name)}</p><p>${w.parts} t Maschinen · ${w.credits} cr</p>${btn("approach-wreck", "Annähern", `data-id="${w.id}"`, "secondary wide")}${btn("salvage", "Bergung starten", `data-id="${w.id}"`, "primary wide")}`
      : '<p class="muted">Das Wrack wurde bereits geborgen.</p>';
  }
  return `<div class="panel-heading">NAVIGATION ${badge("FREIER KURS")}</div><h2>Dein Horizont</h2><p>Wähle ein Ziel auf der Karte oder setze einen freien Kurs.</p>${sel?.type === "space" ? btn("move", "Hierher fliegen", "", "primary wide") : ""}${btn("navigation", "Navigationsverzeichnis", "", "secondary wide")}`;
}
function render() {
  const s = state,
    p = s.player,
    st = E.stats(s),
    sys = s.systems[p.system];
  $("resources").innerHTML =
    `<div><small>KONTO</small><strong class="gold">${fmt(p.credits)} <em>cr</em></strong></div><div><small>TREIBSTOFF</small><strong>${fmt(p.fuel)} <em>/ ${st.fuel}</em></strong></div><div><small>FRACHT</small><strong>${E.usedCargo(s)} <em>/ ${st.cargo} t</em></strong></div><div class="day-stat"><small>STERNZEIT</small><strong>Tag ${s.day}</strong></div>`;
  $("commander").innerHTML =
    `<div class="eyebrow">RANGER-LIZENZ · ${String(E.hash(s.seed) % 99999).padStart(5, "0")}</div><div class="commander"><span class="avatar">${esc(p.name[0].toUpperCase())}</span><div><strong>${esc(p.name)}</strong><small>${p.xp < 100 ? "Freier Pilot" : p.xp < 500 ? "Sternenwanderer" : "Veteran"} · ${p.xp} EP</small></div></div>`;
  $("target-panel").innerHTML = targetHTML();
  $("sector-title").innerHTML =
    `<div class="eyebrow">${ui.view === "system" ? "LOKALES SYSTEM" : "DIE FREIEN HORIZONTE"}</div><h1>${ui.view === "system" ? sys.name : "Sternenatlas"} <span>${ui.view === "system" ? (sys.owner === "dominator" ? "BESETZTER RAUM" : "FREIER SEKTOR") : "18 SYSTEME"}</span></h1>`;
  document.querySelectorAll(".view-switch button").forEach((b) => {
    b.classList.toggle("active", b.dataset.view === ui.view);
    b.setAttribute("aria-pressed", String(b.dataset.view === ui.view));
  });
  const ms = s.missions.filter(
    (m) => m.status === "active" || m.status === "ready",
  );
  $("missions-panel").innerHTML =
    `<div class="panel-heading">AUFTRAGSBUCH ${badge(ms.length)}</div>${
      ms.length
        ? ms
            .slice(0, 3)
            .map(
              (m) =>
                `<button class="mission-card" data-action="mission-detail" data-id="${esc(m.id)}"><small>${m.status === "ready" ? "● PRÄMIE BEREIT" : m.type === "bounty" ? "◎ JAGDAUFTRAG" : "↗ UNTERWEGS"}</small><strong>${esc(m.title)}</strong><span>${fmt(m.reward)} cr <em>${m.status === "ready" ? "Abholung im Hafen" : "Frist: Tag " + m.deadline}</em></span></button>`,
            )
            .join("")
        : `<div class="empty-mission"><span>▱</span><p>Eine Geschichte beginnt<br>mit einem ersten Auftrag.</p>${btn("select-planet", "Haven ansteuern", 'data-id="p0-0"', "text-link")}</div>`
    }${btn("missions", "Alle Aufträge ansehen ↗", "", "text-link")}`;
  const contacts = s.ships
    .filter((n) => n.system === p.system)
    .sort((a, b) => E.distance(p, a) - E.distance(p, b));
  $("contacts-panel").innerHTML =
    `<div class="panel-heading">LOKALE SIGNALE ${badge(contacts.length)}</div><div class="contact-list">${contacts.map((n) => `<button class="contact-row ${ui.selected?.id === n.id ? "selected" : ""}" data-action="select-ship" data-id="${n.id}"><i class="signal ${n.role}"></i><span><strong>${esc(n.name.split(" ·")[0])}</strong><small>${roleName(n)}</small></span><em>${fmt(E.distance(p, n))}<small>AE</small></em></button>`).join("")}</div>`;
  const events = s.news.length ? s.news : s.log;
  $("news-panel").innerHTML =
    `<div class="panel-heading">SUBRAUMFUNK <span class="live-dot"></span></div>${events
      .slice(0, 2)
      .map(
        (l) =>
          `<div class="news-item"><small>TAG ${l.day}</small><p>${esc(l.text)}</p></div>`,
      )
      .join("")}${btn("log", "Logbuch öffnen ↗", "", "text-link")}`;
  $("ship-status").innerHTML =
    `<div class="ship-name"><span class="mini-ship">◈</span><span><strong>${st.name}</strong><small>${st.kind} · ${p.weapons.filter(Boolean).length}/${st.slots} Waffenplätze</small></span></div><div class="ship-meters">${health("Schild", p.shield, st.shield, "#86bfcc")}${health("Panzerung", p.armor, st.armor, "#c9b28b")}${health("Hülle", p.hp, st.hp, "#98b998")}${health("CAP", p.capacitor, st.capacitor, "#b2a4c9")}</div>`;
  const o = p.order;
  let flight = p.docked
    ? `GELANDET AUF ${E.planet(s, p.docked).name.toUpperCase()}`
    : o?.type === "jump"
      ? `${o.phase === "approach" ? "RANDANFLUG" : o.phase === "depart" ? "SPRUNG VORBEREITET" : "IM HYPERRAUM"} → ${s.systems[o.to].name.toUpperCase()}`
      : o?.type === "dock"
        ? `LANDEANFLUG → ${E.planet(s, o.id).name.toUpperCase()}`
        : o?.type === "move"
          ? "FREIER KURS GESETZT"
          : p.combat.target
            ? "TAKTISCHER FLUGMODUS"
            : "IM ORBIT · BEREIT FÜR DEINEN NÄCHSTEN KURS";
  $("flight-status").innerHTML =
    `<span class="live-dot ${o ? "moving" : ""}"></span>${flight}${p.docked ? btn("port", "Hafen öffnen", "", "text-link") : o ? btn("stop-flight", "Kurs stoppen", "", "text-link", o.type === "jump" && o.phase !== "approach") : ""}`;
  $("coordinates").textContent =
    ui.view === "system"
      ? `${fmt(p.x)} : ${fmt(p.y)} AE`
      : "KOALITIONSATLAS · SEKTOR 07";
  $("toast").textContent = ui.toast;
  $("toast").className = `toast ${ui.toast ? "visible" : ""} ${ui.toastKind}`;
  const autoButton = document.querySelector('[data-action="auto"]');
  autoButton.innerHTML = auto
    ? "Ⅱ <span>Pause</span>"
    : "▶ <span>Weiterfliegen</span>";
  autoButton.classList.toggle("running", !!auto);
  autoButton.disabled = !!p.docked;
  document.querySelector('[data-action="advance"]').disabled = !!auto;
  renderer.update(s, ui);
  renderModal();
  renderWelcome();
}
function renderWelcome() {
  const el = $("welcome");
  el.hidden = ui.started;
  if (ui.started) return;
  el.innerHTML = `<div class="welcome-orbit"></div><div class="welcome-card"><div class="eyebrow">EIN WELTRAUM-ROLLENSPIEL</div><div class="welcome-symbol">◈</div><h1>WEITRAUM</h1><div class="welcome-subtitle">F R E I E &nbsp; H O R I Z O N T E</div><p>Eine Galaxie in Bewegung.<br>Ein Schiff voller Möglichkeiten.<br>Und eine Geschichte, die dir gehört.</p><form id="start-form"><label>DEIN RUFNAME<input id="pilot-name" name="name" maxlength="32" value="Ranger" autocomplete="nickname" required></label><label>GALAXIE-SEED<input id="galaxy-seed" name="seed" maxlength="80" value="Freie Horizonte" required></label><button class="primary" type="submit">Reise beginnen <span>↗</span></button></form><div class="welcome-features"><span>HANDEL & ERKUNDUNG</span><span>TAKTISCHER KAMPF</span><span>LEBENDIGE WELTEN</span></div>${storageError ? `<p class="error">${esc(storageError)}</p>${btn("import", "Sicherung importieren", "", "text-link")}` : ""}<small>Desktop & Smartphone · Spielstand bleibt in deinem Browser</small></div>`;
}
function open(modal, tab) {
  stop();
  lastFocus = document.activeElement;
  ui.modal = modal;
  ui.toast = "";
  if (tab) ui.tab = tab;
  render();
}
function close() {
  ui.modal = null;
  if ($("dialog").open) $("dialog").close();
  lastFocus?.focus?.();
  render();
}
function dialog(title, body, wide = false) {
  const el = $("dialog"),
    scroll = el.querySelector(".dialog-body")?.scrollTop || 0,
    focused = el.contains(document.activeElement)
      ? { ...document.activeElement.dataset }
      : null;
  el.className = wide ? "large-dialog" : "";
  el.innerHTML = `<div class="dialog-head"><div><div class="eyebrow">WEITRAUM / BORDKONSOLE</div><h2 id="dialog-title">${title}</h2></div>${btn("close", "×", 'aria-label="Fenster schließen"', "close-button")}</div>${ui.toast ? `<div class="modal-feedback ${ui.toastKind}" role="status">${esc(ui.toast)}</div>` : ""}<div class="dialog-body">${body}</div>`;
  if (!el.open) el.showModal();
  el.querySelector(".dialog-body").scrollTop = scroll;
  if (focused?.action) {
    const button = [...el.querySelectorAll("button")].find((b) =>
      Object.entries(focused).every(([k, v]) => b.dataset[k] === v),
    );
    button?.focus({ preventScroll: true });
  }
}
function missionHTML(m) {
  const place = E.planet(state, m.type === "bounty" ? m.origin : m.destination);
  return `<article class="contract"><div>${badge({ active: "AKTIV", ready: "PRÄMIE BEREIT", paid: "AUSGEZAHLT", failed: "FRIST / AUFTRAG GESCHEITERT" }[m.status], m.status === "ready" ? "success" : "")}<h3>${esc(m.title)}</h3><p>${esc(m.description)}</p><small>${place.name} · ${state.systems[place.system].name} / Frist Tag ${m.deadline}</small></div><div class="contract-pay"><strong>${fmt(m.reward)} <small>cr</small></strong>${m.status === "ready" ? btn("claim", "Prämie abholen", `data-id="${esc(m.id)}"`, "primary", state.player.docked !== place.id) : m.status === "active" ? btn("mission-route", "Ziel markieren", `data-id="${esc(m.id)}"`, "secondary") : badge(m.status === "paid" ? "QUITTUNG · TAG " + m.paid : "ABGESCHLOSSEN")}</div></article>`;
}
function portHTML() {
  const s = state,
    p = s.player,
    world = E.planet(s, p.docked);
  if (!world) return "<p>Du bist nicht gelandet.</p>";
  const e = E.ECONOMIES[world.economy],
    c = E.portContact(s, world.id),
    species = E.SPECIES[world.species];
  let body = "";
  const tabs = [
    ["overview", "Hafen"],
    ["market", "Handel"],
    ["contracts", "Aufträge"],
    ["people", "Hafenvertretung"],
    ["shipyard", "Werft"],
  ];
  if (ui.tab === "overview")
    body = `<div class="port-scene">${citySVG(species.color)}<div class="port-welcome"><div class="eyebrow">${species.name.toUpperCase()} · ${e.name.toUpperCase()}</div><h3>${esc(world.name)}</h3><p>„${species.greeting}“</p><small>${esc(c.name)} · Hafenvertretung</small></div>${portraitSVG(world.species, c.name)}</div><div class="port-service-grid"><article><span>⛽</span><h3>Treibstoff</h3><p>${fmt(p.fuel)} / ${E.stats(s).fuel} · 3 cr je Einheit</p>${btn("refuel", "Volltanken", "", "secondary")}</article><article><span>⚙</span><h3>Reparaturdock</h3><p>Hülle, Panzerung und Bordsysteme</p>${btn("repair", "Instand setzen", "", "secondary")}</article><article><span>▱</span><h3>Neue Horizonte</h3><p>Aufträge und offene Prämien</p>${btn("port-tab", "Auftragsbüro", 'data-tab="contracts"', "secondary")}</article></div>${s.missions.some((m) => m.status === "ready" && (m.type === "bounty" ? m.origin : m.destination) === world.id) ? '<div class="notice">Eine Prämie wartet auf dich. Öffne das Auftragsbüro, um sie abzuholen.</div>' : ""}`;
  if (ui.tab === "market")
    body = `<div class="section-intro"><h3>Lokaler Warenmarkt</h3><p>${e.name} · Export: ${e.exports.map((id) => E.GOODS.find((g) => g.id === id).name).join(", ")}. Preise verändern sich mit den Vorräten.</p></div><div class="market-table"><div class="market-head"><span>WARE / VORRAT</span><span>KAUF / VERKAUF</span><span>AN BORD</span><span>HANDEL</span></div>${E.GOODS.map((g) => `<article class="market-row"><div><i style="color:${g.color}">${g.icon}</i><span><strong>${g.name}</strong><small>${world.stock[g.id]} t verfügbar</small></span></div><div><strong>${E.price(s, world, g.id)} <small>cr</small></strong><small>${E.price(s, world, g.id, "sell")} cr zurück</small></div><strong>${p.cargo[g.id]} <small>t</small></strong><div class="trade-buttons">${btn("trade", "−5", `data-good="${g.id}" data-amount="-5" aria-label="5 Tonnen ${g.name} verkaufen"`, "", p.cargo[g.id] < 5)}${btn("trade", "−1", `data-good="${g.id}" data-amount="-1" aria-label="1 Tonne ${g.name} verkaufen"`, "", p.cargo[g.id] < 1)}${btn("trade", "+1", `data-good="${g.id}" data-amount="1" aria-label="1 Tonne ${g.name} kaufen"`)}${btn("trade", "+5", `data-good="${g.id}" data-amount="5" aria-label="5 Tonnen ${g.name} kaufen"`)}</div></article>`).join("")}</div><p class="muted">Frachtraum: ${E.usedCargo(s)} / ${E.stats(s).cargo} t. Versiegelte Auftragsfracht und lose Waffen belegen ebenfalls Platz.</p>`;
  if (ui.tab === "contracts") {
    const own = s.missions.filter(
      (m) => m.origin === world.id || m.destination === world.id,
    );
    body = `<div class="section-intro"><h3>Auftragsbüro</h3><p>Bestätigte Leistungen bleiben bis zur Abholung zur Auszahlung bereit. Die Frist gilt für die eigentliche Lieferung oder den Abschuss.</p></div>${own.length ? `<h4>Deine Aufträge</h4>${own.map(missionHTML).join("")}` : ""}<h4>Offene Ausschreibungen</h4>${
      E.contracts(s, world.id)
        .filter((m) => !s.missions.some((v) => v.id === m.id))
        .map(
          (m) =>
            `<article class="contract"><div>${badge(m.type === "courier" ? "KURIERDIENST" : "VERSORGUNG")}<h3>${esc(m.title)}</h3><p>${esc(m.description)}</p><small>Frist: Tag ${m.deadline} · ${m.xp} EP</small></div><div class="contract-pay"><strong>${fmt(m.reward)} <small>cr</small></strong>${btn("accept", "Annehmen", `data-id="${m.id}"`, "primary")}</div></article>`,
        )
        .join("") ||
      '<p class="muted">Alle Angebote angenommen. Neue Ausschreibungen erscheinen alle zwölf Tage.</p>'
    }`;
  }
  if (ui.tab === "people") {
    const v = c.project;
    body = `<div class="people-layout"><div class="person-card">${portraitSVG(world.species, c.name)}<h3>${esc(c.name)}</h3><p>${species.name} · Hafenvertretung</p>${badge("VERTRAUEN " + v.trust)}</div><div><div class="eyebrow">ZUSAMMENARBEIT · PROJEKT ${v.cycle + 1}</div><h3>${["Eine sichere Anlaufstelle", "Das Netz zum Leben erwecken", "Die letzte Lieferung"][v.stage]}</h3><p>${["Die äußere Versorgungsstation braucht 2 t Maschinen. Hilfst du uns, die Basis für einen sicheren Hafen zu schaffen?", "Die Maschinen stehen. Jetzt braucht das Energienetz eine Finanzierung. Technische Kenntnisse senken deine Kosten.", "Das Personal steht bereit. Mit 2 t Medizin können wir die Krankenstation eröffnen."][v.stage]}</p><div class="project-steps">${["Maschinen", "Energienetz", "Medizin"].map((t, i) => `<span class="${i === v.stage ? "active" : i < v.stage ? "done" : ""}">${i < v.stage ? "✓" : i + 1} ${t}</span>`).join("")}</div>${btn("port-project", s.day < v.cooldown ? `Nächstes Anliegen: Tag ${v.cooldown}` : ["2 t Maschinen übergeben", `${p.skills.engineering ? "80" : "220"} cr investieren`, "2 t Medizin übergeben"][v.stage], "", "primary", s.day < v.cooldown)}<p class="muted">Abschluss: 1.050 cr, 80 EP und Vertrauen. Nach sieben Tagen folgt ein neues Projekt.</p><h4>Ausbildung</h4><div class="training">${Object.entries(
      { trade: "Handel", engineering: "Technik", diplomacy: "Diplomatie" },
    )
      .map(([id, label]) =>
        btn(
          "learn",
          `${label} <span>Stufe ${p.skills[id]} / 4 · ${350 * (p.skills[id] + 1)} cr</span>`,
          `data-skill="${id}"`,
          "training-button",
          p.skills[id] >= 4,
        ),
      )
      .join("")}</div><h4>Erinnerungen</h4>${
      v.memory
        .slice(0, 3)
        .map((m) => `<p class="memory">Tag ${m.day} · ${esc(m.text)}</p>`)
        .join("") ||
      '<p class="muted">Eure gemeinsame Geschichte beginnt hier.</p>'
    }</div></div>`;
  }
  if (ui.tab === "shipyard")
    body = `<div class="section-intro"><h3>Schiffe der freien Flotten</h3><p>18 Rümpfe mit 1–6 Waffenplätzen. Ausrüstung, Bordausbauten und Fracht werden übernommen. Kleinere Schiffe benötigen ausreichend freien Laderaum.</p></div><div class="hull-grid">${Object.entries(
      E.HULLS,
    )
      .map(
        ([id, h]) =>
          `<article class="hull-card">${shipSVG(id, 190)}<div class="eyebrow">${E.SPECIES[h.species].name.toUpperCase()} · ${h.kind.toUpperCase()}</div><h3>${h.name}</h3><p>${h.description}</p><div class="hull-stats"><span>${h.slots} Waffen</span><span>${h.cargo} t</span><span>${h.hp} Hülle</span></div>${btn("buy-hull", p.hull === id ? "Dein Schiff" : `${fmt(h.cost)} cr · Kaufen`, `data-hull="${id}"`, "secondary wide", p.hull === id || p.credits < h.cost)}</article>`,
      )
      .join("")}</div>`;
  return `<nav class="tabs" aria-label="Hafendienste">${tabs.map(([id, label]) => btn("port-tab", label, `data-tab="${id}"`, ui.tab === id ? "active" : "")).join("")}</nav>${body}<div class="port-footer"><span>${esc(world.name)} · ${fmt(p.credits)} cr · Fracht ${E.usedCargo(s)}/${E.stats(s).cargo} t</span>${btn("undock", "Startfreigabe anfordern ↗", "", "primary")}</div>`;
}
function shipHTML() {
  const s = state,
    p = s.player,
    st = E.stats(s);
  return `<div class="ship-overview">${shipSVG(p.hull, 240)}<div><div class="eyebrow">DEIN SCHIFF / ${st.kind.toUpperCase()}</div><h3>${st.name}</h3><p>${st.description}</p><div class="hull-stats"><span>${st.speed} AE / Tag</span><span>${st.cargo} t Fracht</span><span>${st.slots} Waffenplätze</span></div></div></div><h4>Waffensysteme</h4><p class="muted">Jeder Platz trägt genau eine Waffe mit eigenem Ladezyklus. Einbau und Ausbau erfolgen im Hafen.</p><div class="weapon-grid">${p.weapons.map((gun, i) => `<article class="weapon-card"><div class="panel-heading">PLATZ ${i + 1} ${gun ? badge(gun.active ? "AKTIV" : "AUS") : badge("FREI")}</div><div class="weapon-art">${gun ? { laser: "⟠", cannon: "▥", missile: "➶", plasma: "♧", rail: "⥣", ion: "ϟ" }[gun.type] : "＋"}</div><h3>${gun ? E.WEAPONS[gun.type].name : "Leerer Waffenplatz"}</h3>${gun ? `<p>${E.WEAPONS[gun.type].damage} Schaden · ${E.WEAPONS[gun.type].cycle} Tage Zyklus<br>${E.WEAPONS[gun.type].optimal} AE optimal · ${E.WEAPONS[gun.type].cap} CAP</p>${btn("toggle-weapon", gun.active ? "Deaktivieren" : "Aktivieren", `data-slot="${i}"`, "secondary wide")}` : "<p>Wähle eine lose Waffe aus deinem Inventar.</p>"}<select aria-label="Waffe für Platz ${i + 1}" data-fit-slot="${i}" ${!p.docked ? "disabled" : ""}><option value="">Ausrüstung wählen</option>${gun ? '<option value="remove">Waffe ausbauen</option>' : ""}${p.inventory.map((item) => `<option value="${item.uid}">${E.WEAPONS[item.type].name}</option>`).join("")}</select></article>`).join("")}</div><h4>Bordausbauten</h4><div class="upgrade-grid">${Object.entries(
    {
      engine: ["Triebwerk", "+25 AE je Tag"],
      shield: ["Schildgenerator", "+45 Schild"],
      cargo: ["Frachtraum", "+15 t Kapazität"],
      reactor: ["Reaktor", "+35 CAP, +15 Hülle"],
    },
  )
    .map(
      ([id, [label, detail]]) =>
        `<article><h3>${label}</h3><p>${detail}</p><span class="upgrade-level">${"▰".repeat(p.upgrades[id])}${"▱".repeat(4 - p.upgrades[id])}</span>${btn("upgrade", p.upgrades[id] >= 4 ? "Voll ausgebaut" : `Ausbauen · ${450 * (p.upgrades[id] + 1)} cr`, `data-module="${id}"`, "secondary wide", !p.docked || p.upgrades[id] >= 4 || p.credits < 450 * (p.upgrades[id] + 1))}</article>`,
    )
    .join(
      "",
    )}</div><h4>Waffenmarkt</h4><div class="weapon-shop">${Object.entries(
    E.WEAPONS,
  )
    .map(
      ([id, w]) =>
        `<article><div><h3>${w.name}</h3><p>${w.desc}</p><small>${w.damage} Schaden · ${w.optimal} AE · ${w.cycle} Tage · ${w.cap} CAP</small></div>${btn("buy-weapon", `${fmt(w.cost)} cr`, `data-weapon="${id}"`, "secondary", !p.docked || p.credits < w.cost)}</article>`,
    )
    .join(
      "",
    )}</div><p class="muted">${p.inventory.length} lose Waffen im Inventar · je 2 t. Eingebaute Waffen belegen keinen Frachtraum.</p>`;
}
function combatHTML() {
  const s = state,
    p = s.player,
    n = selectedShip() || s.ships.find((n) => n.id === p.combat.target);
  if (!n) return "<p>Wähle zuerst einen feindlichen Kontakt.</p>";
  const c = p.combat;
  return `<div class="combat-heading"><div class="contact-emblem ${n.role}">⌖</div><div><div class="eyebrow">TAKTISCHER KONTAKT · ${fmt(E.distance(p, n))} AE</div><h3>${esc(n.name)}</h3><p>${n.role === "dominator" ? E.MACHINES[n.machine].name : "Unregistriertes Kampfschiff"} · ${n.id === c.target ? (s.day >= c.lockAt ? "Ziel aufgeschaltet" : "Aufschaltung läuft") : "Kein Ziel aufgeschaltet"}</p></div></div><div class="combat-layers">${health("Zielschild", n.shield, n.maxShield, "#86bfcc")}${health("Panzerung", n.armor, n.maxArmor, "#d1b28a")}${health("Hülle", n.hp, n.maxHp, "#aab395")}</div><div class="combat-actions">${btn("lock", "Nur aufschalten", `data-id="${n.id}"`, "secondary")}${btn("fire", c.fire && c.target === n.id ? "Waffen stoppen" : "Waffen starten", `data-id="${n.id}"`, "danger-button")}</div><h4>Flugmanöver</h4><div class="maneuvers">${Object.entries(
    {
      approach: "Annähern",
      keep: "Abstand halten",
      orbit: "Umkreisen",
      flee: "Abdrehen",
    },
  )
    .map(([id, label]) =>
      btn(
        "maneuver",
        label,
        `data-mode="${id}"`,
        c.mode === id ? "active" : "",
      ),
    )
    .join(
      "",
    )}</div><label class="range-select">Bevorzugter Abstand<select id="combat-range">${[180, 320, 550, 750].map((v) => `<option value="${v}" ${c.range === v ? "selected" : ""}>${v} AE</option>`).join("")}</select></label><div class="combat-modules">${Object.entries(
    {
      booster: "Schildbooster · 12 CAP",
      repair: "Panzerungsreparatur · 14 CAP",
      afterburner: "Nachbrenner · 10 CAP",
    },
  )
    .map(([id, label]) =>
      btn(
        "combat-module",
        `${c[id] ? "●" : "○"} ${label}`,
        `data-module="${id}"`,
        c[id] ? "active" : "",
      ),
    )
    .join(
      "",
    )}</div><h4>Waffenprognose</h4><div class="weapon-prognosis">${p.weapons
    .map((gun, i) => {
      if (!gun) return `<p>Platz ${i + 1} · frei</p>`;
      const w = E.WEAPONS[gun.type],
        chance = E.hitChance(w, n, E.distance(p, n), c.mode === "orbit");
      return `<div><span><strong>${w.name}</strong><small>${gun.readyAt > s.day ? "Lädt noch " + (gun.readyAt - s.day) + " Tage" : `${Math.round(chance * 100)} % Trefferprognose · ${w.cap} CAP`}</small></span>${btn("toggle-weapon", gun.active ? "Aktiv" : "Aus", `data-slot="${i}"`, gun.active ? "active" : "")}</div>`;
    })
    .join(
      "",
    )}</div><div class="notice">Befehle verbrauchen keine Zeit. Schließe die Konsole und gehe mit <strong>+1 Tag</strong> weiter. Hohe Querbewegung erschwert Turmtreffer; Raketen treffen schnelle kleine Ziele schwächer.</div>`;
}
function renderModal() {
  const s = state,
    p = s.player;
  if (!ui.modal) {
    if ($("dialog").open) $("dialog").close();
    return;
  }
  if (ui.modal === "port") {
    if (!p.docked) {
      ui.modal = null;
      return;
    }
    dialog(`Hafen ${esc(E.planet(s, p.docked).name)}`, portHTML(), true);
  }
  if (ui.modal === "ship") dialog("Schiff & Ausrüstung", shipHTML(), true);
  if (ui.modal === "missions")
    dialog(
      "Dein Auftragsbuch",
      `<div class="section-intro"><p>Aktive Aufträge, ausstehende Prämien und Quittungen deiner Reise.</p></div>${s.missions.length ? s.missions.slice().reverse().map(missionHTML).join("") : '<div class="empty large">Noch kein Auftrag angenommen. Lande auf einem freien Planeten oder frage eine Ranger-Patrouille nach einem Jagdauftrag.</div>'}`,
      true,
    );
  if (ui.modal === "talk") {
    const n = selectedShip();
    dialog(
      n ? `Funkkontakt · ${esc(n.name.split(" ·")[0])}` : "Signal verloren",
      n
        ? `<div class="dialogue-layout"><div class="person-card">${n.role === "dominator" ? '<div class="machine-portrait">⬡</div>' : portraitSVG(n.species, n.name)}${badge(roleName(n))}</div><div><div class="eyebrow">OFFENER SUBRAUMKANAL / ${fmt(E.distance(p, n))} AE</div><blockquote>${esc(E.greeting(s, n.id))}</blockquote><div class="dialogue-options">${E.npcActions(
            s,
            n.id,
          )
            .map((a) =>
              btn(
                "npc-action",
                `<strong>${a.label}</strong><small>${a.detail}</small>`,
                `data-kind="${a.id}"`,
              ),
            )
            .join(
              "",
            )}</div><div class="dialogue-response" role="status">${esc(ui.dialogueResponse || "Deine Entscheidungen verändern Credits, Beziehungen, Aufträge und das Verhalten im System.")}</div><p class="muted">Beziehung: ${n.relation} · Nach einer Handlung braucht der Kontakt einen Spieltag, bevor er erneut handelt.</p></div></div>`
        : "<p>Dieser Kontakt ist nicht mehr erreichbar.</p>",
      true,
    );
  }
  if (ui.modal === "combat") dialog("Kampfsteuerung", combatHTML(), true);
  if (ui.modal === "log")
    dialog(
      "Logbuch",
      `<div class="log-list">${s.log.map((l) => `<article class="${esc(l.kind)}"><small>TAG ${l.day}</small><p>${esc(l.text)}</p></article>`).join("")}</div>`,
    );
  if (ui.modal === "navigation")
    dialog(
      "Navigationsverzeichnis",
      `<p class="muted">Alle Welten sind über dieses Verzeichnis auch ohne Kartenbedienung erreichbar.</p><div class="navigation-list">${s.systems.map((sys) => `<article><h3>${sys.name} ${sys.owner === "dominator" ? badge("BESETZT", "danger") : ""}</h3>${sys.planets.map((world) => btn("nav-world", `${esc(world.name)} <small>${E.ECONOMIES[world.economy].name}</small>`, `data-id="${world.id}"`, "text-row")).join("")}</article>`).join("")}</div>`,
      true,
    );
  if (ui.modal === "signals")
    dialog(
      "Lokale Signale",
      `<p class="muted">Wähle einen Kontakt. In seiner Zielansicht kannst du Funkkontakt aufnehmen oder die Kampfsteuerung öffnen.</p><div class="signals-list">${s.ships
        .filter((n) => n.system === p.system)
        .sort((a, b) => E.distance(p, a) - E.distance(p, b))
        .map(
          (n) =>
            `<button class="contact-row" data-action="select-ship" data-id="${n.id}"><i class="signal ${n.role}"></i><span><strong>${esc(n.name.split(" ·")[0])}</strong><small>${roleName(n)}</small></span><em>${fmt(E.distance(p, n))} AE</em></button>`,
        )
        .join("")}</div>`,
    );
  if (ui.modal === "menu")
    dialog(
      "Deine Reise",
      `<div class="menu-grid">${btn("save", "Spielstand speichern <small>Automatische Speicherung nach jeder Aktion</small>")}${btn("export", "Spielstand exportieren <small>JSON-Sicherung auf deinem Gerät</small>")}${btn("import", "Spielstand importieren <small>Eine exportierte Reise wiederherstellen</small>")}${btn("navigation", "Navigationsverzeichnis <small>Alle Systeme und Welten durchsuchen</small>")}${btn("new-game", "Neue Reise beginnen <small>Der aktuelle Browser-Spielstand wird ersetzt</small>")}${btn("help", "Spielanleitung <small>Handel, Reisen, Kämpfe und Gespräche</small>")}</div><p class="muted">Galaxie: ${esc(s.seed)} · Spielstandformat ${E.VERSION} · ${ui.storage ? "Lokal gespeichert" : "Nur in dieser Sitzung verfügbar"}</p>`,
    );
  if (ui.modal === "help")
    dialog(
      "Dein Weg durch WEITRAUM",
      `<div class="help"><h3>Deine erste Reise</h3><ol><li>Wähle Haven und tippe auf <strong>Landeanflug</strong>. Mit <strong>+1 Tag</strong> oder <strong>Weiterfliegen</strong> verstreicht Zeit.</li><li>Öffne im Hafen <strong>Aufträge</strong> und nimm die Depesche an. Ein Kurierauftrag benötigt keine gekaufte Ware.</li><li>Fordere die Startfreigabe an. Markiere das Auftragsziel, fliege hin und lande. Die Lieferung wird automatisch bestätigt.</li><li>Hole im Auftragsbüro die <strong>Prämie ausdrücklich ab</strong>. Bereits bestätigte Leistungen verfallen nicht.</li></ol><h3>Eine Welt in Bewegung</h3><p>Das Spiel pausiert beim Planen. Mit jedem Spieltag handeln, fliegen und kämpfen die anderen Schiffe selbstständig. Bergungspiloten leeren Wracks, Feldtechniker reparieren beschädigte Schiffe und Patrouillen jagen Piraten. Pausiere den Autopiloten, um jederzeit einzugreifen.</p><h3>Reisen und Handel</h3><p>In der Galaxiekarte setzt du einen Kurs durch benachbarte Systeme. Dein Schiff fliegt zuerst zum Rand, verschwindet im Hyperraum und taucht am Gegenrand wieder auf. Jeder Sprung und jeder Flug kostet Treibstoff. Bei weniger als 15 Einheiten steht die Pannenhilfe bereit.</p><p>Agrarwelten verkaufen günstige Lebensmittel, Bergbauwelten Erz und Industriewelten Maschinen. Vorräte verändern die Preise. Fracht, versiegelte Depeschen und lose Waffen teilen sich deinen Laderaum.</p><h3>Taktische Gefechte</h3><p>Ein feindlicher Kontakt führt zur Kampfsteuerung. Schalte ihn auf, wähle Annähern, Abstand halten, Umkreisen oder Abdrehen und starte die Waffen. Jede Waffe hat einen eigenen Zyklus, Energiebedarf und eine Optimalreichweite. Der Kondensator versorgt auch Schildbooster, Reparatur und Nachbrenner. Befehle selbst verbrauchen keinen Spieltag.</p><h3>Beziehungen und Fortschritt</h3><p>Funkkontakte bieten echte Frachtgeschäfte, Geleit, Reparaturen und Jagdaufträge. Piraten lassen sich bezahlen, täuschen oder an Patrouillen melden. Ein Bluff kann scheitern. Die Hafenvertretungen merken sich deine Hilfe und bieten nach abgeschlossenen Projekten neue Aufgaben. Handel senkt Preise, Technik senkt Projektkosten und Diplomatie verbessert deine Bluffchance.</p><h3>Speichern und Bedienung</h3><p>Jede Aktion wird lokal gespeichert. Exportiere eine Sicherung für andere Geräte. <strong>Leertaste</strong>: Zeit weiter / Pause. <strong>G</strong>: Kartenansicht wechseln. <strong>Escape</strong>: Fenster schließen. Ziehe die Systemkarte zum Verschieben oder nutze die Zoomtasten. Alle Kontakte und Welten sind auch über Listen erreichbar.</p><p>Geht dein Schiff verloren, rettet dich eine Kapsel nach Haven. Du verlierst deine Handelsfracht und ein Viertel deiner Credits. Dein Schiff bleibt erhalten.</p>${btn("emergency", "Pannenhilfe rufen", "", "secondary", p.docked !== null || p.fuel >= 15)}</div>`,
      true,
    );
}
function nextDay() {
  if (!ui.started) return;
  const before = state.player.docked,
    system = state.player.system,
    ready = state.missions.filter((m) => m.status === "ready").length,
    oldHp = state.player.hp;
  E.tick(state);
  if (state.player.system !== system) {
    renderer.center();
    ui.selected = { type: "system", id: state.player.system };
    if (!state.player.order && ui.route.length) {
      const r = E.orderJump(state, ui.route[0]);
      if (r.ok) ui.route.shift();
      else {
        stop();
        ui.route = [];
        ui.destination = null;
        notify(r);
      }
    } else if (!ui.route.length) {
      if (ui.destination) {
        ui.selected = { type: "planet", id: ui.destination };
        ui.view = "system";
        const r = E.orderDock(state, ui.destination);
        notify(r);
        if (!r.ok) stop();
        ui.destination = null;
      } else stop();
    }
  }
  if (state.player.docked && !before) {
    stop();
    ui.modal = "port";
    ui.tab = "overview";
    notify({
      message: `Landung auf ${E.planet(state, state.player.docked).name} bestätigt.`,
    });
  }
  if (state.missions.filter((m) => m.status === "ready").length > ready)
    notify({
      message: "Auftrag bestätigt. Hole deine Prämie im angegebenen Hafen ab.",
    });
  if (state.player.hp < E.stats(state).hp * 0.25 && state.player.hp < oldHp) {
    stop();
    notify({
      ok: false,
      message:
        "Kritischer Hüllenzustand. Autopilot angehalten. Repariere oder drehe ab!",
    });
  }
  if (state.player.fuel < 0.7 && state.player.order?.type !== "jump") {
    stop();
    notify({
      ok: false,
      message: "Treibstoff leer. Nutze die Pannenhilfe in der Spielanleitung.",
    });
  }
  if (!state.player.order && !state.player.combat.fire && !ui.route.length)
    stop();
  save();
  render();
}
function navigate(system, dest = null) {
  const p = state.player,
    path = E.route(state, p.system, system);
  if (p.docked) {
    notify({ ok: false, message: "Fordere zuerst die Startfreigabe an." });
    return;
  }
  ui.route = path.slice(1);
  ui.destination = dest;
  if (!ui.route.length) {
    if (dest) notify(E.orderDock(state, dest));
    return;
  }
  const r = E.orderJump(state, ui.route[0]);
  if (r.ok) ui.route.shift();
  else {
    ui.route = [];
    ui.destination = null;
  }
  notify(r);
}
$("app").addEventListener("click", (event) => {
  const b = event.target.closest("button[data-action]");
  if (!b || b.disabled) return;
  const d = b.dataset,
    a = d.action,
    p = state.player;
  let r = null;
  if (a === "close") {
    close();
    return;
  }
  if (a === "view") {
    ui.view = d.view;
    if (d.view === "galaxy") ui.selected = { type: "system", id: p.system };
    else
      ui.selected = {
        type: "planet",
        id: state.systems[p.system].planets[0].id,
      };
  } else if (a === "select-planet") {
    ui.selected = { type: "planet", id: d.id };
    ui.view = E.planet(state, d.id).system === p.system ? "system" : "galaxy";
  } else if (a === "select-ship") {
    ui.selected = { type: "ship", id: d.id };
    ui.view = "system";
    if (ui.modal === "signals") ui.modal = null;
  } else if (a === "zoom") renderer.zoom(Number(d.by));
  else if (a === "center") renderer.center();
  else if (a === "follow") renderer.follow();
  else if (a === "dock") {
    if (p.docked === d.id) {
      open("port", "overview");
      return;
    }
    r = E.orderDock(state, d.id);
  } else if (a === "move") r = E.orderMove(state, ui.selected);
  else if (a === "stop-flight") {
    p.order = null;
    ui.route = [];
    ui.destination = null;
    stop();
    r = { message: "Kurs aufgehoben." };
  } else if (a === "advance") {
    nextDay();
    return;
  } else if (a === "auto") {
    if (auto) stop();
    else if (!p.docked) auto = setInterval(nextDay, 850);
  } else if (
    [
      "ship",
      "missions",
      "log",
      "menu",
      "help",
      "navigation",
      "signals",
    ].includes(a)
  ) {
    open(a);
    return;
  } else if (a === "port") {
    open("port", "overview");
    return;
  } else if (a === "port-tab") ui.tab = d.tab;
  else if (a === "undock") {
    r = E.undock(state);
    ui.modal = null;
  } else if (a === "refuel") r = E.refuel(state);
  else if (a === "repair") r = E.repair(state);
  else if (a === "trade") r = E.trade(state, d.good, Number(d.amount));
  else if (a === "accept") r = E.acceptMission(state, d.id);
  else if (a === "claim") r = E.claim(state, d.id);
  else if (a === "mission-detail") {
    open("missions");
    return;
  } else if (a === "mission-route") {
    const m = state.missions.find((m) => m.id === d.id);
    const n = m.type === "bounty" && state.ships.find((n) => n.id === m.target);
    ui.modal = null;
    ui.selected = n
      ? { type: "ship", id: n.id }
      : { type: "planet", id: m.type === "bounty" ? m.origin : m.destination };
    ui.view = "system";
    if (!n && E.planet(state, ui.selected.id).system !== p.system)
      ui.view = "galaxy";
    r = {
      message: n
        ? "Gesuchtes Schiff markiert."
        : "Ziel markiert. Wähle Landeanflug oder Route planen.",
    };
  } else if (a === "nav-world") {
    ui.modal = null;
    ui.selected = { type: "planet", id: d.id };
    ui.view = E.planet(state, d.id).system === p.system ? "system" : "galaxy";
  } else if (a === "navigate") navigate(E.planet(state, d.id).system, d.id);
  else if (a === "navigate-system") navigate(Number(d.id));
  else if (a === "talk") {
    ui.selected = { type: "ship", id: d.id };
    ui.dialogueResponse = "";
    open("talk");
    return;
  } else if (a === "npc-action") {
    r = E.talk(state, ui.selected.id, d.kind);
    ui.dialogueResponse = r.message;
  } else if (a === "port-project") r = E.portAction(state, "project");
  else if (a === "learn") r = E.portAction(state, "learn:" + d.skill);
  else if (a === "buy-hull") r = E.buyHull(state, d.hull);
  else if (a === "buy-weapon") r = E.buyWeapon(state, d.weapon);
  else if (a === "upgrade") r = E.upgrade(state, d.module);
  else if (a === "toggle-weapon") {
    const gun = p.weapons[Number(d.slot)];
    if (gun) gun.active = !gun.active;
  } else if (a === "combat") {
    ui.selected = { type: "ship", id: d.id };
    open("combat");
    return;
  } else if (a === "lock") r = E.targetShip(state, d.id, false);
  else if (a === "fire") {
    if (p.combat.target !== d.id) r = E.targetShip(state, d.id, true);
    else r = E.setCombat(state, "fire", !p.combat.fire);
  } else if (a === "maneuver") r = E.setCombat(state, "mode", d.mode);
  else if (a === "combat-module")
    r = E.setCombat(state, d.module, !p.combat[d.module]);
  else if (a === "salvage") r = E.salvage(state, d.id);
  else if (a === "approach-wreck") {
    const w = state.wrecks.find((w) => w.id === d.id);
    if (w) r = E.orderMove(state, w);
  } else if (a === "emergency") r = E.emergency(state);
  else if (a === "save") {
    save();
    r = {
      message: ui.storage
        ? "Reise gespeichert."
        : "Speicherung fehlgeschlagen. Exportiere eine Sicherung.",
      ok: ui.storage,
    };
  } else if (a === "export") {
    const blob = new Blob([E.serialize(state)], { type: "application/json" }),
      url = URL.createObjectURL(blob),
      link = document.createElement("a");
    link.href = url;
    link.download = `weitraum-tag-${state.day}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    r = { message: "Spielstand exportiert." };
  } else if (a === "import") {
    $("import-file").click();
    return;
  } else if (a === "new-game") {
    if (
      confirm(
        "Aktuelle Reise ersetzen? Exportiere vorher eine Sicherung, wenn du sie behalten möchtest.",
      )
    ) {
      stop();
      ui.started = false;
      ui.modal = null;
      ui.route = [];
      state = E.newGame();
    }
  }
  if (r) notify(r);
  save();
  render();
});
$("app").addEventListener("submit", (event) => {
  if (event.target.id !== "start-form") return;
  event.preventDefault();
  const data = new FormData(event.target);
  state = E.newGame(String(data.get("seed")), String(data.get("name")));
  ui.started = true;
  ui.selected = { type: "planet", id: "p0-0" };
  notify({
    message:
      "Willkommen, Ranger. Wähle Landeanflug auf Haven, um deine erste Reise vorzubereiten.",
  });
  save();
  render();
});
$("dialog").addEventListener("cancel", (event) => {
  event.preventDefault();
  close();
});
$("dialog").addEventListener("click", (event) => {
  if (event.target === $("dialog")) {
    const r = $("dialog").getBoundingClientRect();
    if (
      event.clientX < r.left ||
      event.clientX > r.right ||
      event.clientY < r.top ||
      event.clientY > r.bottom
    )
      close();
  }
});
$("app").addEventListener("change", (event) => {
  const el = event.target;
  if (el.matches("[data-fit-slot]")) {
    notify(
      E.fit(
        state,
        Number(el.dataset.fitSlot),
        el.value === "remove" ? null : el.value,
      ),
    );
    save();
    render();
  } else if (el.id === "combat-range") {
    notify(E.setCombat(state, "range", Number(el.value)));
    save();
    render();
  }
});
$("import-file").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (file.size > 2_000_000) throw Error("Spielstand zu groß.");
    const restored = E.deserialize(await file.text());
    stop();
    state = restored;
    ui.route = [];
    ui.destination = null;
    ui.started = true;
    ui.modal = null;
    ui.selected = {
      type: "planet",
      id: state.systems[state.player.system].planets[0].id,
    };
    renderer.center();
    save();
    notify({ message: "Reise wiederhergestellt." });
  } catch (error) {
    notify({ ok: false, message: `Import fehlgeschlagen: ${error.message}` });
  }
  event.target.value = "";
  render();
});
document.addEventListener("keydown", (event) => {
  if (
    !ui.started ||
    ui.modal ||
    ["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(event.target.tagName)
  )
    return;
  if (event.code === "Space") {
    event.preventDefault();
    if (auto) {
      stop();
      render();
    } else nextDay();
  }
  if (event.key.toLowerCase() === "g") {
    ui.view = ui.view === "system" ? "galaxy" : "system";
    render();
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stop();
    save();
    render();
  }
});
window.addEventListener("beforeunload", save);
render();
