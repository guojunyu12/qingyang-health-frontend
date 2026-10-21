import { api as request } from "@/lib/api/client";
import { invalidateHealth, invalidatePoints } from "@/lib/api/cache";

export { ApiError } from "@/lib/api/client";

/** Bridge the delivered M05 JSON calls onto the M01 authenticated request boundary. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!path.startsWith("/api/v1/")) throw new Error("不支持的业务接口");
  const headers = new Headers(init.headers);
  const method = (init.method ?? "GET").toUpperCase();
  if (init.body != null && typeof init.body !== "string") {
    throw new Error("M05 请求仅支持 JSON 数据");
  }
  const result = await request<T>(path.slice("/api/v1".length), {
    method,
    signal: init.signal ?? undefined,
    body: init.body == null ? undefined : JSON.parse(init.body),
    idempotencyKey: headers.get("Idempotency-Key") ?? undefined,
  });
  if (!["GET", "HEAD"].includes(method)) {
    invalidatePoints();
    invalidateHealth(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date()),
    );
  }
  return result;
}
