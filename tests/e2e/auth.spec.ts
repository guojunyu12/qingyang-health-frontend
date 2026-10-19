import { test, expect } from "@playwright/test";
test("email login form, errors, account update and logout work on mobile and desktop", async ({
  page,
}) => {
  let logged = false;
  let nickname = "邮箱用户";
  const user = () => ({
    id: "auth-ui-user",
    nickname,
    email: "t***@example.com",
    avatarUrl: null,
    joinedAt: "2026-10-19T00:00:00Z",
    timezone: "Asia/Shanghai",
  });
  await page.route("**/api/v1/**", async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    let status = 200;
    let data: unknown = {};
    if (path.endsWith("/auth/email-codes"))
      data = {
        challengeId: "a0000000-0000-4000-8000-000000000001",
        resendAfterSeconds: 60,
      };
    else if (path.endsWith("/auth/login")) {
      const body = req.postDataJSON();
      if (body.code !== "123456") {
        await route.fulfill({
          status: 401,
          json: { error: { code: "INVALID_CODE", message: "验证码无效" } },
        });
        return;
      }
      logged = true;
      data = { user: user() };
    } else if (path.endsWith("/auth/csrf")) {
      status = logged ? 200 : 401;
      data = { csrfToken: "test-csrf" };
    } else if (path.endsWith("/auth/logout")) {
      logged = false;
      await route.fulfill({ status: 204, body: "" });
      return;
    } else if (path.endsWith("/me")) {
      status = logged ? 200 : 401;
      if (req.method() === "PATCH") nickname = req.postDataJSON().nickname;
      data = user();
    } else if (path.endsWith("/me/notifications"))
      data = { items: [], nextCursor: null };
    await route.fulfill({
      status,
      json:
        status === 401
          ? { error: { code: "UNAUTHENTICATED", message: "请登录" } }
          : { data },
    });
  });
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/login\?/);
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByLabel("邮箱地址").fill("test@example.com");
  await page.getByRole("button", { name: "获取验证码" }).click();
  await expect(page.getByRole("status")).toContainText("验证码已发送");
  await page.getByLabel("验证码", { exact: true }).fill("000000");
  await page.getByRole("button", { name: "登录 / 注册" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "验证码无效" }),
  ).toBeVisible();
  await expect(page.getByLabel("邮箱地址")).toHaveValue("test@example.com");
  await page.getByLabel("验证码", { exact: true }).fill("123456");
  await page.getByRole("button", { name: "登录 / 注册" }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await page.getByRole("button", { name: "编辑账号" }).click();
  await page.getByLabel("昵称").fill("我的新昵称");
  await page.getByRole("button", { name: "保存账号" }).click();
  await expect(page.getByRole("heading", { name: "我的新昵称" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "我的新昵称" })).toBeVisible();
  await page.getByRole("button", { name: "站内通知" }).click();
  await expect(page.getByText("暂无通知", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "退出登录" }).click();
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
});
