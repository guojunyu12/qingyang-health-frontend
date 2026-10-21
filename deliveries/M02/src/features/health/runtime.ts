import type {
  CursorPage,
  DashboardDto,
  HealthProfileDto,
  HealthProfileInput,
  OverviewDto,
  WaterRecordDto,
  WeightRecordDto,
} from "../../../contracts/shared_types";
import { createDevRuntime } from "../../../tools/m02-dev/browser-runtime";
export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  idempotencyKey?: string;
  signal?: AbortSignal;
}
/** M01 installs its ONE authenticated client and cache/session hooks here. No local health store. */
export interface HealthRuntime {
  request<T>(path: string, options?: RequestOptions): Promise<T>;
  invalidateHealth(date?: string): void | Promise<void>;
  subscribeSession(listener: () => void): () => void;
}
export class HealthApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
let runtime: HealthRuntime | null = null;
const listeners = new Set<() => void>();
let revision = 0;
let sessionRevision = 0;
export const healthSessionRevision = () => sessionRevision;
const sessionChanged = () => {
  sessionRevision++;
  publish();
};
const publish = () => {
  revision++;
  for (const fn of listeners) fn();
};
let unsubscribe: (() => void) | undefined;
export function installHealthRuntime(value: HealthRuntime) {
  unsubscribe?.();
  runtime = value;
  unsubscribe = value.subscribeSession(sessionChanged);
  sessionChanged();
}
export function getHealthRuntime(): HealthRuntime {
  if (
    !runtime &&
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_M02_DEV_API
  )
    installHealthRuntime(createDevRuntime(process.env.NEXT_PUBLIC_M02_DEV_API));
  if (!runtime)
    throw new HealthApiError(
      503,
      "M01_ADAPTER_REQUIRED",
      "健康服务尚未接入，请连接统一账号与 API 服务",
    );
  return runtime;
}
export const subscribeHealth = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
export const healthRevision = () => revision;
export async function invalidateHealth(date?: string) {
  try {
    await getHealthRuntime().invalidateHealth(date);
  } catch {
    // A committed write stays successful even if another module cache cannot refresh.
  } finally {
    publish();
  }
}
export const healthApi = {
  dashboard: (date: string, signal?: AbortSignal) =>
    getHealthRuntime().request<DashboardDto>(`/me/dashboard?date=${date}`, {
      signal,
    }),
  overview: (range: 7 | 30, endDate: string, signal?: AbortSignal) =>
    getHealthRuntime().request<OverviewDto>(
      `/me/health/overview?range=${range}&endDate=${endDate}`,
      { signal },
    ),
  profile: (signal?: AbortSignal) =>
    getHealthRuntime().request<HealthProfileDto | null>("/me/health-profile", {
      signal,
    }),
  saveProfile: (body: HealthProfileInput) =>
    getHealthRuntime().request<HealthProfileDto>("/me/health-profile", {
      method: "PUT",
      body,
    }),
  water: (date: string, cursor?: string, signal?: AbortSignal) =>
    getHealthRuntime().request<CursorPage<WaterRecordDto>>(
      `/me/water-records?date=${date}&limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
      { signal },
    ),
  weights: (date: string, cursor?: string, signal?: AbortSignal) =>
    getHealthRuntime().request<CursorPage<WeightRecordDto>>(
      `/me/weight-records?startDate=${date}&endDate=${date}&limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
      { signal },
    ),
  addWater: (body: { amountMl: number; recordedAt?: string }, key: string) =>
    getHealthRuntime().request<{
      record: WaterRecordDto;
      awards: { points: number }[];
    }>("/me/water-records", { method: "POST", body, idempotencyKey: key }),
  addWeight: (body: { weightKg: number; recordedAt?: string }, key: string) =>
    getHealthRuntime().request<WeightRecordDto>("/me/weight-records", {
      method: "POST",
      body,
      idempotencyKey: key,
    }),
  remove: (type: "water" | "weight", id: string) =>
    getHealthRuntime().request<void>(`/me/${type}-records/${id}`, {
      method: "DELETE",
    }),
};
