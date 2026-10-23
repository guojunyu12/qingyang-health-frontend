import { test, expect } from "@playwright/test";
import { readFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

test.skip(process.env.QY_LIVE_E2E !== "1", "Requires isolated live API harness");
const pointsUnavailable = process.env.QY_LIVE_POINTS_UNAVAILABLE === "1";

test(`real email/M01/M02 session → nutrition with M05 ${pointsUnavailable ? "explicitly unavailable" : "connected and rewards paused"}`, async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/login");
  await page.getByLabel("邮箱地址").fill(`m03-live-${crypto.randomUUID()}@example.com`);
  await page.getByRole("button", { name: "获取验证码" }).click();
  await expect(page.getByRole("status")).toContainText("验证码已发送");
  const code = await readFile(
    resolve(process.env.QY_E2E_CODE_FILE ?? "server/.local/m03-e2e-code"),
    "utf8",
  );
  await page.getByLabel("验证码", { exact: true }).fill(code);
  await page.getByRole("button", { name: "登录 / 注册" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/nutrition");
  await expect(page.getByText("从这一餐，开始好好照顾自己")).toBeVisible();

  const capabilities = await page.request.get("/api/v1/nutrition/capabilities");
  expect(capabilities.status()).toBe(200);
  expect((await capabilities.json()).data.points).toBe(!pointsUnavailable);
  if (pointsUnavailable) {
    // Preserve the pre-integration dependency rejection in an explicit test-only mode.
    await expect(page.getByRole("button", { name: "手动记餐", exact: true })).toBeDisabled();
    await expect(page.getByText("记餐奖励服务尚未接入", { exact: false })).toBeVisible();
  } else {
    await expect(page.getByRole("button", { name: "手动记餐", exact: true })).toBeEnabled();
    const before = await page.request.get("/api/v1/me/points/account");
    expect(before.status()).toBe(200);
    const balance = (await before.json()).data.balance;
    const tasks = await page.request.get("/api/v1/me/points/tasks");
    expect(tasks.status()).toBe(200);
    const items = (await tasks.json()).data.items as { code: string; active: boolean }[];
    expect(items.find((item) => item.code === "daily_meal")?.active).toBe(false);
    await page.getByRole("button", { name: "手动记餐", exact: true }).click();
    await page.getByLabel("食物名称1", { exact: true }).fill("独立验收手动午餐");
    await page.getByLabel("份量1", { exact: true }).fill("100");
    await page.getByLabel("热量1", { exact: true }).fill("130");
    await page.getByRole("button", { name: "确认记录", exact: true }).click();
    await expect(page.getByText("独立验收手动午餐", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText("独立验收手动午餐", { exact: true })).toBeVisible();
    const after = await page.request.get("/api/v1/me/points/account");
    expect(after.status()).toBe(200);
    expect((await after.json()).data.balance).toBe(balance);
  }

  // The isolated harness must import the documented M03 test catalog before this run.
  const catalog = await page.request.get("/api/v1/foods");
  expect(catalog.status()).toBe(200);
  expect((await catalog.json()).data.items.length).toBeGreaterThan(0);
  await page.getByRole("button", { name: "拍照记录", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("线上识别尚未配置");
  await page.keyboard.press("Escape");
  await mkdir(resolve(".handoff/m03-review/screenshots"), { recursive: true });
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await expect(page.locator(".nt-root")).toHaveCount(1);
  const mode = pointsUnavailable ? "unavailable" : "integrated";
  for (const width of [360, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({
      path: resolve(`.handoff/m03-review/screenshots/nutrition-live-${mode}-${width}.png`),
      fullPage: false,
      animations: "disabled",
    });
  }
  await page.goto("/profile");
  await expect(page.getByRole("button", { name: "健康档案", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "退出登录", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
