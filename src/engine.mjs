import {
  VERSION,
  SPECIES,
  GOODS,
  ECONOMIES,
  HULLS,
  WEAPONS,
  MACHINES,
  SYSTEM_NAMES,
  PLANET_NAMES,
  NPC_NAMES,
} from "./data.mjs";
export * from "./data.mjs";
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export function hash(text) {
  let n = 2166136261;
  for (const c of String(text)) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return n >>> 0;
}
function random(s) {
  s.rng = (Math.imul(s.rng, 1664525) + 1013904223) >>> 0;
  return s.rng / 4294967296;
}
const pick = (s, list) => list[Math.floor(random(s) * list.length)];
const uid = (s) => "o" + s.serial++;
const result = (ok, message) => ({ ok, message });
export function log(s, text, kind = "info") {
  s.log.unshift({ day: s.day, text, kind });
  s.log = s.log.slice(0, 70);
}
export function planet(s, id) {
  return s.systems.flatMap((v) => v.planets).find((p) => p.id === id);
}
export function position(p, day) {
  const a = p.angle + day * p.orbit;
  return { x: Math.cos(a) * p.radius, y: Math.sin(a) * p.radius * 0.76 };
}
export function stats(s) {
  const p = s.player,
    h = HULLS[p.hull],
    u = p.upgrades;
  return {
    ...h,
    hp: h.hp + u.reactor * 15,
    shield: h.shield + u.shield * 45,
    armor: h.armor,
    speed: h.speed + u.engine * 25,
    cargo: h.cargo + u.cargo * 15,
    capacitor: 100 + u.reactor * 35,
  };
}
export function usedCargo(s) {
  return (
    Object.values(s.player.cargo).reduce((a, b) => a + b, 0) +
    s.player.inventory.length * 2 +
    s.missions
      .filter((m) => m.status === "active" && m.type === "courier")
      .reduce((a, m) => a + m.amount, 0)
  );
}
export function price(s, p, good, side = "buy") {
  const g = GOODS.find((v) => v.id === good),
    e = ECONOMIES[p.economy];
  const affinity = e.exports.includes(good)
    ? 0.73
    : e.needs.includes(good)
      ? 1.28
      : 1;
  const stock = p.stock[good],
    skill = (s.player.skills.trade || 0) * 0.015;
  return Math.max(
    3,
    Math.round(
      g.base *
        affinity *
        clamp(1.28 - stock / 160, 0.58, 1.35) *
        (side === "sell" ? 0.88 : 1) *
        (side === "sell" ? 1 + skill : 1 - skill),
    ),
  );
}
export function route(s, from, to) {
  const queue = [[from]],
    seen = new Set([from]);
  while (queue.length) {
    const path = queue.shift(),
      end = path.at(-1);
    if (end === to) return path;
    for (const n of s.systems[end].links)
      if (!seen.has(n)) {
        seen.add(n);
        queue.push([...path, n]);
      }
  }
  return [];
}
function weapon(s, type) {
  return { uid: uid(s), type, level: 0, active: true, readyAt: 0 };
}
function spawn(s, system, role, index = 0) {
  const species = Object.keys(SPECIES)[system % 5],
    machine = role === "dominator" ? pick(s, Object.keys(MACHINES)) : null;
  const def = machine
    ? MACHINES[machine]
    : {
        hp: role === "pirate" ? 100 : 150,
        shield: role === "pirate" ? 50 : 85,
        armor: role === "pirate" ? 45 : 65,
        speed: role === "pirate" ? 160 : 180,
        damage: role === "ranger" ? 22 : role === "pirate" ? 17 : 8,
      };
  const a = random(s) * Math.PI * 2,
    r =
      role === "pirate"
        ? 880
        : role === "dominator"
          ? 650
          : 280 + random(s) * 420;
  const n = {
    id: uid(s),
    name: machine
      ? `${def.name}-${s.serial}`
      : NPC_NAMES[(system * 3 + index) % NPC_NAMES.length] + ` · ${s.serial}`,
    system,
    role,
    species,
    machine,
    hp: def.hp,
    maxHp: def.hp,
    shield: def.shield,
    maxShield: def.shield,
    armor: def.armor,
    maxArmor: def.armor,
    speed: def.speed,
    damage: def.damage,
    x: Math.cos(a) * r,
    y: Math.sin(a) * r * 0.76,
    angle: a,
    credits: 300 + Math.floor(random(s) * 700),
    career: pick(s, ["merchant", "courier", "salvager", "mechanic"]),
    cargo: 0,
    dest: s.systems[system].planets[index % 3].id,
    relation: 0,
    peaceUntil: -1,
    offeredAt: -20,
    lastAction: -20,
    lastPlayerHit: -20,
    escort: null,
    target: null,
  };
  s.ships.push(n);
  return n;
}
export function newGame(seed = "Freie Horizonte", name = "Ranger") {
  const s = {
    version: VERSION,
    seed: seed.slice(0, 80) || "Freie Horizonte",
    rng: hash(seed) || 1,
    serial: 1,
    day: 1,
    systems: [],
    ships: [],
    wrecks: [],
    missions: [],
    log: [],
    news: [],
    projects: {},
    metrics: { trades: 0, kills: 0, travels: 0 },
    player: null,
  };
  for (let i = 0; i < 18; i++) {
    const col = i % 6,
      row = Math.floor(i / 6),
      owner = i >= 15 ? "dominator" : Object.keys(SPECIES)[i % 5];
    const sys = {
      id: i,
      name: SYSTEM_NAMES[i],
      x: 100 + col * 190 + (row % 2 ? 40 : 0),
      y: 120 + row * 230 + ((i % 3) - 1) * 30,
      owner,
      pressure: i >= 15 ? 85 : Math.floor(random(s) * 20),
      links: [],
      visited: i === 0,
      planets: [],
    };
    for (let j = 0; j < 3; j++) {
      const economy = Object.keys(ECONOMIES)[(i + j) % 4],
        p = {
          id: `p${i}-${j}`,
          name: PLANET_NAMES[i * 3 + j],
          system: i,
          species: Object.keys(SPECIES)[(i + j) % 5],
          economy,
          radius: 220 + j * 235,
          angle: random(s) * 6.28,
          orbit: (0.009 + j * 0.003) * (j % 2 ? -1 : 1),
          size: 22 + j * 8,
          stock: Object.fromEntries(
            GOODS.map((g) => [g.id, 50 + Math.floor(random(s) * 60)]),
          ),
        };
      sys.planets.push(p);
    }
    s.systems.push(sys);
  }
  for (let i = 0; i < 18; i++) {
    const n = s.systems[i];
    for (const j of [i - 1, i + 1, i - 6, i + 6])
      if (
        j >= 0 &&
        j < 18 &&
        (Math.abs(i - j) === 6 || Math.floor(i / 6) === Math.floor(j / 6))
      )
        n.links.push(j);
  }
  const start = position(s.systems[0].planets[0], s.day);
  s.player = {
    name: name.trim().slice(0, 32) || "Ranger",
    hull: "wanderer",
    species: "human",
    system: 0,
    x: start.x + 140,
    y: start.y + 30,
    angle: 0,
    credits: 2100,
    hp: 150,
    shield: 90,
    armor: 70,
    fuel: 100,
    capacitor: 100,
    cargo: { food: 3, ore: 0, parts: 2, medicine: 0, tech: 0, luxury: 0 },
    inventory: [],
    weapons: [weapon(s, "laser"), weapon(s, "cannon")],
    upgrades: { engine: 0, shield: 0, cargo: 0, reactor: 0 },
    skills: { trade: 0, engineering: 0, diplomacy: 0 },
    xp: 0,
    rep: 0,
    kills: 0,
    docked: null,
    order: null,
    combat: {
      target: null,
      mode: "keep",
      range: 320,
      fire: false,
      lockAt: null,
      booster: false,
      repair: false,
      afterburner: false,
    },
    relations: Object.fromEntries(Object.keys(SPECIES).map((id) => [id, 0])),
  };
  for (const sys of s.systems) {
    for (let i = 0; i < (sys.owner === "dominator" ? 7 : 8); i++)
      spawn(
        s,
        sys.id,
        sys.owner === "dominator"
          ? "dominator"
          : i < 4
            ? "trader"
            : i < 6
              ? "ranger"
              : "pirate",
        i,
      );
  }
  log(
    s,
    "Willkommen in Sol. Lande auf Haven, sprich mit der Hafenvertretung und nimm deinen ersten Auftrag an.",
    "good",
  );
  log(
    s,
    "Vesper meldet Dominatorensignaturen an der Grenze. Die freien Flotten rüsten auf.",
    "war",
  );
  return s;
}
export function orderMove(s, target) {
  const p = s.player;
  if (p.docked || p.order?.type === "jump")
    return result(false, "Starte zuerst vom Hafen.");
  if (!Number.isFinite(target.x) || !Number.isFinite(target.y))
    return result(false, "Ungültiger Kurs.");
  p.combat.fire = false;
  p.combat.target = null;
  p.order = {
    type: "move",
    x: clamp(target.x, -1040, 1040),
    y: clamp(target.y, -800, 800),
  };
  return result(
    true,
    "Kurs gesetzt. Mit +1 Tag oder Autopilot fliegst du weiter.",
  );
}
export function orderDock(s, id) {
  const dest = planet(s, id),
    p = s.player;
  if (
    !dest ||
    dest.system !== p.system ||
    s.systems[p.system].owner === "dominator"
  )
    return result(false, "Dieser Hafen ist nicht erreichbar.");
  if (p.order?.type === "jump")
    return result(false, "Der Hyperraumsprung läuft bereits.");
  if (p.docked) return result(false, "Du bist bereits gelandet.");
  p.combat.target = null;
  p.combat.fire = false;
  p.order = { type: "dock", id };
  return result(true, `Landeanflug auf ${dest.name}.`);
}
export function undock(s) {
  if (!s.player.docked) return result(false, "Du bist bereits im All.");
  s.player.docked = null;
  log(s, "Startfreigabe erteilt. Gute Reise.");
  return result(true, "Startfreigabe erteilt.");
}
export function jumpCost(s, to) {
  const p = s.player;
  return 13 + Math.round(distance(s.systems[p.system], s.systems[to]) / 70);
}
export function orderJump(s, to) {
  const p = s.player,
    sys = s.systems[p.system];
  if (p.docked) return result(false, "Starte vor dem Sprung.");
  if (p.order?.type === "jump")
    return result(false, "Ein Sprung läuft bereits.");
  if (!sys.links.includes(to))
    return result(false, "Wähle ein benachbartes System.");
  const cost = jumpCost(s, to),
    a = Math.atan2(s.systems[to].y - sys.y, s.systems[to].x - sys.x),
    exit = { x: Math.cos(a) * 1060, y: Math.sin(a) * 790 },
    required = cost + Math.ceil((distance(p, exit) / stats(s).speed) * 0.7);
  if (p.fuel < required)
    return result(
      false,
      `Für Randanflug und Sprung fehlen ${Math.ceil(required - p.fuel)} Treibstoff. Lege einen Tankstopp ein.`,
    );
  p.order = { type: "jump", to, phase: "approach", ...exit, angle: a, cost };
  p.combat.target = null;
  p.combat.fire = false;
  return result(
    true,
    `Kurs auf ${s.systems[to].name}. Randanflug, dann Hyperraumsprung · ca. ${required} Treibstoff.`,
  );
}
export function trade(s, id, amount) {
  const p = s.player,
    dest = planet(s, p.docked),
    g = GOODS.find((g) => g.id === id);
  if (!dest || !g || !Number.isInteger(amount) || !amount)
    return result(false, "Handel ist im Hafen möglich.");
  const buy = amount > 0,
    q = Math.abs(amount),
    cost = q * price(s, dest, id, buy ? "buy" : "sell");
  if (
    buy &&
    (dest.stock[id] < q ||
      usedCargo(s) + q > stats(s).cargo ||
      p.credits < cost)
  )
    return result(false, "Nicht genug Credits, Vorrat oder Frachtraum.");
  if (!buy && p.cargo[id] < q)
    return result(false, "Nicht genug Ware an Bord.");
  dest.stock[id] -= amount;
  p.cargo[id] += amount;
  p.credits += buy ? -cost : cost;
  p.xp += 1;
  s.metrics.trades++;
  return result(
    true,
    `${q} t ${g.name} ${buy ? "gekauft" : "verkauft"} · ${cost} cr.`,
  );
}
export function refuel(s) {
  const p = s.player;
  if (!p.docked) return result(false, "Tanken ist im Hafen möglich.");
  const amount = Math.min(stats(s).fuel - p.fuel, Math.floor(p.credits / 3));
  if (amount < 0.1) return result(false, "Tank voll oder nicht genug Credits.");
  p.fuel += amount;
  p.credits -= Math.ceil(amount * 3);
  return result(true, `${Math.round(amount)} Treibstoff getankt.`);
}
export function repair(s) {
  const p = s.player,
    st = stats(s);
  if (!p.docked) return result(false, "Reparaturen sind im Hafen möglich.");
  const cost = Math.ceil((st.hp - p.hp) * 2 + (st.armor - p.armor) * 1.5);
  if (p.credits < cost)
    return result(false, `Die Reparatur kostet ${cost} cr.`);
  p.credits -= cost;
  p.hp = st.hp;
  p.armor = st.armor;
  p.shield = st.shield;
  p.capacitor = st.capacitor;
  return result(true, `Schiff vollständig instand gesetzt · ${cost} cr.`);
}
export function upgrade(s, id) {
  const p = s.player;
  if (!Object.hasOwn(p.upgrades, id) || !p.docked)
    return result(false, "Bordausbauten erfordern eine Werft.");
  const level = p.upgrades[id],
    cost = 450 * (level + 1);
  if (level >= 4 || p.credits < cost)
    return result(false, "Ausbau nicht verfügbar oder zu teuer.");
  p.credits -= cost;
  p.upgrades[id]++;
  if (id === "shield") p.shield += 45;
  if (id === "reactor") {
    p.hp += 15;
    p.capacitor += 35;
  }
  return result(true, "Bordsystem ausgebaut.");
}
export function buyHull(s, id) {
  const p = s.player,
    h = HULLS[id];
  if (!h || !p.docked || id === p.hull || p.credits < h.cost)
    return result(false, "Schiff ist nicht verfügbar.");
  const excess = p.weapons.slice(h.slots).filter(Boolean),
    capacity = h.cargo + p.upgrades.cargo * 15;
  if (usedCargo(s) + excess.length * 2 > capacity)
    return result(false, "Das neue Schiff hat zu wenig Frachtraum.");
  p.credits -= h.cost;
  p.inventory.push(...excess);
  p.weapons = p.weapons.slice(0, h.slots);
  while (p.weapons.length < h.slots) p.weapons.push(null);
  p.hull = id;
  const st = stats(s);
  p.hp = st.hp;
  p.armor = st.armor;
  p.shield = st.shield;
  p.fuel = Math.min(p.fuel, st.fuel);
  return result(
    true,
    `${h.name} übernommen. Ausrüstung und Fracht sind an Bord.`,
  );
}
export function buyWeapon(s, type) {
  const p = s.player,
    w = WEAPONS[type];
  if (
    !w ||
    !p.docked ||
    p.credits < w.cost ||
    usedCargo(s) + 2 > stats(s).cargo
  )
    return result(
      false,
      "Kauf benötigt einen Hafen, Credits und 2 t Frachtraum.",
    );
  p.credits -= w.cost;
  p.inventory.push(weapon(s, type));
  return result(
    true,
    `${w.name} liegt im Inventar. Wähle einen Waffenplatz zum Einbau.`,
  );
}
export function fit(s, slot, itemId) {
  const p = s.player;
  if (
    !p.docked ||
    !Number.isInteger(slot) ||
    slot < 0 ||
    slot >= p.weapons.length
  )
    return result(false, "Einbau ist im Hafen möglich.");
  const old = p.weapons[slot];
  if (itemId === null) {
    if (!old) return result(false, "Dieser Platz ist frei.");
    if (usedCargo(s) + 2 > stats(s).cargo)
      return result(false, "Zu wenig Frachtraum für den Ausbau.");
    p.inventory.push(old);
    p.weapons[slot] = null;
    return result(true, "Waffe ausgebaut.");
  }
  const item = p.inventory.find((v) => v.uid === itemId);
  if (!item) return result(false, "Gegenstand nicht im Inventar.");
  p.inventory = p.inventory.filter((v) => v.uid !== itemId);
  if (old) p.inventory.push(old);
  p.weapons[slot] = item;
  return result(
    true,
    `${WEAPONS[item.type].name} in Platz ${slot + 1} eingebaut.`,
  );
}
function advanceActor(n, target, speed) {
  const d = distance(n, target);
  if (d <= speed) {
    n.x = target.x;
    n.y = target.y;
    return true;
  }
  n.angle = Math.atan2(target.y - n.y, target.x - n.x);
  n.x += Math.cos(n.angle) * speed;
  n.y += Math.sin(n.angle) * speed;
  return false;
}
function deliver(s) {
  for (const m of s.missions) {
    if (
      m.status !== "active" ||
      m.destination !== s.player.docked ||
      s.day > m.deadline
    )
      continue;
    if (m.type === "supply") {
      if (s.player.cargo[m.good] < m.amount) continue;
      s.player.cargo[m.good] -= m.amount;
      planet(s, m.destination).stock[m.good] += m.amount;
    }
    if (
      m.type === "escort" &&
      !s.ships.some(
        (n) =>
          n.id === m.target &&
          n.system === s.player.system &&
          distance(n, s.player) < 400,
      )
    )
      continue;
    if (m.type !== "bounty") {
      m.status = "ready";
      m.completed = s.day;
      log(
        s,
        `${m.title}: Leistung bestätigt. ${m.reward} cr warten auf Abholung. 💠`,
        "good",
      );
    }
  }
}
export function contracts(s, id) {
  const p = planet(s, id);
  if (!p) return [];
  const other = s.systems[p.system].planets.find((v) => v.id !== id),
    neighbor =
      s.systems[
        s.systems[p.system].links.find(
          (i) => s.systems[i].owner !== "dominator",
        ) ?? p.system
      ].planets[0];
  return [
    {
      id: `courier:${id}:${Math.floor(s.day / 12)}`,
      type: "courier",
      title: `Depesche nach ${other.name}`,
      origin: id,
      destination: other.id,
      amount: 2,
      reward: 420,
      xp: 30,
      deadline: s.day + 25,
      description: `Überbringe eine versiegelte Depesche nach ${other.name}. 2 t reservierter Frachtraum.`,
    },
    {
      id: `supply:${id}:${Math.floor(s.day / 12)}`,
      type: "supply",
      title: `Maschinen für ${neighbor.name}`,
      origin: id,
      destination: neighbor.id,
      good: "parts",
      amount: 4,
      reward: 1150,
      xp: 60,
      deadline: s.day + 55,
      description: `Beschaffe 4 t Maschinen und liefere sie nach ${neighbor.name} im System ${s.systems[neighbor.system].name}.`,
    },
  ];
}
export function acceptMission(s, id) {
  const p = s.player;
  if (!p.docked) return result(false, "Aufträge werden im Hafen vergeben.");
  const m = contracts(s, p.docked).find((m) => m.id === id);
  if (
    !m ||
    s.missions.some((v) => v.id === id) ||
    s.missions.filter((v) => v.status === "active").length >= 6
  )
    return result(false, "Auftrag bereits angenommen oder Auftragsbuch voll.");
  if (m.type === "courier" && usedCargo(s) + m.amount > stats(s).cargo)
    return result(false, "Zu wenig Frachtraum für die Depesche.");
  s.missions.push({ ...m, status: "active" });
  return result(
    true,
    "Auftrag angenommen. Die Zielwelt ist im Auftragsbuch markiert.",
  );
}
export function claim(s, id) {
  const m = s.missions.find((v) => v.id === id);
  if (
    !m ||
    m.status !== "ready" ||
    s.player.docked !== (m.type === "bounty" ? m.origin : m.destination)
  )
    return result(
      false,
      "Prämie kann nur im angegebenen Hafen abgeholt werden.",
    );
  m.status = "paid";
  m.paid = s.day;
  s.player.credits += m.reward;
  s.player.xp += m.xp;
  s.player.rep += 2;
  log(s, `Quittung: ${m.title} · ${m.reward} cr ausgezahlt.`, "good");
  return result(true, `${m.reward} cr und ${m.xp} Erfahrung erhalten.`);
}
export function hitChance(w, target, range, orbit = false) {
  if (range > w.optimal + w.falloff * 2) return 0;
  if (w.type === "explosive") return clamp(1 - target.speed / 600, 0.3, 1);
  const fall = Math.max(0, range - w.optimal) / w.falloff;
  const tracking = orbit ? target.speed / 280 / w.tracking : 0.12;
  return clamp(Math.pow(0.5, fall * fall + tracking * tracking), 0.04, 0.98);
}
const resist = {
  em: [0.9, 0.45, 0.7],
  kinetic: [0.7, 0.7, 0.8],
  thermal: [0.8, 0.65, 0.8],
  explosive: [0.5, 0.95, 0.85],
};
export function damage(target, raw, type = "kinetic") {
  const layers = ["shield", "armor", "hp"],
    r = resist[type];
  let remaining = raw;
  for (let i = 0; i < 3 && remaining > 0; i++) {
    const applied = Math.min(target[layers[i]], remaining * r[i]);
    target[layers[i]] -= applied;
    remaining -= applied / r[i];
  }
  return raw - remaining;
}
export function targetShip(s, id, fire = false) {
  const p = s.player,
    n = s.ships.find((n) => n.id === id);
  if (p.docked || !n || n.system !== p.system || distance(p, n) > 1100)
    return result(false, "Ziel liegt außerhalb der Sensorreichweite.");
  if (p.order?.type === "jump")
    return result(false, "Während des Sprungs ist keine Aufschaltung möglich.");
  if (fire && ["trader", "ranger"].includes(n.role))
    return result(
      false,
      "Zivile und verbündete Schiffe können nicht angegriffen werden.",
    );
  p.order = null;
  Object.assign(p.combat, { target: id, fire, lockAt: s.day + 2 });
  return result(true, `Zielaufschaltung: ${n.name} · 2 Tage.`);
}
export function setCombat(s, key, value) {
  const c = s.player.combat;
  if (key === "mode" && ["approach", "keep", "orbit", "flee"].includes(value))
    c.mode = value;
  else if (key === "range" && [180, 320, 550, 750].includes(Number(value)))
    c.range = Number(value);
  else if (["fire", "booster", "repair", "afterburner"].includes(key)) {
    if (key === "fire" && value) {
      const n = s.ships.find((n) => n.id === c.target);
      if (!n || !["pirate", "dominator"].includes(n.role))
        return result(false, "Kein feindliches Ziel aufgeschaltet.");
    }
    c[key] = !!value;
  } else return result(false, "Ungültiger Kampfbefehl.");
  return result(true, "Kampfbefehl übernommen.");
}
export function salvage(s, id) {
  const p = s.player,
    w = s.wrecks.find((w) => w.id === id);
  if (!w || p.docked || w.system !== p.system || distance(p, w) > 190)
    return result(false, "Fliege bis auf 190 AE an das Wrack heran.");
  const room = stats(s).cargo - usedCargo(s),
    q = Math.min(w.parts, Math.floor(room));
  if (q === 0 && w.credits === 0)
    return result(false, "Frachtraum voll oder Wrack leer.");
  p.cargo.parts += q;
  w.parts -= q;
  p.credits += w.credits;
  const credits = w.credits;
  w.credits = 0;
  p.xp += 10;
  if (w.parts === 0) s.wrecks = s.wrecks.filter((v) => v.id !== id);
  return result(true, `${q} t Maschinen und ${credits} cr geborgen.`);
}
function dock(s, id) {
  const p = s.player;
  p.docked = id;
  p.order = null;
  p.combat.target = null;
  p.combat.fire = false;
  p.shield = stats(s).shield;
  p.capacitor = stats(s).capacitor;
  Object.assign(p, position(planet(s, id), s.day));
  deliver(s);
  log(s, `Landung auf ${planet(s, id).name}. Hafenfreigabe erteilt.`, "good");
}
function tickPlayer(s) {
  const p = s.player,
    st = stats(s),
    c = p.combat;
  p.capacitor = Math.min(
    st.capacitor,
    p.capacitor + 8 + p.upgrades.reactor * 2,
  );
  p.shield = Math.min(st.shield, p.shield + 2);
  if (p.docked) {
    Object.assign(p, position(planet(s, p.docked), s.day));
    return;
  }
  let speed = st.speed;
  if (c.afterburner && p.capacitor >= 10) {
    p.capacitor -= 10;
    speed *= 1.5;
  }
  if (c.booster && p.capacitor >= 12) {
    p.capacitor -= 12;
    p.shield = Math.min(st.shield, p.shield + 24);
  }
  if (c.repair && p.capacitor >= 14) {
    p.capacitor -= 14;
    p.armor = Math.min(st.armor, p.armor + 18);
  }
  const n = s.ships.find((n) => n.id === c.target && n.system === p.system);
  if (c.target && !n) {
    c.target = null;
    c.fire = false;
  }
  const o = p.order;
  if (o?.type === "jump" && o.phase !== "approach") {
    if (o.phase === "depart") {
      o.phase = "hyperspace";
      p.fuel = Math.max(0, p.fuel - o.cost);
      log(
        s,
        `Hyperraumfenster geöffnet. Nächstes System: ${s.systems[o.to].name}.`,
      );
    } else {
      p.system = o.to;
      p.x = -Math.cos(o.angle) * 990;
      p.y = -Math.sin(o.angle) * 730;
      p.angle = o.angle;
      s.systems[p.system].visited = true;
      p.order = null;
      s.metrics.travels++;
      log(
        s,
        `${s.systems[p.system].name} erreicht. Lokale Funkkanäle werden verbunden.`,
        "good",
      );
    }
    return;
  }
  let destination = null;
  if (o?.type === "move") destination = o;
  if (o?.type === "dock") destination = position(planet(s, o.id), s.day);
  if (o?.type === "jump") destination = o;
  if (!o && n) {
    const a = Math.atan2(p.y - n.y, p.x - n.x),
      range = c.mode === "approach" ? 110 : c.mode === "flee" ? 1100 : c.range,
      angle = a + (c.mode === "orbit" ? 0.48 : 0);
    destination = {
      x: n.x + Math.cos(angle) * range,
      y: n.y + Math.sin(angle) * range,
    };
  }
  if (destination && p.fuel >= 0.7) {
    const before = { x: p.x, y: p.y };
    const arrived = advanceActor(p, destination, speed);
    p.fuel = Math.max(0, p.fuel - (distance(before, p) / st.speed) * 0.7);
    if (arrived) {
      if (o?.type === "dock") dock(s, o.id);
      else if (o?.type === "jump") o.phase = "depart";
      else if (o?.type === "move") p.order = null;
    }
  }
  if (n && c.fire && s.day >= c.lockAt) {
    for (const gun of p.weapons) {
      if (!gun || !gun.active || gun.readyAt > s.day) continue;
      const w = WEAPONS[gun.type],
        range = distance(p, n),
        chance = hitChance(w, n, range, c.mode === "orbit");
      if (!chance || p.capacitor < w.cap) continue;
      p.capacitor -= w.cap;
      gun.readyAt = s.day + w.cycle;
      n.lastPlayerHit = s.day;
      if (random(s) < chance) {
        damage(n, w.damage * (1 + gun.level * 0.15), w.type);
        s.effects.push({
          from: { x: p.x, y: p.y },
          to: { x: n.x, y: n.y },
          kind: gun.type,
        });
      }
    }
  }
}
function crossNPC(s, n, to) {
  const here = s.systems[n.system],
    next = s.systems[to],
    a = Math.atan2(next.y - here.y, next.x - here.x);
  if (
    advanceActor(n, { x: Math.cos(a) * 1060, y: Math.sin(a) * 790 }, n.speed)
  ) {
    n.system = to;
    n.x = -Math.cos(a) * 990;
    n.y = -Math.sin(a) * 730;
    n.target = null;
    if (to === s.player.system)
      news(s, `${n.name.split(" ·")[0]}: Einflug aus ${here.name}.`);
  }
  return true;
}
function tickNPC(s, n) {
  if (n.hp <= 0) return;
  if (
    n.escort &&
    !s.missions.some((m) => m.id === n.escort && m.status === "active")
  )
    n.escort = null;
  n.shield = Math.min(n.maxShield, n.shield + 1.5);
  const local = s.ships.filter(
      (v) => v.system === n.system && v.id !== n.id && v.hp > 0,
    ),
    p = s.player;
  if (
    n.escort &&
    s.missions.some((m) => m.id === n.escort && m.status === "active")
  ) {
    const m = s.missions.find((m) => m.id === n.escort);
    if (n.system === p.system)
      advanceActor(n, { x: p.x - 70, y: p.y + 50 }, n.speed * 1.5);
    return;
  }
  if (n.role === "trader") {
    if (n.career === "salvager") {
      const w = s.wrecks.find(
        (w) => w.system === n.system && (w.credits || w.parts),
      );
      if (w) {
        if (advanceActor(n, w, n.speed)) {
          n.credits += w.credits;
          w.credits = 0;
          w.parts = Math.max(0, w.parts - 2);
        }
        return;
      }
    }
    if (n.career === "mechanic") {
      const patient = local.find(
        (v) =>
          v.role !== "pirate" && v.role !== "dominator" && v.hp < v.maxHp * 0.7,
      );
      if (patient) {
        if (distance(n, patient) < 150)
          patient.hp = Math.min(patient.maxHp, patient.hp + 16);
        else advanceActor(n, patient, n.speed);
        return;
      }
    }
    const dest = planet(s, n.dest);
    if (dest.system !== n.system)
      return crossNPC(s, n, route(s, n.system, dest.system)[1]);
    if (advanceActor(n, position(dest, s.day), n.speed)) {
      const markets = s.systems[n.system].links.filter(
          (i) => s.systems[i].owner !== "dominator",
        ),
        next = markets.length && random(s) < 0.3 ? pick(s, markets) : n.system;
      n.dest = pick(s, s.systems[next].planets).id;
      n.cargo = 0;
      n.credits = clamp(n.credits + 30, 0, 4000);
      s.metrics.trades++;
      if (s.day % 5 === 0 && n.system === p.system)
        news(
          s,
          `${n.name.split(" ·")[0]}: Handel auf ${dest.name} abgeschlossen.`,
        );
    }
    return;
  }
  let candidates = local.filter((v) =>
    n.role === "dominator"
      ? v.role !== "dominator"
      : n.role === "ranger"
        ? ["pirate", "dominator"].includes(v.role)
        : v.role === "trader",
  );
  if (
    !p.docked &&
    p.system === n.system &&
    p.order?.phase !== "hyperspace" &&
    (n.role === "dominator" || (n.role === "pirate" && n.peaceUntil < s.day))
  )
    candidates.push({ ...p, id: "player" });
  candidates.sort((a, b) => distance(n, a) - distance(n, b));
  const preferred = n.target && candidates.find((v) => v.id === n.target),
    t = preferred || candidates[0];
  if (
    t &&
    distance(n, t) < (preferred ? 4000 : n.role === "pirate" ? 550 : 850)
  ) {
    n.target = t.id;
    const range = distance(n, t);
    if (range > 240) advanceActor(n, t, n.speed);
    if (range < 390 && s.day % 2 === 0) {
      const actual = t.id === "player" ? p : s.ships.find((v) => v.id === t.id);
      if (actual) {
        damage(actual, n.damage, "kinetic");
        if (n.system === p.system)
          s.effects.push({
            from: { x: n.x, y: n.y },
            to: { x: actual.x, y: actual.y },
            kind: "enemy",
          });
      }
    }
  } else {
    const sys = s.systems[n.system],
      invade =
        n.role === "dominator" &&
        hash(n.id) % 3 === 0 &&
        local.filter((v) => v.role === "dominator").length >= 3
          ? sys.links.find((i) => s.systems[i].owner !== "dominator")
          : null,
      patrol =
        n.role === "ranger" && hash(n.id) % 4 === 0
          ? sys.links.find((i) => s.systems[i].owner === "dominator")
          : null;
    if (invade !== null && invade !== undefined) return crossNPC(s, n, invade);
    if (patrol !== null && patrol !== undefined && s.day % 30 > 18)
      return crossNPC(s, n, patrol);
    const a = s.day * 0.07 + (hash(n.id) % 628) / 100;
    advanceActor(
      n,
      {
        x: Math.cos(a) * (n.role === "pirate" ? 800 : 480),
        y: Math.sin(a) * 500,
      },
      n.speed * 0.45,
    );
  }
}
function news(s, text) {
  s.news.unshift({ day: s.day, text });
  s.news = s.news.slice(0, 12);
}
function tickWorld(s) {
  for (const n of s.ships.filter((n) => n.hp <= 0)) {
    s.wrecks.push({
      id: uid(s),
      name: `Wrack · ${n.name}`,
      system: n.system,
      x: n.x,
      y: n.y,
      parts: 2 + Math.floor(random(s) * 5),
      credits: 60 + Math.floor(random(s) * 150),
      expires: s.day + 35,
    });
    if (n.lastPlayerHit >= s.day - 3) {
      const bounty =
        n.role === "dominator" ? 360 : n.role === "pirate" ? 210 : 0;
      s.player.credits += bounty;
      s.player.xp += 40;
      s.player.kills++;
      s.metrics.kills++;
      log(
        s,
        `${n.name} zerstört · ${bounty} cr Kopfgeld. Ein Wrack bleibt zurück.`,
        "good",
      );
      for (const m of s.missions)
        if (m.status === "active" && m.type === "bounty" && m.target === n.id) {
          m.status = "ready";
          m.completed = s.day;
        }
    }
    for (const m of s.missions)
      if (m.status === "active" && m.type === "escort" && m.target === n.id) {
        m.status = "failed";
        log(s, `${m.title}: Konvoischiff verloren.`, "bad");
      }
  }
  s.ships = s.ships.filter((n) => n.hp > 0);
  s.wrecks = s.wrecks.filter(
    (w) => w.expires > s.day && (w.parts || w.credits),
  );
  for (const sys of s.systems) {
    const local = s.ships.filter((n) => n.system === sys.id),
      machines = local.filter((n) => n.role === "dominator").length,
      defenders =
        local.filter((n) => n.role === "ranger").length +
        (sys.id === 0 ? 5 : 2);
    sys.pressure = clamp(
      sys.pressure + (machines ? machines - defenders : -0.2),
      0,
      100,
    );
    if (sys.pressure >= 100 && sys.owner !== "dominator") {
      sys.owner = "dominator";
      log(s, `${sys.name} wurde von Dominatoren besetzt.`, "war");
    }
    if (sys.pressure === 0 && sys.owner === "dominator") {
      sys.owner = sys.planets[0].species;
      log(s, `${sys.name} ist wieder frei.`, "good");
    }
    if (s.day % 4 === 0 && local.length < 12) {
      const roles =
        sys.owner === "dominator"
          ? ["dominator"]
          : ["trader", "ranger", "pirate"];
      spawn(s, sys.id, pick(s, roles), s.day);
    }
    for (const p of sys.planets)
      for (const g of GOODS) {
        const e = ECONOMIES[p.economy];
        p.stock[g.id] = clamp(
          p.stock[g.id] +
            (e.exports.includes(g.id) ? 3 : e.needs.includes(g.id) ? -1 : 0),
          5,
          180,
        );
      }
  }
  for (const m of s.missions)
    if (m.status === "active" && s.day > m.deadline) {
      m.status = "failed";
      log(s, `${m.title}: Frist abgelaufen.`, "bad");
    }
  if (s.player.hp <= 0) {
    const p = s.player,
      loss = Math.min(p.credits, Math.ceil(p.credits * 0.25));
    p.credits -= loss;
    const st = stats(s);
    p.hp = st.hp * 0.65;
    p.armor = st.armor * 0.5;
    p.fuel = Math.max(35, p.fuel);
    p.system = 0;
    dock(s, "p0-0");
    p.cargo = Object.fromEntries(GOODS.map((g) => [g.id, 0]));
    log(
      s,
      `Rettungskapsel geborgen. ${loss} cr Bergungskosten und Frachtverlust. Dein Schiff wird auf Haven wiederaufgebaut.`,
      "bad",
    );
  }
}
export function tick(s) {
  s.effects = [];
  s.day++;
  tickPlayer(s);
  for (const n of s.ships) tickNPC(s, n);
  tickWorld(s);
  return s;
}
export function emergency(s) {
  const p = s.player;
  if (p.docked) return result(false, "Im Hafen kannst du regulär tanken.");
  if (p.fuel >= 15)
    return result(
      false,
      "Pannenhilfe steht bei weniger als 15 Treibstoff bereit.",
    );
  const cost = Math.min(p.credits, 180);
  p.credits -= cost;
  p.fuel = Math.min(stats(s).fuel, p.fuel + 35);
  for (let i = 0; i < 3; i++) tick(s);
  log(
    s,
    `Pannenhilfe eingetroffen. 35 Treibstoff · ${cost} cr · 3 Tage.`,
    "good",
  );
  return result(true, "Pannenhilfe abgeschlossen.");
}
export const contactPrice = (n) =>
  Math.max(120, 165 - Math.floor(Math.max(0, n.relation) / 4) * 5);
