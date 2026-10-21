import type {
  HealthRuntime,
  RequestOptions,
} from "../../src/features/health/runtime";
/** Explicit loopback test adapter. Never used in production and never stores health facts. */
export function createDevRuntime(base: string): HealthRuntime {
  const url = new URL(base);
  if (!["127.0.0.1", "localhost"].includes(url.hostname))
    throw new Error("本地联调适配器仅允许回环地址");
  let csrf: string | null = null;
  let csrfFlight: Promise<string> | null = null;
  async function csrfToken() {
    if (csrf) return csrf;
    if (!csrfFlight)
      csrfFlight = fetch(`${base}/dev/session`, {
        credentials: "include",
        cache: "no-store",
      })
        .then(async (r) => {
          const b = await r.json();
          if (!r.ok) throw new Error("请先选择本地联调账号");
          csrf = b.csrfToken;
          return csrf!;
        })
        .finally(() => {
          csrfFlight = null;
        });
    return csrfFlight;
  }
  async function request<T>(
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const method = options.method ?? "GET";
    const headers: Record<string, string> = { "X-Client-Platform": "h5" };
    if (method !== "GET") {
      headers["X-CSRF-Token"] = await csrfToken();
      headers["Content-Type"] = "application/json";
    }
    if (options.idempotencyKey)
      headers["Idempotency-Key"] = options.idempotencyKey;
    const response = await fetch(`${base}/api/v1${path}`, {
      method,
      headers,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
      credentials: "include",
      cache: "no-store",
    });
    if (response.status === 204) return undefined as T;
    const json = await response.json();
    if (!response.ok) {
      const error = new Error(json.error?.message ?? "请求失败") as Error & {
        status: number;
        code: string;
      };
      error.status = response.status;
      error.code = json.error?.code;
      throw error;
    }
    return json.data as T;
  }
  return {
    request,
    invalidateHealth: () => {},
    subscribeSession: (fn) => {
      const changed = () => {
        csrf = null;
        fn();
      };
      window.addEventListener("m02-session", changed);
      return () => window.removeEventListener("m02-session", changed);
    },
  };
}
