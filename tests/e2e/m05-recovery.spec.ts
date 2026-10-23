import { expect, test, type Page } from "@playwright/test";
import { installHealthFixture } from "../support/health-fixture";
import { installM05Fixture } from "../support/m05-fixture";

// These tests exercise browser recovery using explicit upstream fixtures.
// Supplier fulfilment and database isolation are verified separately by the API tests.
async function signedIn(page: Page) {
  await installHealthFixture(page);
  await installM05Fixture(page);
  await page.route("**/api/v1/me", (route) => route.fulfill({ json: { data: {
    id: "e2e-demo", nickname: "测试用户", email: "t***@example.com",
    joinedAt: "2026-10-19T00:00:00Z", timezone: "Asia/Shanghai",
  } } }));
}

const task = (active = true, historical = false) => ({
  date: historical ? "2026-10-20" : "2026-10-21", serverDate: "2026-10-21",
  historical, consecutiveCheckinDays: 0, items: [{
    code: "daily_checkin", title: "每日签到", description: "契约测试",
    rewardPoints: 10, progress: 0, status: "pending", active, ruleVersion: 1,
    awardedPoints: 0, action: { type: "checkin" },
  }],
});

test("task read failure can retry and historical transition disables check-in", async ({ page }) => {
  await signedIn(page);
  let fail = true;
  let releaseHistory: (() => void) | undefined;
  const historyWait = new Promise<void>((resolve) => { releaseHistory = resolve; });
  await page.route("**/api/v1/me/points/tasks**", async (route) => {
    if (fail) {
      await route.fulfill({ status: 503, json: { error: {
        code: "UPSTREAM_UNAVAILABLE", message: "任务读取暂时失败",
      } } });
    } else {
      const historical = new URL(route.request().url()).searchParams.has("date");
      if (historical) await historyWait;
      await route.fulfill({ json: { data: task(true, historical) } });
    }
  });
  await page.goto("/m05/points");
  await expect(page.getByRole("button", { name: "任务读取失败" })).toBeDisabled();
  fail = false;
  await page.getByRole("button", { name: "重新加载积分任务" }).click();
  await expect(page.getByRole("button", { name: "签到 +10", exact: true })).toBeEnabled();
  await page.getByLabel("任务日期", { exact: true }).fill("2026-10-20");
  await expect(page.getByRole("button", { name: "正在读取任务" })).toBeDisabled();
  releaseHistory?.();
  await expect(page.getByRole("button", { name: "历史记录只读" })).toBeDisabled();
});

test("paused check-in and unconfigured rewards cannot submit commands", async ({ page }) => {
  await signedIn(page);
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && /check-in|redemptions/.test(request.url())) {
      writes.push(request.url());
    }
  });
  await page.route("**/api/v1/me/points/tasks**", (route) =>
    route.fulfill({ json: { data: task(false) } }));
  await page.route("**/api/v1/points/rewards**", (route) => route.fulfill({ json: { data: {
    items: [{ id: "unavailable", title: "未配置的数字权益", description: "供应商未配置",
      costPoints: 20, stock: 2, dailyLimit: 1, available: false, testOnly: false,
      providerMode: "unavailable", status: "published", version: 1 }], nextCursor: null,
  } } }));
  await page.goto("/m05/points");
  await expect(page.getByRole("button", { name: "签到暂停" })).toBeDisabled();
  await page.getByRole("button", { name: "签到暂停" }).hover();
  await expect(page.getByRole("button", { name: "签到暂停" })).toHaveCSS("cursor", "default");
  await page.getByRole("link", { name: "数字权益", exact: true }).click();
  await expect(page.getByRole("button", { name: "履约暂未开放" })).toBeDisabled();
  expect(writes).toEqual([]);
});

test("list failure stays distinct from empty state and can retry", async ({ page }, testInfo) => {
  await signedIn(page);
  let failed = false;
  await page.route("**/api/v1/activities?**", (route) => {
    if (failed) return route.fulfill({ json: { data: { items: [], nextCursor: null } } });
    return route.fulfill({ status: 503, json: { error: {
      code: "UNAVAILABLE", message: "活动读取暂时失败",
    } } });
  });
  await page.goto("/m05/activities");
  await expect(page.getByRole("alert").filter({ hasText: "活动读取暂时失败" })).toHaveText("活动读取暂时失败");
  await expect(page.getByText("暂无符合条件的记录")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("activity-retry.png"), fullPage: true });
  failed = true;
  await page.getByRole("button", { name: "重新加载列表" }).click();
  await expect(page.getByText("暂无符合条件的记录")).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "活动读取暂时失败" })).toHaveCount(0);
});

