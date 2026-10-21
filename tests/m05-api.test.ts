import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/lib/api/client";
import { subscribeInvalidation } from "../src/lib/api/cache";
import { api } from "../src/m05/lib/api";

const reply = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ data }), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("M05 authenticated API bridge", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("uses M01 CSRF and keeps the command idempotency key", async () => {
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(reply({ csrfToken: "fresh-m01-csrf" }))
      .mockResolvedValueOnce(reply({ balance: 10 }));
    const events: string[][] = [];
    const unsubscribe = subscribeInvalidation((event) =>
      events.push([...event.resources]),
    );
    await expect(
      api("/api/v1/me/points/check-in", {
        method: "POST",
        body: "{}",
        headers: {
          "Idempotency-Key": "same-command",
          "X-CSRF-Token": "old-module-token",
        },
      }),
    ).resolves.toEqual({ balance: 10 });
    expect(fetcher.mock.calls[0][0]).toBe("/api/v1/auth/csrf");
    expect(fetcher.mock.calls[1][1]).toMatchObject({
      credentials: "include",
      body: "{}",
      headers: {
        "X-CSRF-Token": "fresh-m01-csrf",
        "Idempotency-Key": "same-command",
      },
    });
    expect(events.some((resources) => resources.includes("health"))).toBe(true);
    expect(events.some((resources) => resources.includes("points"))).toBe(true);
    unsubscribe();
  });

  it("preserves ApiError identity and does not invalidate on a rejected command", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(reply({ csrfToken: "csrf" }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: "INSUFFICIENT_POINTS",
              message: "积分不足",
            },
          }),
          { status: 409 },
        ),
      );
    const listener = vi.fn();
    const unsubscribe = subscribeInvalidation(listener);
    await expect(
      api("/api/v1/me/points/redemptions", { method: "POST", body: "{}" }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("rejects development routes before making any request", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch");
    await expect(
      api("/api/dev/session", { method: "POST", body: "{}" }),
    ).rejects.toThrow("不支持的业务接口");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
