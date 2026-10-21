import test from "node:test";
import assert from "node:assert/strict";
import * as E from "../src/engine.mjs";
const dockAt = (s, id = "p0-0") => {
  s.player.system = E.planet(s, id).system;
  s.player.docked = id;
  Object.assign(s.player, E.position(E.planet(s, id), s.day));
};
const fly = (s, id) => {
  assert.equal(E.orderDock(s, id).ok, true);
  for (let i = 0; i < 30 && !s.player.docked; i++) E.tick(s);
  assert.equal(s.player.docked, id);
};
const moneyState = (s) =>
  JSON.stringify([
    s.player.credits,
    s.player.cargo,
    s.player.inventory,
    s.player.weapons,
  ]);
test("seed produces a reproducible connected galaxy with 54 worlds and diverse autonomous fleets", () => {
  const a = E.newGame("Ranger"),
    b = E.newGame("Ranger");
  assert.equal(E.serialize(a), E.serialize(b));
  assert.notEqual(E.serialize(a), E.serialize(E.newGame("Other")));
  assert.equal(a.systems.flatMap((s) => s.planets).length, 54);
  assert.ok(a.ships.length >= 130);
  for (const sys of a.systems) assert.ok(E.route(a, 0, sys.id).length);
  for (const n of a.ships.filter((n) => n.role === "dominator"))
    assert.ok(E.MACHINES[n.machine]);
});
test("flight consumes actual fuel, lands on moving planets and undocks safely", () => {
  const s = E.newGame(),
    fuel = s.player.fuel;
  fly(s, "p0-0");
  assert.ok(s.player.fuel < fuel);
  assert.equal(E.distance(s.player, E.position(E.planet(s, "p0-0"), s.day)), 0);
  assert.equal(E.undock(s).ok, true);
  assert.equal(s.player.docked, null);
});
test("travel approaches the edge, departs, enters hyperspace and arrives at the opposite edge", () => {
  const s = E.newGame(),
    fuel = s.player.fuel;
  assert.equal(E.orderJump(s, 1).ok, true);
  assert.equal(s.player.system, 0);
  let phases = new Set([s.player.order.phase]);
  for (let i = 0; i < 20 && s.player.system === 0; i++) {
    E.tick(s);
    if (s.player.order) phases.add(s.player.order.phase);
  }
  assert.equal(s.player.system, 1);
  assert.deepEqual([...phases], ["approach", "depart", "hyperspace"]);
  assert.ok(s.player.x < 0);
  assert.ok(s.player.fuel < fuel);
  assert.equal(s.systems[1].visited, true);
});
test("illegal or repeated jumps do not replace a valid flight", () => {
  const s = E.newGame();
  assert.equal(E.orderJump(s, 17).ok, false);
  s.player.fuel = 0;
  assert.equal(E.orderJump(s, 1).ok, false);
  s.player.fuel = 100;
  E.orderJump(s, 1);
  const order = JSON.stringify(s.player.order);
  assert.equal(E.orderJump(s, 6).ok, false);
  assert.equal(JSON.stringify(s.player.order), order);
});
test("a jump reserves enough fuel for both the approach and hyperspace charge", () => {
  const s = E.newGame();
  s.player.fuel = E.jumpCost(s, 1);
  assert.equal(E.orderJump(s, 1).ok, false);
  assert.equal(s.player.order, null);
});
test("market trades exchange exact goods and credits and reject overselling atomically", () => {
  const s = E.newGame();
  dockAt(s);
  const p = E.planet(s, "p0-0"),
    q = E.price(s, p, "parts"),
    credits = s.player.credits;
  assert.ok(E.trade(s, "parts", 2).ok);
  assert.equal(s.player.cargo.parts, 4);
  assert.equal(s.player.credits, credits - q * 2);
  const before = moneyState(s);
  assert.equal(E.trade(s, "parts", -99).ok, false);
  assert.equal(moneyState(s), before);
  assert.equal(E.trade(s, "parts", 0.5).ok, false);
  assert.ok(E.trade(s, "parts", -2).ok);
});
test("cargo limits include loose weapons and sealed quest goods", () => {
  const s = E.newGame();
  dockAt(s);
  E.acceptMission(s, E.contracts(s, "p0-0")[0].id);
  assert.equal(E.usedCargo(s), 7);
  s.player.credits = 100000;
  assert.ok(E.buyWeapon(s, "laser").ok);
  assert.equal(E.usedCargo(s), 9);
  s.player.cargo.ore = 32;
  const before = moneyState(s);
  assert.equal(E.trade(s, "ore", 2).ok, false);
  assert.equal(moneyState(s), before);
});
test("courier journey delivers once, survives the deadline and pays exactly once at the correct port", () => {
  const s = E.newGame("delivery");
  s.ships = s.ships.filter((n) => !["pirate", "dominator"].includes(n.role));
  fly(s, "p0-0");
  const offer = E.contracts(s, "p0-0")[0];
  assert.ok(E.acceptMission(s, offer.id).ok);
  assert.equal(E.acceptMission(s, offer.id).ok, false);
  E.undock(s);
  fly(s, offer.destination);
  const m = s.missions[0];
  assert.equal(m.status, "ready");
  const restored = E.deserialize(E.serialize(s));
  restored.day = m.deadline + 5;
  E.tick(restored);
  assert.equal(restored.missions[0].status, "ready");
  const credits = restored.player.credits;
  assert.equal(E.claim(restored, m.id).ok, true);
  assert.equal(restored.player.credits, credits + m.reward);
  assert.equal(E.claim(restored, m.id).ok, false);
  assert.equal(restored.player.credits, credits + m.reward);
  assert.equal(restored.missions[0].status, "paid");
});
test("supply missions do not consume goods after deadline or deliver twice", () => {
  const s = E.newGame();
  dockAt(s);
  const offer = E.contracts(s, "p0-0")[1];
  E.acceptMission(s, offer.id);
  s.player.cargo.parts = 6;
  s.day = offer.deadline + 1;
  E.undock(s);
  s.player.system = E.planet(s, offer.destination).system;
  Object.assign(s.player, E.position(E.planet(s, offer.destination), s.day));
  fly(s, offer.destination);
  assert.equal(s.player.cargo.parts, 6);
  assert.equal(s.missions[0].status, "failed");
});
test("ready rewards are rejected outside their payment port", () => {
  const s = E.newGame();
  dockAt(s);
  E.acceptMission(s, E.contracts(s, "p0-0")[0].id);
  s.missions[0].status = "ready";
  const credits = s.player.credits;
  assert.equal(E.claim(s, s.missions[0].id).ok, false);
  assert.equal(s.player.credits, credits);
});
test("escort missions complete on arrival and the pilot can offer a new convoy afterwards", () => {
  const s = E.newGame("convoy"),
    n = s.ships.find((n) => n.role === "trader" && n.system === 0);
  s.ships = [n];
  Object.assign(n, { x: s.player.x + 20, y: s.player.y });
  assert.ok(E.talk(s, n.id, "escort").ok);
  const m = s.missions[0];
  fly(s, m.destination);
  assert.equal(m.status, "ready");
  assert.equal(n.escort, null);
  assert.ok(E.claim(s, m.id).ok);
  E.undock(s);
  assert.ok(E.talk(s, n.id, "escort").ok);
  assert.equal(s.missions.length, 2);
  assert.notEqual(s.missions[1].id, m.id);
});
test("weapon fit swaps preserve unique items and cooldowns across save and hull changes", () => {
  const s = E.newGame();
  dockAt(s);
  s.player.credits = 10000;
  E.buyWeapon(s, "rail");
  const gun = s.player.inventory[0];
  gun.readyAt = 20;
  assert.ok(E.fit(s, 1, gun.uid).ok);
  assert.equal(s.player.weapons[1].readyAt, 20);
  assert.ok(E.fit(s, 1, null).ok);
  assert.ok(E.fit(s, 0, gun.uid).ok);
  const loaded = E.deserialize(E.serialize(s));
  assert.equal(loaded.player.weapons[0].readyAt, 20);
  assert.ok(E.buyHull(loaded, "bumblebee").ok);
  assert.equal(loaded.player.weapons.length, 1);
  const items = [
    ...loaded.player.weapons.filter(Boolean),
    ...loaded.player.inventory,
  ];
  assert.equal(new Set(items.map((i) => i.uid)).size, items.length);
});
test("switching to a smaller hull rejects cargo overflow without charging", () => {
  const s = E.newGame();
  dockAt(s);
  s.player.hull = "atlas";
  s.player.credits = 10000;
  s.player.cargo.ore = 90;
  const before = moneyState(s);
  assert.equal(E.buyHull(s, "kestrel").ok, false);
  assert.equal(moneyState(s), before);
  assert.equal(s.player.hull, "atlas");
});
test("combat tracking, range and missile application affect real hit chances", () => {
  const n = { speed: 280 };
  assert.ok(
    E.hitChance(E.WEAPONS.rail, n, 300, false) >
      E.hitChance(E.WEAPONS.rail, n, 300, true),
  );
  assert.equal(E.hitChance(E.WEAPONS.laser, n, 2000), 0);
  assert.ok(
    E.hitChance(E.WEAPONS.missile, { speed: 100 }, 400) >
      E.hitChance(E.WEAPONS.missile, { speed: 350 }, 400),
  );
});
test("damage respects shield, armor and hull and does not heal or produce negative layers", () => {
  const n = { shield: 10, armor: 10, hp: 50 };
  E.damage(n, 60, "em");
  assert.equal(n.shield, 0);
  assert.equal(n.armor, 0);
  assert.ok(n.hp < 50 && n.hp > 0);
  E.damage(n, 10000, "explosive");
  assert.equal(n.hp, 0);
});
test("lock-only and maneuver commands do not fire; energy shortage does not consume a weapon cycle", () => {
  const s = E.newGame(),
    p = s.player,
    n = s.ships.find((n) => n.role === "pirate");
  s.ships = [n];
  Object.assign(n, { system: 0, x: p.x + 150, y: p.y, damage: 0 });
  E.targetShip(s, n.id, false);
  E.setCombat(s, "mode", "orbit");
  const hp = n.hp;
  E.tick(s);
  E.tick(s);
  assert.equal(n.hp, hp);
  E.setCombat(s, "fire", true);
  p.capacitor = 0;
  p.weapons[0].type = "ion";
  p.weapons[1].active = false;
  E.tick(s);
  assert.equal(p.weapons[0].readyAt, 0);
  assert.equal(n.hp, hp);
});
test("active weapons fire independently after target lock and use capacitor energy", () => {
  const s = E.newGame(),
    p = s.player,
    n = s.ships.find((n) => n.role === "pirate");
  s.ships = [n];
  Object.assign(n, { system: 0, x: p.x + 120, y: p.y, speed: 0, damage: 0 });
  E.targetShip(s, n.id, true);
  E.tick(s);
  assert.equal(p.weapons[0].readyAt, 0);
  E.tick(s);
  assert.equal(p.weapons[0].readyAt, s.day + E.WEAPONS.laser.cycle);
  assert.equal(p.weapons[1].readyAt, s.day + E.WEAPONS.cannon.cycle);
  assert.ok(p.capacitor < E.stats(s).capacitor);
  assert.ok(n.shield < n.maxShield);
});
test("bounty kill leaves a wreck and confirms a mission for manual payment", () => {
  const s = E.newGame(),
    n = s.ships.find((n) => n.role === "pirate" && n.system === 0),
    r = s.ships.find((n) => n.role === "ranger" && n.system === 0);
  Object.assign(r, { x: s.player.x + 50, y: s.player.y });
  assert.ok(E.talk(s, r.id, "bounty").ok);
  n.hp = 0;
  n.lastPlayerHit = s.day;
  E.tick(s);
  assert.equal(s.missions[0].status, "ready");
  assert.ok(s.wrecks.some((w) => w.name.includes(n.name)));
  assert.equal(s.player.kills, 1);
});
test("NPC trades have concrete effects, limited stock and a per-day cooldown", () => {
  const s = E.newGame(),
    n = s.ships.find((n) => n.system === 0 && n.role === "trader");
  Object.assign(n, { x: s.player.x + 20, y: s.player.y });
  const cr = s.player.credits;
  assert.ok(E.talk(s, n.id, "deal").ok);
  assert.equal(s.player.credits, cr - 165);
  assert.equal(s.player.cargo.parts, 5);
  assert.equal(n.relation, 4);
  assert.equal(E.talk(s, n.id, "deal").ok, false);
});
test("pirate negotiations create a timed truce and calling patrol assigns an actual pursuit", () => {
  const s = E.newGame(),
    n = s.ships.find((n) => n.system === 0 && n.role === "pirate"),
    r = s.ships.find((n) => n.system === 0 && n.role === "ranger");
  Object.assign(n, { x: s.player.x + 40, y: s.player.y });
  assert.ok(E.talk(s, n.id, "pay").ok);
  assert.equal(n.peaceUntil, s.day + 12);
  s.day++;
  assert.ok(E.talk(s, n.id, "patrol").ok);
  assert.equal(r.target, n.id);
});
test("remembered relationships change dialogue and actual trade prices", () => {
  const s = E.newGame(),
    n = s.ships.find((n) => n.system === 0 && n.role === "trader");
  Object.assign(n, { x: s.player.x, y: s.player.y, relation: 12 });
  assert.match(E.greeting(s, n.id), /Freunde/);
  const quote = E.contactPrice(n),
    credits = s.player.credits;
  assert.ok(quote < 165);
  assert.ok(E.talk(s, n.id, "deal").ok);
  assert.equal(s.player.credits, credits - quote);
});
test("NPC refuelling charges only for the amount that fits into the tank", () => {
  const s = E.newGame(),
    n = s.ships.find((n) => n.system === 0 && n.role === "trader");
  Object.assign(n, { x: s.player.x, y: s.player.y });
  s.player.fuel = 99;
  const credits = s.player.credits;
  assert.ok(E.talk(s, n.id, "fuel").ok);
  assert.equal(s.player.fuel, 100);
  assert.equal(s.player.credits, credits - 6);
});
test("bluffs have both success and failure outcomes across deterministic days", () => {
  const outcomes = new Set();
  for (let day = 1; day < 12; day++) {
    const s = E.newGame(),
      n = s.ships.find((n) => n.role === "pirate" && n.system === 0);
    Object.assign(n, { x: s.player.x, y: s.player.y });
    s.day = day;
    E.talk(s, n.id, "bluff");
    outcomes.add(n.target === "player" ? "failed" : "worked");
  }
  assert.equal(outcomes.size, 2);
});
test("harbor projects have three persistent stages, memories and recurring new work", () => {
  const s = E.newGame();
  dockAt(s);
  assert.ok(E.portAction(s, "project").ok);
  s.player.credits = 5000;
  assert.ok(E.portAction(s, "project").ok);
  s.player.cargo.medicine = 2;
  assert.ok(E.portAction(s, "project").ok);
  const c = E.portContact(s, "p0-0");
  assert.equal(c.project.cycle, 1);
  assert.equal(c.project.stage, 0);
  assert.equal(c.project.memory.length, 3);
  assert.equal(E.portAction(s, "project").ok, false);
  s.day = c.project.cooldown;
  s.player.cargo.parts = 2;
  assert.ok(E.portAction(s, "project").ok);
  assert.equal(
    E.portContact(E.deserialize(E.serialize(s)), "p0-0").project.stage,
    1,
  );
});
test("training has distinct economic, project and diplomatic effects", () => {
  const s = E.newGame();
  dockAt(s);
  const before = E.price(s, E.planet(s, "p0-0"), "parts");
  assert.ok(E.portAction(s, "learn:trade").ok);
  assert.ok(E.price(s, E.planet(s, "p0-0"), "parts") < before);
  s.player.credits = 5000;
  E.portAction(s, "learn:engineering");
  E.portAction(s, "project");
  const cr = s.player.credits;
  E.portAction(s, "project");
  assert.equal(s.player.credits, cr - 80);
});
test("emergency fuel remains available to a stranded penniless pilot", () => {
  const s = E.newGame();
  s.player.fuel = 0;
  s.player.credits = 0;
  s.ships = [];
  const day = s.day;
  assert.ok(E.emergency(s).ok);
  assert.equal(s.player.fuel, 35);
  assert.equal(s.day, day + 3);
  assert.equal(s.player.credits, 0);
});
test("insurance recovers a destroyed ship into a playable docked state", () => {
  const s = E.newGame();
  s.player.hp = 0;
  s.ships = [];
  E.tick(s);
  assert.ok(s.player.hp > 0);
  assert.equal(s.player.docked, "p0-0");
  assert.equal(E.usedCargo(s), 0);
  assert.ok(E.deserialize(E.serialize(s)));
});
test("long-running autonomous simulation trades, fights, crosses systems and remains saveable", () => {
  for (const seed of ["long-a", "long-b"]) {
    const s = E.newGame(seed);
    dockAt(s);
    const before = s.metrics.trades,
      homes = new Map(s.ships.map((n) => [n.id, n.system]));
    let sawWreck = false,
      crossed = false;
    for (let i = 0; i < 150; i++) {
      E.tick(s);
      sawWreck ||= s.wrecks.length > 0;
      crossed ||= s.ships.some(
        (n) => homes.has(n.id) && homes.get(n.id) !== n.system,
      );
      if (i % 15 === 0) assert.ok(E.deserialize(E.serialize(s)));
    }
    assert.ok(s.metrics.trades > before + 100);
    assert.ok(sawWreck);
    assert.ok(crossed);
    assert.ok(s.ships.length > 100);
  }
});
test("save validation rejects non-finite resources, duplicate weapons, illegal machine hulls and invalid orders", () => {
  const s = E.newGame();
  assert.deepEqual(
    JSON.parse(E.serialize(E.deserialize(E.serialize(s)))),
    JSON.parse(E.serialize(s)),
  );
  for (const change of [
    (v) => (v.player.credits = -1),
    (v) => (v.player.weapons[1] = v.player.weapons[0]),
    (v) => (v.ships.find((n) => n.role === "dominator").machine = "wanderer"),
    (v) => (v.player.order = { type: "jump", to: 17 }),
    (v) => (v.player.cargo.parts = 9999),
    (v) => (v.systems[0].planets[0].stock.parts = null),
  ]) {
    const data = JSON.parse(E.serialize(s));
    change(data);
    assert.throws(() => E.deserialize(JSON.stringify(data)));
  }
});