export function greeting(s, id) {
  const n = s.ships.find((n) => n.id === id);
  if (!n) return "Signal verloren.";
  if (n.role === "dominator")
    return `${MACHINES[n.machine].name.toUpperCase()} · ORGANISCHE SIGNATUR ERKANNT · ABFANGPROTOKOLL AKTIV`;
  if (n.role === "pirate")
    return n.peaceUntil >= s.day
      ? `Unsere Abmachung gilt bis Tag ${n.peaceUntil}. Bleib auf deinem Kurs, und wir bleiben auf unserem.`
      : n.relation < 0
        ? "Deinen letzten Bluff habe ich nicht vergessen. Was willst du diesmal?"
        : "Du fliegst durch unser Revier. Lass uns über eine angemessene Durchfluggebühr sprechen.";
  if (n.hp < n.maxHp * 0.7)
    return "Unsere Hülle verliert Druck. Hast du Maschinen für eine Feldreparatur? Zwei Tonnen könnten uns retten.";
  if (n.escort)
    return `Wir halten Formation. Bring uns sicher nach ${planet(s, s.missions.find((m) => m.id === n.escort)?.destination || n.dest).name}.`;
  if (n.role === "ranger") {
    const target = s.ships.find((v) => v.id === n.target);
    return target
      ? `Patrouille bestätigt. Wir verfolgen ${target.name.split(" ·")[0]}. Halte die Flugbahn frei.`
      : "Patrouille bestätigt. Wenn du helfen willst, haben wir Arbeit für dich.";
  }
  if (n.relation >= 8)
    return `Gut, deine Signatur wiederzusehen. Für Freunde habe ich einen besseren Preis: drei Tonnen Maschinen für ${contactPrice(n)} Credits.`;
  return `Hier ${n.name.split(" ·")[0]}. Unser Kurs führt nach ${planet(s, n.dest).name}. ${n.career === "salvager" ? "Wir suchen verlassene Wracks." : n.career === "mechanic" ? "Wir helfen beschädigten Schiffen unterwegs." : n.career === "courier" ? "Die nächste Depesche wartet bereits." : "Vielleicht passen unsere Handelsrouten zusammen."}`;
}
export function npcActions(s, id) {
  const n = s.ships.find((n) => n.id === id);
  if (!n) return [];
  if (n.role === "dominator")
    return [
      {
        id: "scan",
        label: "Maschinensignal analysieren",
        detail: "Keine organischen Lebenszeichen. Schwachpunkte untersuchen.",
      },
    ];
  if (n.role === "pirate")
    return [
      {
        id: "pay",
        label: "Durchflug aushandeln",
        detail: "160 cr für 12 Tage Waffenruhe.",
      },
      {
        id: "bluff",
        label: "Mit einer Patrouille bluffen",
        detail:
          "Diplomatie verbessert die Erfolgschance. Ein Fehlschlag provoziert den Piraten.",
      },
      {
        id: "patrol",
        label: "Patrouille verständigen",
        detail:
          "Ein Ranger nimmt die Verfolgung auf, falls einer im System ist.",
      },
    ];
  if (n.role === "ranger")
    return [
      {
        id: "bounty",
        label: "Jagdauftrag annehmen",
        detail:
          "Ein konkretes Piratenschiff aufspüren und die Prämie im Heimathafen abholen.",
      },
      {
        id: "repair",
        label: "Feldreparatur anbieten",
        detail:
          "2 t Maschinen gegen 240 cr und Ansehen. Nur für beschädigte Schiffe.",
      },
    ];
  return [
    {
      id: "deal",
      label: "Frachtangebot annehmen",
      detail: `3 t Maschinen für ${contactPrice(n)} cr. Vertrauen verbessert den Preis. Nur solange Vorrat und Frachtraum reichen.`,
    },
    {
      id: "escort",
      label: "Konvoischutz übernehmen",
      detail:
        "Begleite dieses Schiff zur nächsten Welt. 480 cr nach erfolgreicher Ankunft.",
    },
    {
      id: "fuel",
      label: "Treibstoff tauschen",
      detail: "Bis zu 15 Treibstoff · 6 cr je übertragener Einheit.",
    },
    {
      id: "repair",
      label: "Feldreparatur anbieten",
      detail: "2 t Maschinen gegen 240 cr und eine bessere Beziehung.",
    },
  ];
}
export function talk(s, id, action) {
  const p = s.player,
    n = s.ships.find((n) => n.id === id);
  if (
    !n ||
    n.system !== p.system ||
    p.docked ||
    distance(n, p) > 850 ||
    p.order?.type === "jump"
  )
    return result(false, "Kontakt außerhalb der Funkreichweite.");
  if (!npcActions(s, id).some((a) => a.id === action))
    return result(false, "Diese Antwort ist nicht verfügbar.");
  if (n.lastAction === s.day)
    return result(false, "Der Kontakt hat für heute bereits gehandelt.");
  let message = "";
  if (action === "scan") {
    p.xp += 5;
    message = `${MACHINES[n.machine].name}: Schild ${Math.ceil(n.shield)}, Panzerung ${Math.ceil(n.armor)}. Die Signatur reagiert auf deine Sensoren.`;
    n.target = "player";
  }
  if (action === "pay") {
    if (p.credits < 160) return result(false, "Dafür benötigst du 160 cr.");
    p.credits -= 160;
    n.credits += 160;
    n.peaceUntil = s.day + 12;
    n.target = null;
    message =
      "Abgemacht. Zwölf Tage lang gehört dein Transponder zu unseren Freunden.";
  }
  if (action === "bluff") {
    if (hash(s.seed + n.id + s.day) % 100 < 35 + p.skills.diplomacy * 12) {
      n.peaceUntil = s.day + 8;
      n.target = null;
      p.xp += 15;
      message =
        "Schon gut. Wir ziehen uns zurück. Dein Bluff hat funktioniert.";
    } else {
      n.peaceUntil = -1;
      n.target = "player";
      n.relation -= 8;
      message =
        "Ich sehe keine Patrouille auf dem Schirm. Du wirst mir das erklären müssen.";
    }
  }
  if (action === "patrol") {
    const ranger = s.ships.find(
      (v) => v.system === n.system && v.role === "ranger",
    );
    if (!ranger) return result(false, "Keine freie Patrouille im System.");
    ranger.target = n.id;
    p.rep += 1;
    message = `${ranger.name.split(" ·")[0]} bestätigt deinen Ruf und nimmt Abfangkurs.`;
  }
  if (action === "deal") {
    const cost = contactPrice(n);
    if (p.credits < cost || usedCargo(s) + 3 > stats(s).cargo || n.cargo >= 9)
      return result(
        false,
        "Angebot nicht verfügbar: Credits, Frachtraum oder Vorrat fehlen.",
      );
    p.credits -= cost;
    n.credits += cost;
    p.cargo.parts += 3;
    n.cargo += 3;
    n.relation += 4;
    message = `Drei Tonnen Maschinen für ${cost} cr. Gute Ware, guter Preis. Es war mir ein Vergnügen.`;
  }
  if (action === "fuel") {
    const q = Math.min(15, stats(s).fuel - p.fuel),
      cost = Math.ceil(q * 6);
    if (q <= 0 || p.credits < cost)
      return result(false, "Tank voll oder zu wenig Credits.");
    p.credits -= cost;
    p.fuel += q;
    message = `Transfer abgeschlossen. ${Math.round(q)} Treibstoff sind unterwegs. Gute Reise!`;
  }
  if (action === "repair") {
    if (n.hp >= n.maxHp * 0.85 || p.cargo.parts < 2 || distance(n, p) > 220)
      return result(
        false,
        "Benötigt: beschädigter Kontakt, höchstens 220 AE Abstand und 2 t Maschinen.",
      );
    p.cargo.parts -= 2;
    n.hp = Math.min(n.maxHp, n.hp + 70);
    p.credits += 240;
    n.relation += 12;
    p.xp += 20;
    message =
      "Druck wieder stabil. Danke, Ranger. 240 Credits und meine Empfehlung gehören dir.";
  }
  if (action === "bounty") {
    const target = s.ships.find(
      (v) => v.system === n.system && v.role === "pirate",
    );
    if (
      !target ||
      s.missions.some((m) => m.target === target.id && m.status !== "failed")
    )
      return result(false, "Derzeit ist kein neuer Jagdauftrag offen.");
    s.missions.push({
      id: uid(s),
      type: "bounty",
      title: `Gesucht: ${target.name.split(" ·")[0]}`,
      origin: s.systems[n.system].planets[0].id,
      destination: s.systems[n.system].planets[0].id,
      target: target.id,
      reward: 620,
      xp: 60,
      deadline: s.day + 40,
      status: "active",
      amount: 0,
      description: `Zerstöre ${target.name}. Die Prämie wartet danach im Hafen.`,
    });
    message = `Ziel bestätigt: ${target.name}. 620 cr nach Abschuss und Abholung im Heimathafen.`;
  }
  if (action === "escort") {
    if (n.escort || s.missions.filter((m) => m.status === "active").length >= 6)
      return result(
        false,
        "Dieser Konvoi ist bereits vergeben oder dein Auftragsbuch ist voll.",
      );
    const dest =
        s.systems[n.system].planets.find(
          (v) => distance(position(v, s.day), p) > 300,
        ) || s.systems[n.system].planets[1],
      id = uid(s);
    s.missions.push({
      id,
      type: "escort",
      title: `Konvoi nach ${dest.name}`,
      origin: dest.id,
      destination: dest.id,
      target: n.id,
      reward: 480,
      xp: 40,
      deadline: s.day + 25,
      status: "active",
      amount: 0,
      description:
        "Begleite das Handelsschiff zur Zielwelt. Es folgt deinem Schiff.",
    });
    n.escort = id;
    message = `Ich folge deinem Schiff. Bring uns sicher nach ${dest.name}.`;
  }
  n.lastAction = s.day;
  log(
    s,
    `${n.name.split(" ·")[0]}: ${message}`,
    action === "bluff" && n.target === "player" ? "bad" : "info",
  );
  return result(true, message);
}
export function portContact(s, id) {
  const p = planet(s, id);
  if (!p) return null;
  const key = `port:${id}`,
    project = s.projects[key] || {
      stage: 0,
      cycle: 0,
      cooldown: 0,
      trust: 0,
      memory: [],
    };
  return {
    id: key,
    name: NPC_NAMES[hash(id) % NPC_NAMES.length],
    species: p.species,
    project,
    planet: p,
  };
}
export function portAction(s, action) {
  const p = s.player,
    c = portContact(s, p.docked);
  if (!c)
    return result(
      false,
      "Lande auf einem Planeten, um die Hafenvertretung zu besuchen.",
    );
  const v = (s.projects[c.id] ??= {
    stage: 0,
    cycle: 0,
    cooldown: 0,
    trust: 0,
    memory: [],
  });
  if (action.startsWith("learn:")) {
    const skill = action.split(":")[1];
    if (!Object.hasOwn(p.skills, skill) || p.skills[skill] >= 4)
      return result(false, "Diese Ausbildung ist abgeschlossen.");
    const cost = 350 * (p.skills[skill] + 1);
    if (p.credits < cost)
      return result(false, `Die Ausbildung kostet ${cost} cr.`);
    p.credits -= cost;
    p.skills[skill]++;
    v.memory.unshift({ day: s.day, text: `Ausbildung: ${skill}` });
    return result(true, "Fähigkeit verbessert.");
  }
  if (action !== "project") return result(false, "Unbekanntes Anliegen.");
  if (s.day < v.cooldown)
    return result(
      false,
      `Das nächste Anliegen ist ab Tag ${v.cooldown} verfügbar.`,
    );
  let message = "";
  if (v.stage === 0) {
    if (p.cargo.parts < 2)
      return result(false, "Für die Versorgungsstation fehlen 2 t Maschinen.");
    p.cargo.parts -= 2;
    v.stage = 1;
    message =
      "Maschinen geliefert. Als Nächstes braucht die Station Energie und Personal.";
  } else if (v.stage === 1) {
    const cost = p.skills.engineering >= 1 ? 80 : 220;
    if (p.credits < cost)
      return result(false, `Energienetz benötigt ${cost} cr.`);
    p.credits -= cost;
    v.stage = 2;
    message =
      "Das Energienetz steht. Nun fehlen noch 2 t Medizin für die Krankenstation.";
  } else {
    if (p.cargo.medicine < 2)
      return result(false, "Für die Krankenstation fehlen 2 t Medizin.");
    p.cargo.medicine -= 2;
    p.credits += 1050;
    p.xp += 80;
    p.relations[c.species] += 6;
    v.trust += 12;
    v.stage = 0;
    v.cycle++;
    v.cooldown = s.day + 7;
    message =
      "Die Station ist eröffnet. 1.050 cr, 80 Erfahrung und das Vertrauen des Hafens gehören dir. In sieben Tagen beginnt ein neues Projekt.";
  }
  v.memory.unshift({ day: s.day, text: message });
  v.memory = v.memory.slice(0, 10);
  log(s, `${c.name}: ${message}`, "good");
  return result(true, message);
}
export function serialize(s) {
  const copy = structuredClone(s);
  delete copy.effects;
  return JSON.stringify(copy);
}
export function deserialize(text) {
  if (typeof text !== "string" || text.length > 2_000_000)
    throw Error("Spielstand zu groß.");
  const s = JSON.parse(text),
    finite = (n, a = 0, b = 1e9) =>
      typeof n === "number" && Number.isFinite(n) && n >= a && n <= b,
    int = (n, a = 0, b = 1e9) => finite(n, a, b) && Number.isInteger(n),
    str = (v, n = 2000) => typeof v === "string" && v.length <= n;
  const assert = (v) => {
    if (!v)
      throw Error("Spielstand ist beschädigt oder hat ein unbekanntes Format.");
  };
  assert(
    s &&
      s.version === VERSION &&
      str(s.seed, 80) &&
      int(s.day, 1) &&
      int(s.serial, 1) &&
      int(s.rng, 0, 4294967295),
  );
  assert(
    Array.isArray(s.systems) &&
      s.systems.length === 18 &&
      Array.isArray(s.ships) &&
      s.ships.length <= 400 &&
      Array.isArray(s.missions) &&
      s.missions.length <= 1000 &&
      Array.isArray(s.wrecks) &&
      s.wrecks.length <= 1000 &&
      Array.isArray(s.log) &&
      s.log.length <= 70 &&
      Array.isArray(s.news) &&
      s.news.length <= 12,
  );
  const validSystem = (n) => int(n, 0, 17),
    point = (n) => finite(n.x, -2000, 2000) && finite(n.y, -2000, 2000);
  const planetIds = new Set();
  for (const [i, sys] of s.systems.entries()) {
    assert(
      sys.id === i &&
        str(sys.name, 80) &&
        point(sys) &&
        (Object.hasOwn(SPECIES, sys.owner) || sys.owner === "dominator") &&
        finite(sys.pressure, 0, 100) &&
        Array.isArray(sys.links) &&
        sys.links.every(validSystem) &&
        Array.isArray(sys.planets) &&
        sys.planets.length === 3,
    );
    for (const p of sys.planets) {
      assert(
        str(p.id, 40) &&
          !planetIds.has(p.id) &&
          p.system === i &&
          str(p.name, 80) &&
          Object.hasOwn(SPECIES, p.species) &&
          Object.hasOwn(ECONOMIES, p.economy) &&
          finite(p.radius, 1, 1000) &&
          finite(p.angle, -100, 100) &&
          finite(p.orbit, -1, 1) &&
          finite(p.size, 1, 100) &&
          p.stock &&
          GOODS.every((g) => int(p.stock[g.id], 0, 10000)),
      );
      planetIds.add(p.id);
    }
  }
  const p = s.player;
  assert(
    p &&
      Object.hasOwn(HULLS, p.hull) &&
      Object.hasOwn(SPECIES, p.species) &&
      str(p.name, 32) &&
      validSystem(p.system) &&
      point(p) &&
      [
        "credits",
        "hp",
        "shield",
        "armor",
        "fuel",
        "capacitor",
        "xp",
        "rep",
        "kills",
      ].every((k) => finite(p[k], k === "rep" ? -1000 : 0)) &&
      p.hp > 0 &&
      p.cargo &&
      GOODS.every((g) => int(p.cargo[g.id], 0, 10000)),
  );
  assert(
    p.upgrades &&
      ["engine", "shield", "cargo", "reactor"].every((k) =>
        int(p.upgrades[k], 0, 4),
      ) &&
      p.skills &&
      ["trade", "engineering", "diplomacy"].every((k) =>
        int(p.skills[k], 0, 4),
      ) &&
      p.relations &&
      Object.keys(SPECIES).every((k) => finite(p.relations[k], -1000, 10000)) &&
      Array.isArray(p.inventory) &&
      p.inventory.length <= 200 &&
      Array.isArray(p.weapons) &&
      p.weapons.length === HULLS[p.hull].slots,
  );
  const ids = new Set();
  for (const w of [...p.inventory, ...p.weapons.filter(Boolean)]) {
    assert(
      w &&
        str(w.uid, 50) &&
        !ids.has(w.uid) &&
        Object.hasOwn(WEAPONS, w.type) &&
        int(w.level, 0, 10) &&
        typeof w.active === "boolean" &&
        int(w.readyAt),
    );
    ids.add(w.uid);
  }
  const st = stats(s);
  assert(
    p.hp <= st.hp &&
      p.armor <= st.armor &&
      p.shield <= st.shield &&
      p.fuel <= st.fuel &&
      p.capacitor <= st.capacitor &&
      usedCargo(s) <= st.cargo,
  );
  assert(
    p.docked === null ||
      (planetIds.has(p.docked) && planet(s, p.docked).system === p.system),
  );
  assert(
    p.combat &&
      ["keep", "orbit", "approach", "flee"].includes(p.combat.mode) &&
      [180, 320, 550, 750].includes(p.combat.range) &&
      ["fire", "booster", "repair", "afterburner"].every(
        (k) => typeof p.combat[k] === "boolean",
      ) &&
      (p.combat.target === null || str(p.combat.target, 50)) &&
      (p.combat.lockAt === null || int(p.combat.lockAt)),
  );
  if (p.order) {
    const o = p.order;
    assert(["move", "dock", "jump"].includes(o.type));
    if (o.type === "move") assert(point(o));
    if (o.type === "dock")
      assert(planetIds.has(o.id) && planet(s, o.id).system === p.system);
    if (o.type === "jump")
      assert(
        s.systems[p.system].links.includes(o.to) &&
          ["approach", "depart", "hyperspace"].includes(o.phase) &&
          point(o) &&
          finite(o.angle, -7, 7) &&
          finite(o.cost, 1, 100),
      );
  }
  const npcIds = new Set();
  for (const n of s.ships) {
    assert(
      str(n.id, 50) &&
        !npcIds.has(n.id) &&
        str(n.name, 120) &&
        validSystem(n.system) &&
        point(n) &&
        Object.hasOwn(SPECIES, n.species) &&
        ["trader", "ranger", "pirate", "dominator"].includes(n.role) &&
        [
          "hp",
          "maxHp",
          "shield",
          "maxShield",
          "armor",
          "maxArmor",
          "speed",
          "damage",
          "credits",
          "cargo",
        ].every((k) => finite(n[k])) &&
        n.hp > 0 &&
        planetIds.has(n.dest) &&
        Object.hasOwn(
          { merchant: 1, courier: 1, salvager: 1, mechanic: 1 },
          n.career,
        ) &&
        finite(n.relation, -1000, 10000) &&
        ["peaceUntil", "lastAction", "lastPlayerHit"].every((k) =>
          finite(n[k], -1000),
        ) &&
        (n.role === "dominator"
          ? Object.hasOwn(MACHINES, n.machine)
          : n.machine === null),
    );
    npcIds.add(n.id);
  }
  for (const m of s.missions)
    assert(
      str(m.id, 120) &&
        str(m.title) &&
        str(m.description) &&
        ["courier", "supply", "bounty", "escort"].includes(m.type) &&
        ["active", "ready", "paid", "failed"].includes(m.status) &&
        planetIds.has(m.origin) &&
        planetIds.has(m.destination) &&
        int(m.reward) &&
        int(m.xp) &&
        int(m.deadline) &&
        int(m.amount, 0, 100) &&
        (m.type !== "supply" || GOODS.some((g) => g.id === m.good)),
    );
  for (const w of s.wrecks)
    assert(
      str(w.id, 50) &&
        str(w.name, 200) &&
        validSystem(w.system) &&
        point(w) &&
        int(w.parts) &&
        int(w.credits) &&
        int(w.expires),
    );
  for (const entry of [...s.log, ...s.news])
    assert(int(entry.day) && str(entry.text, 3000));
  assert(
    s.projects &&
      typeof s.projects === "object" &&
      !Array.isArray(s.projects) &&
      Object.keys(s.projects).length <= 54,
  );
  for (const [id, v] of Object.entries(s.projects))
    assert(
      id.startsWith("port:") &&
        planetIds.has(id.slice(5)) &&
        int(v.stage, 0, 2) &&
        int(v.cycle) &&
        int(v.cooldown) &&
        int(v.trust) &&
        Array.isArray(v.memory) &&
        v.memory.length <= 10 &&
        v.memory.every((m) => int(m.day) && str(m.text)),
    );
  assert(
    s.metrics && ["trades", "kills", "travels"].every((k) => int(s.metrics[k])),
  );
  s.effects = [];
  return s;
}
