import { describe, expect, it } from "vitest";
import { m05Href } from "../src/m05/components/m05-link";

describe("M05 route mapping", () => {
  it("keeps shared M01-M04 entry points in their original routes", () => {
    for (const path of [
      "/dashboard",
      "/nutrition",
      "/training",
      "/profile",
      "/api/v1/me",
      "/m05/points",
    ]) {
      expect(m05Href(path)).toBe(path);
    }
  });
  it("maps business detail links once and preserves filters and anchors", () => {
    for (const path of [
      "/points",
      "/activities/a",
      "/bookings/b",
      "/community/users/u",
      "/blocks",
      "/redemptions/r",
      "/rewards?sort=new#list",
    ]) {
      expect(m05Href(path)).toBe("/m05" + path);
    }
    expect(m05Href("/health")).toBe("/dashboard");
    expect(m05Href("https://example.com")).toBe("https://example.com");
  });
});

import { safeReturnTo } from "../src/lib/api/client";
it("restores only known M05 routes after email login", () => {
  expect(safeReturnTo("/m05/points")).toBe("/m05/points");
  expect(
    safeReturnTo("/m05/activities/123e4567-e89b-42d3-a456-426614174000"),
  ).toBe("/m05/activities/123e4567-e89b-42d3-a456-426614174000");
  expect(safeReturnTo("/m05/unknown")).toBe("/dashboard");
  expect(safeReturnTo("//example.com/m05/points")).toBe("/dashboard");
});
