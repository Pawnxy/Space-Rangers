import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const start = async (page) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Reise beginnen" }).click();
};
const advance = async (page, count) => {
  for (let i = 0; i < count; i++)
    await page.locator('[data-action="advance"]').click();
};
test("desktop: first courier journey trades, delivers, claims once and reloads", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await start(page);
  await expect(page.locator("#sector-title")).toContainText("Sol");
  await page.locator('[data-action="dock"]').click();
  await advance(page, 1);
  await expect(page.locator("#dialog")).toBeVisible();
  await expect(page.locator("#dialog-title")).toContainText("Haven");
  await page.locator('.tabs [data-tab="contracts"]').click();
  await page.locator('[data-action="accept"]').first().click();
  await expect(page.locator(".modal-feedback")).toContainText(
    "Auftrag angenommen",
  );
  await page.locator('[data-tab="market"]').click();
  await page
    .locator('[data-action="trade"][data-good="medicine"][data-amount="1"]')
    .click();
  await expect(page.locator(".modal-feedback")).toContainText("gekauft");
  await page.locator('[data-action="undock"]').click();
  await page.locator('.flight-deck [data-action="missions"]').click();
  await page.locator('[data-action="mission-route"]').click();
  await page.locator('[data-action="dock"]').click();
  for (let i = 0; i < 20 && !(await page.locator("#dialog").isVisible()); i++)
    await advance(page, 1);
  await expect(page.locator("#dialog-title")).toContainText("Meridian");
  await page.locator('.tabs [data-tab="contracts"]').click();
  await page.locator('[data-action="claim"]').click();
  await expect(page.locator(".modal-feedback")).toContainText("420 cr");
  await expect(page.locator(".contract")).toContainText(["AUSGEZAHLT"]);
  await page.reload();
  await expect(page.locator("#welcome")).toBeHidden();
  await page.locator('[data-action="port"]').click();
  await page.locator('.tabs [data-tab="contracts"]').click();
  await expect(page.locator(".contract")).toContainText(["AUSGEZAHLT"]);
  await expect(page.locator('[data-action="claim"]')).toHaveCount(0);
  expect(errors).toEqual([]);
  await page.locator('[data-action="close"]').click();
  await mkdir(".local/qa", { recursive: true });
  await page.screenshot({ path: ".local/qa/desktop.png" });
});
test("phone: contacts, dialogue consequences, equipment and layout work without overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await start(page);
  await page.locator('[data-action="signals"]').click();
  await page.locator('#dialog [data-action="select-ship"]').first().click();
  await page.locator('[data-action="talk"]').click();
  await expect(page.locator(".dialogue-options")).toBeVisible();
  await page.locator('[data-kind="deal"]').click();
  await expect(page.locator(".dialogue-response")).toContainText("Drei Tonnen");
  await page.locator('[data-action="close"]').click();
  await page.locator('[data-action="ship"]').click();
  await expect(page.locator(".weapon-card")).toHaveCount(2);
  await page.locator('[data-action="toggle-weapon"]').first().click();
  await expect(page.locator(".weapon-card").first()).toContainText("AUS");
  await page.locator('[data-action="close"]').click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  await mkdir(".local/qa", { recursive: true });
  await page.screenshot({ path: ".local/qa/phone.png" });
});
test("browser: combat commands, save export and malformed imports provide feedback", async ({
  page,
}) => {
  await start(page);
  await page.evaluate(async () => {
    const E = await import("/src/engine.mjs");
    const s = E.deserialize(localStorage.getItem("weitraum:v1")),
      n = s.ships.find((n) => n.role === "pirate" && n.system === 0);
    Object.assign(n, { x: s.player.x + 100, y: s.player.y });
    localStorage.setItem("weitraum:v1", E.serialize(s));
  });
  await page.reload();
  await page.locator("#contacts-panel .pirate").first().click();
  await page.locator('[data-action="combat"]').click();
  await page.locator('[data-action="fire"]').click();
  await expect(page.locator(".modal-feedback")).toContainText(
    "Zielaufschaltung",
  );
  await page.locator('[data-mode="orbit"]').click();
  await page.locator('[data-action="close"]').click();
  await advance(page, 2);
  await expect(page.locator("#flight-status")).toContainText("TAKTISCHER");
  await page.locator('[data-action="menu"]').click();
  const download = page.waitForEvent("download");
  await page.locator('[data-action="export"]').click();
  expect((await download).suggestedFilename()).toContain("weitraum-tag-");
  await page.locator("#import-file").setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":1}'),
  });
  await expect(page.locator(".modal-feedback")).toContainText(
    "Import fehlgeschlagen",
  );
});
test("responsive map, harbor and ship screens fit narrow portrait and landscape viewports", async ({
  page,
}) => {
  await start(page);
  await page.locator('[data-action="dock"]').click();
  await advance(page, 1);
  for (const viewport of [
    { width: 360, height: 740 },
    { width: 844, height: 390 },
    { width: 1280, height: 800 },
  ]) {
    await page.setViewportSize(viewport);
    for (const tab of ["overview", "market", "people", "shipyard"]) {
      await page.locator(`[data-tab="${tab}"]`).click();
      const sizes = await page
        .locator(".dialog-body")
        .evaluate((el) => ({ width: el.clientWidth, scroll: el.scrollWidth }));
      expect(sizes.scroll).toBeLessThanOrEqual(sizes.width + 1);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
test("browser: galactic travel survives a reload in hyperspace and exposes the destination", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await start(page);
  await page.locator('[data-action="view"][data-view="galaxy"]').click();
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  const point = await page.evaluate(() => {
    const canvas = document.querySelector("#map"),
      rect = canvas.getBoundingClientRect(),
      width = rect.width,
      height = rect.height,
      sc = Math.min((width - 100) / 1150, (height - 120) / 650),
      x = (width - 1150 * sc) / 2 + 290 * sc,
      y = (height - 650 * sc) / 2 + 120 * sc;
    return { x: rect.left + x, y: rect.top + y };
  });
  await page.mouse.click(point.x, point.y);
  await expect(page.locator("#target-panel h2")).toHaveText("Miranda");
  await page.locator('[data-action="navigate-system"]').click();
  for (let i = 0; i < 20; i++) {
    const phase = await page.evaluate(
      () => JSON.parse(localStorage.getItem("weitraum:v1")).player.order?.phase,
    );
    if (phase === "hyperspace") break;
    await advance(page, 1);
  }
  await expect(page.locator("#flight-status")).toContainText("IM HYPERRAUM");
  await page.reload();
  await expect(page.locator("#flight-status")).toContainText("IM HYPERRAUM");
  await advance(page, 1);
  await expect(page.locator("#sector-title")).toContainText("Miranda");
  expect(errors).toEqual([]);
});
