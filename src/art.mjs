import { SPECIES, HULLS } from "./data.mjs";
export const escapeHTML = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function shipSVG(id = "wanderer", size = 180) {
  const h = HULLS[id] || HULLS.wanderer,
    c = SPECIES[h.species].color,
    wide = h.slots >= 4;
  return `<svg class="ship-illustration" width="${size}" height="${size * 0.8}" viewBox="0 0 240 190" aria-label="${h.name}" role="img"><defs><linearGradient id="hull-${id}" x2="1" y2="1"><stop stop-color="#b2bec7"/><stop offset=".4" stop-color="#44566a"/><stop offset="1" stop-color="#162334"/></linearGradient></defs><ellipse cx="120" cy="153" rx="74" ry="14" fill="#000" opacity=".35"/><path d="M${wide ? 24 : 48} 138 62 64 92 89 120 14 148 89 178 64 ${wide ? 216 : 192} 138 147 126 143 158 97 158 93 126Z" fill="url(#hull-${id})" stroke="#91a4b1" stroke-width="1.5"/><path d="m120 24 17 84-17 32-17-32Z" fill="${c}" opacity=".7"/><path d="m120 50 8 42-8 17-8-17Z" fill="#b8eded"/><path d="M65 89 45 132 89 116M175 89l20 43-44-16" fill="none" stroke="${c}" stroke-width="5"/><path d="m105 158 5 25 6-25m8 0 6 25 5-25" fill="#71dce5"/><path d="M96 124h48M104 133h32M100 143h40" stroke="#162431" stroke-width="3"/>${Array.from({ length: h.slots }, (_, i) => `<rect x="${i < h.slots / 2 ? 72 - i * 8 : 151 + (i - Math.ceil(h.slots / 2)) * 8}" y="${90 + (i % 3) * 9}" width="5" height="27" rx="2" fill="#bfc6c5"/>`).join("")}</svg>`;
}
export function portraitSVG(species, name = "Hafenvertretung") {
  const c = SPECIES[species]?.color || "#8fcaca",
    alien = species !== "human",
    peleng = species === "peleng",
    gaal = species === "gaal",
    maloc = species === "maloc";
  return `<svg class="portrait" viewBox="0 0 300 380" role="img" aria-label="${escapeHTML(name)} · ${SPECIES[species]?.name}"><defs><linearGradient id="coat" x2=".6" y2="1"><stop stop-color="#3e5966"/><stop offset="1" stop-color="#0b1726"/></linearGradient><radialGradient id="skin"><stop stop-color="${c}"/><stop offset="1" stop-color="${maloc ? "#694f43" : "#425e64"}"/></radialGradient></defs><circle cx="150" cy="157" r="122" fill="none" stroke="${c}" opacity=".15"/><circle cx="150" cy="157" r="102" fill="${c}" opacity=".035"/><path d="M28 380v-80q9-56 77-68h90q68 12 77 68v80" fill="url(#coat)" stroke="#687b85"/><path d="m105 230 45 85 45-85-21-22h-48Z" fill="#25353f"/><path d="M126 198v47l24 26 24-26v-47" fill="url(#skin)"/><path d="M${peleng ? 81 : 94} 116q${peleng ? "0-80 69-80 69 0 69 80" : "-9-73 56-80 65 7 56 80"}l-11 74q-12 39-45 40-34-1-45-40Z" fill="url(#skin)" stroke="${c}" stroke-opacity=".35"/>${alien ? `<path d="M102 135 69 99l28 69m101-33 33-36-28 69" fill="url(#skin)"/>` : ""}${gaal ? `<path d="M119 48 150 9l31 39-31 66Z" fill="${c}" opacity=".7"/>` : ""}${!alien ? '<path d="M93 118q-12-85 58-85 74 0 59 88l-24-44-66 12Z" fill="#292e33"/>' : ""}<path d="m105 138 30 9-27 8m87-17-30 9 27 8" fill="${gaal ? "#f2db96" : "#e0ead8"}"/><path d="m150 145-9 34h18M132 198q18 8 36-1" stroke="#243b42" stroke-width="4" fill="none"/>${peleng ? '<path d="M111 190q39 29 78-3-33 45-78 3" fill="#354842"/>' : ""}${maloc ? '<path d="m110 185 9 27 7-26m64-1-9 27-7-26" fill="#e4d2ad"/>' : ""}<path d="m67 285 53 31-27 63m140-94-53 31 27 63" stroke="#68818a" fill="none" stroke-width="2"/><path d="M154 306v74" stroke="${c}" stroke-width="3"/><circle cx="211" cy="295" r="12" fill="none" stroke="${c}"/><path d="m211 286 4 8-4 8-4-8Z" fill="${c}"/></svg>`;
}
export function citySVG(color = "#83b5bd") {
  return `<svg class="city" viewBox="0 0 1200 280" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#122537"/><stop offset="1" stop-color="${color}" stop-opacity=".4"/></linearGradient></defs><rect width="1200" height="280" fill="url(#sky)"/><circle cx="870" cy="70" r="60" fill="${color}" opacity=".16"/>${Array.from(
    { length: 32 },
    (_, i) => {
      const x = i * 40,
        h = 30 + ((i * 73) % 130);
      return `<path d="M${x} 280v-${h}l15-12 19 12v${h}" fill="${i % 2 ? "#142e3d" : "#0c2233"}"/><path d="M${x + 9} ${280 - h + 16}v${h - 23}m10-${h - 23}v${h - 23}" stroke="${color}" opacity=".3" stroke-dasharray="3 9"/>`;
    },
  ).join(
    "",
  )}<path d="M0 265q250-35 600 0t600 0" fill="none" stroke="${color}" opacity=".3"/></svg>`;
}
