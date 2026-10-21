import { cp, mkdir, rm } from "node:fs/promises";
await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
for (const item of ["index.html", "src", "public"])
  await cp(item, `dist/${item}`, { recursive: true });
console.log(
  "WEITRAUM gebaut: dist/ (statische Dateien, kein Backend erforderlich).",
);
