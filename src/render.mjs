import { position, SPECIES, HULLS, hash, route, MACHINES } from "./engine.mjs";
export function createRenderer(canvas, onSelect) {
  const ctx = canvas.getContext("2d"),
    stars = Array.from({ length: 290 }, (_, i) => ({
      x: (hash("x" + i) % 10000) / 10000,
      y: (hash("y" + i) % 10000) / 10000,
      size: i % 13 === 0 ? 1.6 : i % 5 === 0 ? 1 : 0.55,
    }));
  let width = 1,
    height = 1,
    hits = [],
    view = "system",
    zoom = 1,
    pan = { x: 0, y: 0 },
    drag = null,
    moved = false,
    snapshot = null,
    previous = new Map(),
    animationStart = 0,
    currentState = null,
    uiState = null;
  const observer = new ResizeObserver(() => {
    const rect = canvas.getBoundingClientRect(),
      ratio = Math.min(devicePixelRatio || 1, 2);
    width = rect.width;
    height = rect.height;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  });
  observer.observe(canvas);
  const scale = () => Math.min(width / 2350, height / 1750) * zoom;
  const project = (x, y) => ({
    x: width / 2 + (x - pan.x) * scale(),
    y: height / 2 + (y - pan.y) * scale(),
  });
  function dot(x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  function text(label, x, y, color = "#b2c7d1", size = 10, align = "center") {
    ctx.fillStyle = color;
    ctx.font = `${size}px ui-monospace,monospace`;
    ctx.textAlign = align;
    ctx.fillText(label, x, y);
  }
  function background(t, owner) {
    ctx.fillStyle = "#080e19";
    ctx.fillRect(0, 0, width, height);
    const palette =
      owner === "dominator" ? ["#5f243d", "#34204c"] : ["#144155", "#30305e"];
    for (let i = 0; i < 2; i++) {
      const g = ctx.createRadialGradient(
        width * (i ? 0.8 : 0.2),
        height * (i ? 0.25 : 0.7),
        0,
        width * (i ? 0.8 : 0.2),
        height * (i ? 0.25 : 0.7),
        Math.max(width, height) * 0.6,
      );
      g.addColorStop(0, palette[i] + "65");
      g.addColorStop(1, palette[i] + "00");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);
    }
    for (const [i, s] of stars.entries()) {
      ctx.globalAlpha =
        0.3 + Math.sin(t * 0.0004 + i) * 0.16 + (i % 5 === 0 ? 0.3 : 0);
      dot(s.x * width, s.y * height, s.size, "#bdcee7");
    }
    ctx.globalAlpha = 1;
  }
  function ring(x, y, r, color, dash = []) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  function ship(n, isPlayer = false, alpha = 1) {
    const old = previous.get(isPlayer ? "player" : n.id),
      t = Math.min(1, (performance.now() - animationStart) / 650),
      ease = t * t * (3 - 2 * t),
      p =
        old && old.system === n.system
          ? { x: old.x + (n.x - old.x) * ease, y: old.y + (n.y - old.y) * ease }
          : n,
      a = project(p.x, p.y),
      size = isPlayer ? 12 : n.role === "dominator" ? 10 : 7;
    const color = isPlayer
      ? "#f1cd8d"
      : n.role === "pirate"
        ? "#e59375"
        : n.role === "dominator"
          ? MACHINES[n.machine].color
          : n.role === "ranger"
            ? "#86c6cc"
            : "#9aacba";
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(a.x, a.y);
    ctx.rotate((n.angle || 0) + Math.PI / 2);
    if (isPlayer) {
      ctx.shadowBlur = 16;
      ctx.shadowColor = "#72d4e2";
      ctx.fillStyle = "#70c5d0";
      ctx.beginPath();
      ctx.moveTo(-3, size * 0.8);
      ctx.lineTo(0, size * (1.7 + Math.sin(performance.now() * 0.01) * 0.2));
      ctx.lineTo(3, size * 0.8);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.fillStyle = isPlayer ? "#dce1d6" : color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    if (n.role === "dominator") {
      ctx.moveTo(0, -size);
      ctx.lineTo(size, size * 0.2);
      ctx.lineTo(size * 0.5, size);
      ctx.lineTo(0, size * 0.6);
      ctx.lineTo(-size * 0.5, size);
      ctx.lineTo(-size, size * 0.2);
    } else if (n.role === "trader") {
      ctx.rect(-size * 0.6, -size * 0.8, size * 1.2, size * 1.6);
    } else {
      ctx.moveTo(0, -size);
      ctx.lineTo(size, size);
      ctx.lineTo(0, size * 0.5);
      ctx.lineTo(-size, size);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    if (isPlayer) {
      ctx.fillStyle = "#47677b";
      ctx.fillRect(-2, -size * 0.4, 4, size * 0.65);
    }
    ctx.restore();
    hits.push({ x: a.x, y: a.y, r: isPlayer ? 0 : 20, type: "ship", id: n.id });
    if (!isPlayer && (uiState.selected?.id === n.id || n.hp < n.maxHp * 0.5)) {
      ctx.fillStyle = "#28404b";
      ctx.fillRect(a.x - 16, a.y + 15, 32, 3);
      ctx.fillStyle = color;
      ctx.fillRect(a.x - 16, a.y + 15, (32 * n.hp) / n.maxHp, 3);
    }
    if (isPlayer) {
      ring(a.x, a.y, 22, "#e9c48455", [3, 5]);
      text(currentState.player.name, a.x, a.y + 38, "#ecd6aa", 10);
    } else if (uiState.selected?.id === n.id)
      text(n.name.split(" ·")[0], a.x, a.y - 21, color, 11);
  }
  function system(s, t) {
    const sys = s.systems[s.player.system];
    background(t, sys.owner);
    const c = project(0, 0),
      sc = scale();
    for (const p of sys.planets) {
      ctx.strokeStyle = "#8da6b518";
      ctx.beginPath();
      ctx.ellipse(
        c.x,
        c.y,
        p.radius * sc,
        p.radius * 0.76 * sc,
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    }
    const glow = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, 110);
    glow.addColorStop(0, "#f7dfac55");
    glow.addColorStop(0.2, "#eab36f22");
    glow.addColorStop(1, "#dba76600");
    ctx.fillStyle = glow;
    ctx.fillRect(c.x - 110, c.y - 110, 220, 220);
    dot(c.x, c.y, 12, "#e9ca8b");
    dot(c.x - 2, c.y - 2, 6, "#f4e1ad");
    for (const p of sys.planets) {
      const a = project(...Object.values(position(p, s.day))),
        radius = Math.max(9, p.size * sc * 1.8);
      const grad = ctx.createRadialGradient(
        a.x - radius * 0.4,
        a.y - radius * 0.5,
        0,
        a.x,
        a.y,
        radius,
      );
      grad.addColorStop(
        0,
        p.economy === "garden"
          ? "#b3ddc8"
          : p.economy === "agrarian"
            ? "#a9c5ad"
            : p.economy === "industrial"
              ? "#a9bbcb"
              : "#d7b398",
      );
      grad.addColorStop(0.5, p.economy === "mining" ? "#8c6653" : "#496f83");
      grad.addColorStop(1, "#122333");
      dot(a.x, a.y, radius + 3, "#8aafbd14");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(a.x, a.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      ctx.arc(a.x, a.y, radius, 0, Math.PI * 2);
      ctx.clip();
      ctx.strokeStyle = "#172d3e50";
      ctx.lineWidth = 3;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.ellipse(
          a.x - 5 + i * 4,
          a.y - 8 + i * 6,
          radius,
          3 + i,
          Math.PI * 0.3,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
      }
      ctx.restore();
      if (p.economy === "mining") {
        ctx.strokeStyle = "#ae9c8280";
        ctx.beginPath();
        ctx.ellipse(
          a.x,
          a.y,
          radius * 1.65,
          radius * 0.4,
          -0.3,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
      }
      const selected = uiState.selected?.id === p.id;
      if (selected) {
        ring(a.x, a.y, radius + 9, "#eac68d", [3, 4]);
        ring(a.x, a.y, radius + 15, "#eac68d20");
      }
      text(
        p.name.toUpperCase(),
        a.x,
        a.y + radius + 19,
        selected ? "#efd6ad" : "#a9bbc6",
        selected ? 12 : 10,
      );
      text(SPECIES[p.species].name, a.x, a.y + radius + 32, "#71899c", 8);
      hits.push({
        x: a.x,
        y: a.y,
        r: Math.max(26, radius + 15),
        type: "planet",
        id: p.id,
      });
    }
    const o = s.player.order;
    if (o && o.phase !== "hyperspace") {
      const dest =
          o.type === "dock"
            ? position(
                sys.planets.find((p) => p.id === o.id),
                s.day,
              )
            : o,
        a = project(s.player.x, s.player.y),
        b = project(dest.x, dest.y);
      ctx.strokeStyle = "#daba7e55";
      ctx.setLineDash([3, 7]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ring(b.x, b.y, 8, "#daba7e55");
    }
    for (const w of s.wrecks.filter((w) => w.system === sys.id)) {
      const a = project(w.x, w.y);
      ctx.strokeStyle = "#a19584";
      ctx.strokeRect(a.x - 4, a.y - 4, 8, 8);
      hits.push({ x: a.x, y: a.y, r: 20, type: "wreck", id: w.id });
    }
    for (const n of s.ships.filter((n) => n.system === sys.id)) ship(n);
    if (!s.player.docked && o?.phase !== "hyperspace")
      ship(s.player, true, o?.phase === "depart" ? 0.3 : 1);
    if (s.player.combat.target) {
      const n = s.ships.find((n) => n.id === s.player.combat.target);
      if (n && n.system === sys.id) {
        const a = project(n.x, n.y);
        ring(a.x, a.y, 22, "#e58d7455", [8, 4]);
        text(
          s.day >= s.player.combat.lockAt ? "AUFGESCHALTET" : "AUFSCHALTUNG",
          a.x,
          a.y - 37,
          "#e3a28b",
          8,
        );
      }
    }
    if (performance.now() - animationStart < 550)
      for (const fx of s.effects || []) {
        const a = project(fx.from.x, fx.from.y),
          b = project(fx.to.x, fx.to.y);
        ctx.strokeStyle = fx.kind === "enemy" ? "#e37769" : "#b0e6e4";
        ctx.lineWidth = fx.kind === "rail" ? 2 : 1;
        ctx.globalAlpha = 1 - (performance.now() - animationStart) / 550;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    if (o?.phase === "hyperspace") {
      ctx.fillStyle = "#081425d9";
      ctx.fillRect(0, 0, width, height);
      for (let i = 0; i < 90; i++) {
        const a = i * 2.399,
          r = (i * 53 + t * 0.5) % Math.max(width, height);
        ctx.strokeStyle = "#8db7d040";
        ctx.beginPath();
        ctx.moveTo(width / 2 + Math.cos(a) * r, height / 2 + Math.sin(a) * r);
        ctx.lineTo(
          width / 2 + Math.cos(a) * (r + 65),
          height / 2 + Math.sin(a) * (r + 65),
        );
        ctx.stroke();
      }
      text("H Y P E R R A U M", width / 2, height / 2, "#d8d7c8", 18);
      text(
        "ZIEL " + s.systems[o.to].name.toUpperCase(),
        width / 2,
        height / 2 + 30,
        "#8aa7bc",
        11,
      );
    }
  }
  function galaxy(s, t) {
    background(t, "human");
    const sc = Math.min((width - 100) / 1150, (height - 120) / 650),
      ox = (width - 1150 * sc) / 2,
      oy = (height - 650 * sc) / 2,
      at = (n) => ({ x: ox + n.x * sc, y: oy + n.y * sc });
    const target =
        uiState.selected?.type === "system" ? uiState.selected.id : null,
      path = target !== null ? route(s, s.player.system, target) : [];
    for (const sys of s.systems) {
      const a = at(sys);
      for (const id of sys.links.filter((id) => id > sys.id)) {
        const b = at(s.systems[id]),
          active = path.some(
            (v, i) =>
              (v === sys.id && path[i + 1] === id) ||
              (v === id && path[i + 1] === sys.id),
          );
        ctx.strokeStyle = active ? "#e4be7a99" : "#78929e2b";
        ctx.lineWidth = active ? 2 : 1;
        ctx.setLineDash(active ? [] : [3, 5]);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    for (const sys of s.systems) {
      const a = at(sys),
        color =
          sys.owner === "dominator" ? "#d88778" : SPECIES[sys.owner].color,
        selected = target === sys.id,
        here = sys.id === s.player.system;
      const glow = ctx.createRadialGradient(a.x, a.y, 0, a.x, a.y, 35);
      glow.addColorStop(0, color + "25");
      glow.addColorStop(1, color + "00");
      ctx.fillStyle = glow;
      ctx.fillRect(a.x - 35, a.y - 35, 70, 70);
      dot(a.x, a.y, here ? 6 : 4, color);
      if (here) ring(a.x, a.y, 13, "#e4c88d");
      if (selected) ring(a.x, a.y, 20, "#e9c78b66", [3, 4]);
      text(
        sys.name.toUpperCase(),
        a.x,
        a.y + 27,
        here ? "#ecd4a6" : color,
        width < 500 ? 8 : 11,
      );
      if (width > 700)
        text(
          sys.owner === "dominator" ? "BESETZT" : SPECIES[sys.owner].name,
          a.x,
          a.y + 41,
          "#748c9e",
          8,
        );
      hits.push({ x: a.x, y: a.y, r: 26, type: "system", id: sys.id });
    }
  }
  function frame(t) {
    if (currentState) {
      hits = [];
      view = uiState.view;
      view === "galaxy" ? galaxy(currentState, t) : system(currentState, t);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  canvas.addEventListener("pointerdown", (e) => {
    drag = { x: e.clientX, y: e.clientY, pan: { ...pan } };
    moved = false;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag || view !== "system") return;
    const dx = e.clientX - drag.x,
      dy = e.clientY - drag.y;
    if (Math.hypot(dx, dy) > 6) moved = true;
    if (moved)
      pan = { x: drag.pan.x - dx / scale(), y: drag.pan.y - dy / scale() };
  });
  canvas.addEventListener("pointerup", (e) => {
    if (!moved) {
      const r = canvas.getBoundingClientRect(),
        x = e.clientX - r.left,
        y = e.clientY - r.top;
      const hit = hits
        .filter((h) => h.r && Math.hypot(h.x - x, h.y - y) < h.r)
        .sort(
          (a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y),
        )[0];
      if (hit) onSelect(hit);
      else if (view === "system")
        onSelect({
          type: "space",
          x: (x - width / 2) / scale() + pan.x,
          y: (y - height / 2) / scale() + pan.y,
        });
    }
    drag = null;
  });
  canvas.addEventListener(
    "wheel",
    (e) => {
      if (view === "system") {
        e.preventDefault();
        zoom = Math.max(0.65, Math.min(3, zoom * (e.deltaY > 0 ? 0.9 : 1.1)));
      }
    },
    { passive: false },
  );
  return {
    update(s, ui) {
      if (snapshot !== `${s.day}:${s.player.system}`) {
        previous = new Map(
          currentState
            ? [
                ["player", { ...currentState.player }],
                ...currentState.ships.map((n) => [n.id, { ...n }]),
              ]
            : [],
        );
        animationStart = performance.now();
        snapshot = `${s.day}:${s.player.system}`;
      }
      currentState = structuredClone(s);
      uiState = ui;
    },
    zoom(by) {
      zoom = Math.max(0.65, Math.min(3, zoom * by));
    },
    center() {
      pan = { x: 0, y: 0 };
      zoom = 1;
    },
    follow() {
      if (currentState) {
        pan = { x: currentState.player.x, y: currentState.player.y };
        zoom = 1.8;
      }
    },
  };
}