test("community network failure is recoverable and does not claim a privacy block", async ({ page }) => {
  await signedIn(page);
  let failed = false;
  await page.route("**/api/v1/community/users/*", (route) => {
    if (failed) return route.fulfill({ json: { data: {
      id: "123e4567-e89b-42d3-a456-426614174000", nickname: "公开测试资料", bio: null,
    } } });
    return route.fulfill({ status: 503, json: { error: {
      code: "UNAVAILABLE", message: "社区读取暂时失败",
    } } });
  });
  await page.goto("/m05/community/users/123e4567-e89b-42d3-a456-426614174000");
  await expect(page.getByRole("heading", { name: "资料读取失败" })).toBeVisible();
  await expect(page.getByText("对方可能未开放资料", { exact: false })).toHaveCount(0);
  failed = true;
  await page.getByRole("button", { name: "重新加载社区资料" }).click();
  await expect(page.getByRole("heading", { name: "公开测试资料" })).toBeVisible();
});

test("community read failure cannot become a new hidden profile", async ({ page }) => {
  await signedIn(page);
  let failed = false;
  await page.route("**/api/v1/me/community-profile", (route) => {
    if (failed) return route.fulfill({ json: { data: {
      bio: "已有简介", discoverable: true, version: 7,
    } } });
    return route.fulfill({ status: 503, json: { error: {
      code: "UNAVAILABLE", message: "社区读取暂时失败",
    } } });
  });
  await page.route("**/api/v1/me/blocks**", (route) =>
    route.fulfill({ json: { data: { items: [], nextCursor: null } } }));
  await page.goto("/m05/community");
  await expect(page.getByRole("alert").filter({ hasText: "社区读取暂时失败" })).toBeVisible();
  await expect(page.getByRole("button", { name: "编辑社区资料" })).toBeDisabled();
  await expect(page.getByText("资料默认隐藏")).toHaveCount(0);
  failed = true;
  await page.getByRole("button", { name: "重新加载社区资料" }).click();
  await expect(page.getByText("已有简介")).toBeVisible();
  await page.getByRole("button", { name: "编辑社区资料" }).click();
  await expect(page.getByLabel("个人简介")).toHaveValue("已有简介");
  await expect(page.getByRole("checkbox")).toBeChecked();
});

for (const failure of ["network", "rejected"] as const) {
  test(`check-in ${failure} retries with the correct idempotency key`, async ({ page }) => {
    await signedIn(page);
    const keys: string[] = [];
    await page.route("**/api/v1/me/points/check-in", async (route) => {
      keys.push(route.request().headers()["idempotency-key"]);
      if (keys.length > 1) return route.fallback();
      if (failure === "network") return route.abort("failed");
      await route.fulfill({ status: 409, json: { error: {
        code: "RULE_INACTIVE", message: "签到规则已暂停，请稍后重试",
      } } });
    });
    await page.goto("/m05/points");
    await page.getByRole("button", { name: "签到 +10", exact: true }).click();
    await expect(page.getByRole("alert").first()).toBeVisible();
    await page.getByRole("button", { name: "签到 +10", exact: true }).click();
    await expect(page.getByRole("button", { name: "今日已签到" })).toBeDisabled();
    expect(keys).toHaveLength(2);
    expect(Boolean(keys[0])).toBe(true);
    if (failure === "network") expect(keys[1]).toBe(keys[0]);
    else expect(keys[1]).not.toBe(keys[0]);
  });
}

test("account change removes previous M05 balance while the new session loads", async ({ page }) => {
  await signedIn(page);
  let identity = "e2e-demo";
  let releaseSession: (() => void) | undefined;
  const sessionWait = new Promise<void>((resolve) => { releaseSession = resolve; });
  await page.route("**/api/v1/me", (route) => route.fulfill({ json: { data: {
    id: identity, nickname: identity, email: "t***@example.com", timezone: "Asia/Shanghai",
  } } }));
  await page.route("**/api/v1/me/m05-session", async (route) => {
    const id = identity;
    if (id !== "e2e-demo") await sessionWait;
    await route.fulfill({ json: { data: { id, nickname: id, roles: ["user"], csrfToken: "fixture" } } });
  });
  await page.route("**/api/v1/me/points/account", (route) => route.fulfill({ json: { data: {
    balance: identity === "e2e-demo" ? 320 : 7, lifetimeEarned: 0, lifetimeSpent: 0, version: 1,
  } } }));
  await page.goto("/m05/points");
  await expect(page.getByTestId("point-balance")).toHaveText("320积分");
  identity = "second-user";
  await page.evaluate(() => window.dispatchEvent(new StorageEvent("storage", {
    key: "qingyang-account-id", newValue: "second-user",
  })));
  await expect(page.getByText("正在读取账号…")).toBeVisible();
  await expect(page.getByTestId("point-balance")).toHaveCount(0);
  releaseSession?.();
  await expect(page.getByTestId("point-balance")).toHaveText("7积分");
});

