import { installM05Fixture } from "../support/m05-fixture";
import { installNutritionFixture } from "../support/nutrition-fixture";
import { installHealthFixture } from "../support/health-fixture";
import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await installHealthFixture(page);
  await installNutritionFixture(page);
  await page.addInitScript(() => {
    try {
      localStorage.setItem("qingyang-account-id", "e2e-demo");
    } catch {}
  });
  await page.route("**/api/v1/me", (route) =>
    route.fulfill({
      json: {
        data: {
          id: "e2e-demo",
          nickname: "测试用户",
          email: "t***@example.com",
          joinedAt: "2026-10-19T00:00:00Z",
          timezone: "Asia/Shanghai",
        },
      },
    }),
  );
});

test("shell fits phone and desktop and modal restores focus", async ({
  page,
}) => {
  await page.goto("/dashboard");
  for (const width of [360, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    await expect(
      page.getByRole("heading", { name: "每一点改变，都算数。" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  const b = page.getByRole("button", { name: "记录体重" });
  await b.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(b).toBeFocused();
});
test("water and real-contract meal UI persist; invalid photo is rejected", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "喝一杯水" }).click();
  await expect(page.getByTestId("water-value")).toHaveText("250");
  await page.reload();
  await expect(page.getByTestId("water-value")).toHaveText("250");
  await page.goto("/nutrition");
  await page.getByRole("button", { name: "拍照记录", exact: true }).click();
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "bad.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("no"),
    });
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "图片",
  );
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "手动记餐", exact: true }).click();
  await page.getByLabel("食物名称1", { exact: true }).fill("我的午餐");
  await page.getByLabel("份量1", { exact: true }).fill("100");
  await page.getByLabel("热量1", { exact: true }).fill("130");
  await page.getByRole("button", { name: "确认记录", exact: true }).click();
  await expect(page.getByText("我的午餐", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("我的午餐", { exact: true })).toBeVisible();
});
test("training, companion, bookings and overview (M05 upstream fixture)", async ({
  page,
}) => {
  const fixture = await installM05Fixture(page);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/training");
  await page
    .getByRole("button", { name: "开始训练", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "开始计时" }).click();
  await expect(page.getByRole("button", { name: "暂停" })).toBeVisible();
  await page.getByRole("button", { name: "完成训练" }).click();
  await expect(page.getByText("今日已完成", { exact: true })).toBeVisible();
  await page.goto("/companion");
  await page.getByPlaceholder("想聊什么，都可以告诉我…").fill("今天有点累");
  await page.getByRole("button", { name: "发送消息" }).click();
  await expect(page.getByText("今天有点累", { exact: true })).toBeVisible();
  await expect(page.getByText(/允许自己慢下来/)).toBeVisible();
  await page.goto("/profile");
  await page.getByRole("link", { name: "进入活动预约" }).click();
  await expect(page).toHaveURL(/\/m05\/activities$/);
  await page.getByRole("link", { name: /上游模拟·公园轻步行/ }).click();
  for (const width of [360, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    await expect(page.getByRole("button", { name: "预约此场" })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `M05 detail at ${width}`,
    ).toBe(true);
  }
  await page.getByRole("button", { name: "预约此场" }).click();
  await page.getByRole("button", { name: "确认预约", exact: true }).click();
  await expect(page).toHaveURL(/\/m05\/bookings\/fixture-booking$/);
  await expect(page.getByText("待参加", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "取消预约", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText("待参加", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "取消预约", exact: true }).click();
  await page.getByLabel("取消原因（选填）").fill("临时有事");
  await page.getByRole("button", { name: "确认取消", exact: true }).click();
  await expect(page.getByText("已取消", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "取消预约", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("已取消", { exact: true })).toBeVisible();
  await expect(page.getByText("取消原因：临时有事")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "查看场次并重新预约" }),
  ).toBeVisible();
  expect(fixture.commands).toHaveLength(2);
  expect(fixture.commands[0]).toMatchObject({
    csrf: "test-csrf",
    body: { slotId: "fixture-slot", participantVisibility: "hidden" },
  });
  expect(fixture.commands[1]).toMatchObject({
    csrf: "test-csrf",
    body: { version: 1, reason: "临时有事" },
  });
  expect(fixture.commands.every((command) => Boolean(command.key))).toBe(true);
  expect(fixture.commands[0].key).not.toBe(fixture.commands[1].key);
  expect(pageErrors).toEqual([]);
  await page.goto("/overview");
  await page.getByRole("button", { name: "近 30 天" }).click();
  await expect(page.getByRole("button", { name: "近 30 天" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});
test("every page fits narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  for (const route of [
    "dashboard",
    "nutrition",
    "training",
    "companion",
    "profile",
    "overview",
  ]) {
    await page.goto("/" + route);
    await expect(page.locator("h1")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      route,
    ).toBe(true);
  }
});

test("daily rewards, reminder and exchange survive reload (M05 upstream fixture)", async ({
  page,
}) => {
  await installM05Fixture(page);
  await page.goto("/profile");
  await page.getByRole("link", { name: "进入我的健康积分" }).click();
  await page.getByRole("button", { name: "签到 +10", exact: true }).click();
  await expect(page.getByTestId("point-balance")).toHaveText("330积分");
  await page.reload();
  await expect(page.getByRole("button", { name: "今日已签到" })).toBeDisabled();
  await page.getByRole("link", { name: "数字权益", exact: true }).click();
  await page.getByRole("button", { name: "立即兑换", exact: true }).click();
  await page
    .getByRole("button", { name: "确认扣除 200 积分", exact: true })
    .click();
  await expect(page).toHaveURL(/\/m05\/redemptions\/fixture-order$/);
  await expect(
    page.getByText("TEST-ONLY-FIXTURE", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("TEST-ONLY-FIXTURE", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "积分任务", exact: true }).click();
  await expect(page.getByTestId("point-balance")).toHaveText("130积分");
  await page.goto("/training");
  await page.getByRole("button", { name: "训练提醒设置" }).click();
  await page.getByLabel("提醒时间").fill("20:30");
  await page.getByRole("button", { name: "保存设置" }).click();
  await page.reload();
  await page.getByRole("button", { name: "训练提醒设置" }).click();
  await expect(page.getByLabel("提醒时间")).toHaveValue("20:30");
});

test("corrupt image cannot be recognized", async ({ page }) => {
  await page.goto("/nutrition");
  await page.getByRole("button", { name: "拍照记录", exact: true }).click();
  await page
    .locator("input[type=file]")
    .first()
    .setInputFiles({
      name: "bad.png",
      mimeType: "image/png",
      buffer: Buffer.from("not an image"),
    });
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "无法读取",
  );
  await expect(
    page.getByRole("button", { name: "上传与识别待接入" }),
  ).toBeDisabled();
});

test("blocked storage is visible without breaking the application", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = function () {
      throw new Error("denied");
    };
  });
  await page.goto("/dashboard");
  await expect(
    page.getByRole("alert").filter({ hasText: "无法保存" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "喝一杯水" }).click();
  await expect(page.getByTestId("water-value")).toHaveText("250");
});

