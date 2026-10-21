import { test, expect } from "@playwright/test";
test("M02 browser → API → MySQL: records, retry, goals, isolation and responsive overview", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "测试账号 A", exact: true }).click();
  await expect(page.getByTestId("water-value")).toHaveText("0");
  await expect(
    page.getByText("先记录生活，再慢慢设定目标。你还没有健康档案。"),
  ).toBeVisible();
  await page.getByRole("button", { name: "设置个人目标", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "健康档案与个人目标" });
  await expect(dialog.getByLabel("目标体重（kg）")).toHaveValue("");
  await dialog.getByLabel("目标体重（kg）").fill("60");
  await dialog.getByLabel("饮水目标（ml）").fill("2000");
  await dialog.getByLabel("基础热量目标（千卡）").fill("1800");
  await dialog.getByLabel("健康目标", { exact: true }).selectOption("balanced");
  await dialog.getByRole("button", { name: "保存个人目标" }).click();
  await expect(dialog).not.toBeVisible();
  const water = page.getByRole("button", { name: /喝一杯水/ });
  await water.click();
  await expect(page.getByTestId("water-value")).toHaveText("250");
  await water.click();
  await expect(page.getByTestId("water-value")).toHaveText("500");
  await page.reload();
  await expect(page.getByTestId("water-value")).toHaveText("500");
  let dropped = false;
  const keys: string[] = [];
  await page.route("**/api/v1/me/water-records", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    keys.push(route.request().headers()["idempotency-key"]);
    if (!dropped) {
      dropped = true;
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await water.click();
  await expect(page.locator(".water-card").getByRole("alert")).toBeVisible();
  await water.click();
  await expect(page.getByTestId("water-value")).toHaveText("750");
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
  await page.unroute("**/api/v1/me/water-records");
  await page.getByRole("button", { name: "记录体重", exact: true }).click();
  const weigh = page.getByRole("dialog", { name: "记录体重", exact: true });
  await weigh.getByLabel("体重（kg）", { exact: true }).fill("60.2");
  await weigh.getByRole("button", { name: "保存记录", exact: true }).click();
  await expect(weigh).not.toBeVisible();
  await expect(page.locator(".weight-card .metric-number strong")).toHaveText(
    "60.2",
  );
  await page
    .locator(".water-card")
    .getByRole("button", { name: "删除", exact: true })
    .first()
    .click();
  const deletion = page.getByRole("dialog", { name: "确认删除饮水记录" });
  await expect(deletion).toBeVisible();
  await deletion.getByRole("button", { name: "保留记录" }).click();
  await expect(page.getByTestId("water-value")).toHaveText("750");
  await page
    .locator(".water-card")
    .getByRole("button", { name: "删除", exact: true })
    .first()
    .click();
  await deletion.getByRole("button", { name: "确认删除", exact: true }).click();
  await expect(page.getByTestId("water-value")).toHaveText("500");
  await page.getByRole("button", { name: "测试账号 B", exact: true }).click();
  await expect(page.getByTestId("water-value")).toHaveText("0");
  await expect(page.locator(".weight-card .metric-number strong")).toHaveText(
    "—",
  );
  await page.goto("/overview");
  await page.getByRole("button", { name: "近 30 天", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(30);
  await expect(
    page.getByText("这段时间还没有体重测量，记录后会显示在这里"),
  ).toBeVisible();
  for (const width of [360, 960, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `.local/m02-overview-${width}.png`,
      fullPage: true,
    });
  }
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "测试账号 A", exact: true }).click();
  await expect(page.getByTestId("water-value")).toHaveText("500");
  for (const width of [360, 960, 1440]) {
    await page.setViewportSize({ width, height: 950 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `.local/m02-dashboard-${width}.png`,
      fullPage: true,
    });
  }
  const button = page.getByRole("button", { name: "记录体重", exact: true });
  await button.click();
  await expect(
    page.getByRole("dialog", { name: "记录体重", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(button).toBeFocused();
  expect(errors).toEqual([]);
});
