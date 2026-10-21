import type { Page } from "@playwright/test";

/** Deterministic M05 upstream contract fixture, not real API/MySQL or supplier evidence. */
export async function installM05Fixture(page: Page) {
  const instant = "2026-10-21T02:00:00.000Z";
  const slot = {
    id: "fixture-slot",
    activityId: "fixture-activity",
    startAt: "2026-10-25T02:00:00.000Z",
    endAt: "2026-10-25T03:00:00.000Z",
    bookingOpenAt: "2026-10-01T00:00:00.000Z",
    bookingCloseAt: "2026-10-24T00:00:00.000Z",
    cancelBeforeAt: "2026-10-24T00:00:00.000Z",
    capacity: 10,
    bookedCount: 0,
    remainingSeats: 10,
    status: "published",
    version: 1,
  };
  const activity = {
    id: slot.activityId,
    title: "上游模拟·公园轻步行",
    category: "walking",
    description: "浏览器契约测试活动，不是真实活动。",
    locationName: "测试公园",
    address: "测试步道入口",
    latitude: null,
    longitude: null,
    visibility: "public",
    status: "published",
    version: 1,
    nextSlot: slot,
    serverNow: instant,
  };
  type Booking = {
    id: string;
    activityId: string;
    activityTitle: string;
    slotId: string;
    slot: typeof slot;
    status: string;
    participantVisibility: string;
    version: number;
    bookedAt: string;
    canceledAt: string | null;
    cancelReason: string | null;
    activitySnapshot: typeof activity;
    slotSnapshot: typeof slot;
    events: {
      id: string;
      action: string;
      occurredAt: string;
      reason: string | null;
    }[];
  };
  let booking: Booking | null = null;
  let signed = false;
  let redeemed = false;
  const account = () => ({
    balance: 320 + (signed ? 10 : 0) - (redeemed ? 200 : 0),
    lifetimeEarned: 320 + (signed ? 10 : 0),
    lifetimeSpent: redeemed ? 200 : 0,
    version: 1,
  });
  const reward = {
    id: "fixture-reward",
    title: "上游模拟·数字手账",
    description: "仅浏览器测试，无实际履约价值。",
    costPoints: 200,
    stock: 5,
    dailyLimit: 1,
    fulfillmentType: "digital",
    status: "published",
    version: 1,
    available: true,
    testOnly: true,
    providerMode: "fixture",
  };
  const order = () => ({
    id: "fixture-order",
    rewardId: reward.id,
    rewardTitle: reward.title,
    rewardVersionSnapshot: 1,
    costPoints: 200,
    status: "fulfilled",
    fulfillmentStatus: "fulfilled",
    version: 1,
    createdAt: instant,
    fulfilledAt: instant,
    businessDate: "2026-10-21",
    code: "TEST-ONLY-FIXTURE",
    testOnly: true,
  });
  const commands: {
    path: string;
    key: string | undefined;
    csrf: string | undefined;
    body: unknown;
  }[] = [];
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    let data: unknown;
    if (path === "/api/v1/me/m05-session")
      data = {
        id: "e2e-demo",
        nickname: "测试用户",
        roles: ["user"],
        csrfToken: "test-csrf",
      };
    else if (path === "/api/v1/activities")
      data = { items: [activity], nextCursor: null };
    else if (path === "/api/v1/activities/" + activity.id) data = activity;
    else if (path === "/api/v1/activities/" + activity.id + "/slots")
      data = { items: [slot], nextCursor: null };
    else if (path === "/api/v1/me/bookings" && method === "POST") {
      const body = request.postDataJSON();
      commands.push({
        path,
        body,
        key: request.headers()["idempotency-key"],
        csrf: request.headers()["x-csrf-token"],
      });
      booking = {
        id: "fixture-booking",
        activityId: activity.id,
        activityTitle: activity.title,
        slotId: slot.id,
        slot: { ...slot, bookedCount: 1, remainingSeats: 9 },
        status: "confirmed",
        participantVisibility: body.participantVisibility,
        version: 1,
        bookedAt: instant,
        canceledAt: null,
        cancelReason: null,
        activitySnapshot: activity,
        slotSnapshot: { ...slot },
        events: [
          {
            id: "created",
            action: "create",
            occurredAt: instant,
            reason: null,
          },
        ],
      };
      data = booking;
    } else if (
      path === "/api/v1/me/bookings/fixture-booking/cancel" &&
      method === "POST" &&
      booking
    ) {
      const body = request.postDataJSON();
      commands.push({
        path,
        body,
        key: request.headers()["idempotency-key"],
        csrf: request.headers()["x-csrf-token"],
      });
      booking = {
        ...booking,
        status: "canceled",
        version: 2,
        canceledAt: instant,
        cancelReason: body.reason,
        slot: { ...slot },
        events: [
          ...booking.events,
          {
            id: "canceled",
            action: "cancel",
            occurredAt: instant,
            reason: body.reason,
          },
        ],
      };
      data = booking;
    } else if (path === "/api/v1/me/bookings/fixture-booking") data = booking;
    else if (path === "/api/v1/me/bookings")
      data = { items: booking ? [booking] : [], nextCursor: null };
    else if (path === "/api/v1/me/points/account") data = account();
    else if (path === "/api/v1/me/points/tasks")
      data = {
        date: "2026-10-21",
        serverDate: "2026-10-21",
        historical: false,
        consecutiveCheckinDays: signed ? 1 : 0,
        items: [
          {
            code: "daily_checkin",
            title: "每日签到",
            description: "模拟上游签到任务",
            rewardPoints: 10,
            progress: signed ? 1 : 0,
            status: signed ? "completed" : "pending",
            active: true,
            ruleVersion: 1,
            awardedPoints: signed ? 10 : 0,
            action: { type: "checkin" },
          },
        ],
      };
    else if (path === "/api/v1/me/points/check-in" && method === "POST") {
      const alreadyCompleted = signed;
      signed = true;
      data = { alreadyCompleted, account: account() };
    } else if (path === "/api/v1/me/points/ledger")
      data = { items: [], nextCursor: null };
    else if (path === "/api/v1/points/rewards")
      data = { items: [reward], nextCursor: null };
    else if (path === "/api/v1/me/points/redemptions" && method === "POST") {
      redeemed = true;
      data = order();
    } else if (path === "/api/v1/me/points/redemptions")
      data = { items: redeemed ? [order()] : [], nextCursor: null };
    else if (path === "/api/v1/me/points/redemptions/fixture-order")
      data = order();
    else {
      await route.fallback();
      return;
    }
    await route.fulfill({ json: { data } });
  });
  return { commands };
}