test("an action after Shanghai midnight records the new day before timers refresh", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-18T15:59:59Z") });
  await page.goto("/dashboard");
  await expect(page.getByRole("button", { name: "喝一杯水" })).toBeEnabled();
  await page.clock.setSystemTime(new Date("2026-10-18T16:00:01Z"));
  await page.getByRole("button", { name: "喝一杯水" }).click();
  await expect(page.getByTestId("water-value")).toHaveText("250");
  await expect(page.getByLabel("查看记录日期")).toHaveValue("2026-10-19");
});

test("definite water rejection allows a new submission with a new key", async ({
  page,
}) => {
  const keys: string[] = [];
  await page.route("**/api/v1/me/water-records", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    keys.push(route.request().headers()["idempotency-key"]);
    if (keys.length === 1)
      await route.fulfill({
        status: 409,
        json: { error: { code: "WATER_DAILY_LIMIT", message: "饮水额度已满" } },
      });
    else await route.fallback();
  });
  await page.goto("/dashboard");
  await page.getByRole("button", { name: /喝一杯水/ }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "饮水额度已满" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /喝一杯水/ }).click();
  await expect(page.getByTestId("water-value")).toHaveText("250");
  expect(keys).toHaveLength(2);
  expect(keys[1]).not.toBe(keys[0]);
});

test("a lost response retries the same water command key", async ({ page }) => {
  const keys: string[] = [];
  await page.route("**/api/v1/me/water-records", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    keys.push(route.request().headers()["idempotency-key"]);
    if (keys.length === 1) await route.abort("failed");
    else await route.fallback();
  });
  await page.goto("/dashboard");
  await page.getByRole("button", { name: /喝一杯水/ }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: /fetch|network|请求|网络/i }),
  ).toBeVisible();
  await page.getByRole("button", { name: /喝一杯水/ }).click();
  await expect(page.getByTestId("water-value")).toHaveText("250");
  expect(keys).toHaveLength(2);
  expect(keys[1]).toBe(keys[0]);
});