test("email login returns to the requested public community profile", async ({ page }) => {
  await installHealthFixture(page);
  let logged = false;
  const id = "123e4567-e89b-42d3-a456-426614174000";
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown;
    if (path === "/api/v1/auth/email-codes") {
      data = { challengeId: id, resendAfterSeconds: 60 };
    } else if (path === "/api/v1/auth/login") {
      logged = true;
      data = {};
    } else if (path === "/api/v1/auth/csrf" && logged) {
      data = { csrfToken: "fixture-csrf" };
    } else if (!logged) {
      await route.fulfill({ status: 401, json: { error: {
        code: "UNAUTHENTICATED", message: "请登录",
      } } });
      return;
    } else if (path === "/api/v1/me" || path === "/api/v1/me/m05-session") {
      data = { id: "e2e-demo", nickname: "登录测试用户", roles: ["user"], timezone: "Asia/Shanghai" };
    } else if (path === "/api/v1/community/users/" + id) {
      data = { id, nickname: "目标社区用户", bio: "公开资料" };
    } else {
      await route.fallback();
      return;
    }
    await route.fulfill({ json: { data } });
  });
  await page.goto("/m05/community/users/" + id);
  await expect(page).toHaveURL(/\/login\?returnTo=/);
  await page.getByLabel("邮箱地址").fill("fixture@example.com");
  await page.getByRole("button", { name: "获取验证码" }).click();
  await expect(page.getByRole("status")).toContainText("验证码已发送");
  await page.getByLabel("验证码", { exact: true }).fill("123456");
  await page.getByRole("button", { name: "登录 / 注册" }).click();
  await expect(page).toHaveURL(new RegExp("/m05/community/users/" + id + "$"));
  await expect(page.getByRole("heading", { name: "目标社区用户" })).toBeVisible();
});

test("a successfully read null community profile can be created at version zero", async ({ page }) => {
  await signedIn(page);
  let profile: { bio: string; discoverable: boolean; version: number } | null = null;
  const commands: unknown[] = [];
  await page.route("**/api/v1/me/community-profile", async (route) => {
    if (route.request().method() === "PUT") {
      const body = route.request().postDataJSON();
      commands.push(body);
      profile = { bio: body.bio, discoverable: body.discoverable, version: 1 };
    }
    await route.fulfill({ json: { data: profile } });
  });
  await page.route("**/api/v1/me/blocks**", (route) =>
    route.fulfill({ json: { data: { items: [], nextCursor: null } } }));
  await page.goto("/m05/community");
  await expect(page.getByText("资料默认隐藏")).toBeVisible();
  await page.getByRole("button", { name: "编辑社区资料" }).click();
  await page.getByLabel("个人简介").fill("新账号的第一份社区资料");
  await page.getByRole("button", { name: "保存资料", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("新账号的第一份社区资料", { exact: true })).toBeVisible();
  expect(commands).toEqual([{ bio: "新账号的第一份社区资料", discoverable: false, version: 0 }]);
});

test("a booking response for a departed account cannot navigate the new account", async ({ page }) => {
  await signedIn(page);
  let identity = "e2e-demo";
  let releaseBooking: (() => void) | undefined;
  let requestStarted: (() => void) | undefined;
  const bookingWait = new Promise<void>((resolve) => { releaseBooking = resolve; });
  const started = new Promise<void>((resolve) => { requestStarted = resolve; });
  await page.route("**/api/v1/me", (route) => route.fulfill({ json: { data: {
    id: identity, nickname: identity, email: "t***@example.com", timezone: "Asia/Shanghai",
  } } }));
  await page.route("**/api/v1/me/m05-session", (route) => route.fulfill({ json: { data: {
    id: identity, nickname: identity, roles: ["user"], csrfToken: "fixture",
  } } }));
  await page.route("**/api/v1/me/bookings", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    requestStarted?.();
    await bookingWait;
    await route.fallback();
  });
  await page.goto("/m05/activities/fixture-activity");
  await page.getByRole("button", { name: "预约此场", exact: true }).click();
  await page.getByRole("button", { name: "确认预约", exact: true }).click();
  await started;
  identity = "second-user";
  await page.evaluate(() => window.dispatchEvent(new StorageEvent("storage", {
    key: "qingyang-account-id", newValue: "second-user",
  })));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "预约此场", exact: true })).toBeVisible();
  const response = page.waitForResponse((result) =>
    result.url().endsWith("/api/v1/me/bookings") && result.request().method() === "POST");
  releaseBooking?.();
  await response;
  // Drain the response handler before checking that its navigation callback was discarded.
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve(null))));
  await expect(page).toHaveURL(/\/m05\/activities\/fixture-activity$/);
  await expect(page.getByRole("button", { name: "预约此场", exact: true })).toBeVisible();
});
