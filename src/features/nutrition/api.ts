import type {
  CreateMealInput,
  UpdateMealInput,
  MealDto,
  FoodItemDraft,
  RecognitionJobDto,
  RestaurantDto,
  CursorPage,
} from "../../../contracts/shared_types";
export type {
  MealDto,
  MealType,
  FoodItemDraft,
  RestaurantDto,
  FoodItemInput,
} from "../../../contracts/shared_types";
export type CatalogFood = {
  id: string;
  name: string;
  unit: "100g";
  caloriesKcal: number;
  carbsG: number | null;
  proteinG: number | null;
  fatG: number | null;
};
export type Capabilities = {
  mode: "integrated";
  upload: boolean;
  recognition: boolean;
  poi: boolean;
  poiProvider?: string | null;
  poiFavorites?: boolean;
  points: boolean;
  dashboard: boolean;
};
export { ApiError } from "@/lib/api/client";
import { api } from "@/lib/api/client";
import { uploadImage } from "@/lib/api/uploads";
export interface NutritionTransport {
  request<T>(path: string, init?: RequestInit & { operationKey?: string }): Promise<T>;
}
export class M01Transport implements NutritionTransport {
  request<T>(path: string, init: RequestInit & { operationKey?: string } = {}): Promise<T> {
    return api<T>(path, {method:init.method,body:init.body ? JSON.parse(String(init.body)) : undefined,idempotencyKey:init.operationKey,signal:init.signal??undefined});
  }
}
export const abortDelay = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted)
      return reject(new DOMException("Aborted", "AbortError"));
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
export const messageOf = (e: unknown) =>
  e instanceof Error ? e.message : "暂时无法完成，请稍后重试";
export class NutritionClient {
  constructor(
    public transport: NutritionTransport = new M01Transport(),
  ) {}
  capabilities(signal?: AbortSignal) {
    return this.transport.request<Capabilities>("/nutrition/capabilities", { signal });
  }
  async initialize(signal?: AbortSignal) {
    const [capabilities, user] = await Promise.all([
      this.capabilities(signal),
      this.transport.request<{id:string;nickname:string}>("/me",{signal}),
    ]);
    return { capabilities, me: {userId:user.id,nickname:user.nickname} };
  }
  async meals(date: string, signal?: AbortSignal): Promise<MealDto[]> {
    const items: MealDto[] = [];
    let cursor: string | null = null;
    do {
      const page: CursorPage<MealDto> = await this.transport.request(
        `/me/meals?date=${date}&limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
        { signal },
      );
      items.push(...page.items);
      cursor = page.nextCursor;
    } while (cursor && !signal?.aborted);
    return items;
  }
  foods(keyword: string, signal?: AbortSignal) {
    return this.transport.request<CursorPage<CatalogFood>>(
      `/foods?limit=100${keyword.trim() ? `&keyword=${encodeURIComponent(keyword.trim())}` : ""}`,
      { signal },
    );
  }
  meal(id: string, signal?: AbortSignal) {
    return this.transport.request<MealDto>(`/me/meals/${id}`, { signal });
  }
  save(input: CreateMealInput, key: string) {
    return this.transport.request<{ meal: MealDto; awards: unknown[] }>(
      "/me/meals",
      { method: "POST", operationKey: key, body: JSON.stringify(input) },
    );
  }
  update(id: string, input: UpdateMealInput, key: string) {
    return this.transport.request<MealDto>(`/me/meals/${id}`, {
      method: "PATCH",
      operationKey: key,
      body: JSON.stringify(input),
    });
  }
  remove(id: string, key: string) {
    return this.transport.request<void>(`/me/meals/${id}`, {
      method: "DELETE",
      operationKey: key,
    });
  }
  job(id: string, signal?: AbortSignal) {
    return this.transport.request<RecognitionJobDto>(
      `/me/recognition-jobs/${id}`,
      { signal },
    );
  }
  createJob(assetId: string, key: string, signal?: AbortSignal) {
    return this.transport.request<{
      id: string;
      status: string;
      pollAfterMs: number;
    }>("/me/recognition-jobs", {
      method: "POST",
      operationKey: key,
      body: JSON.stringify({ assetId }),
      signal,
    });
  }
  cancelJob(id: string) {
    return this.transport.request<{ id: string; status: string }>(
      `/me/recognition-jobs/${id}/cancel`,
      { method: "POST" },
    );
  }
  async upload(
    file: File,
    key: string,
    signal: AbortSignal,
    progress: (message: string) => void,
  ): Promise<string> {
    return uploadImage(file, "meal_photo", {operationKey:key,signal,progress});
  }
  favorites(cursor?: string, signal?: AbortSignal) {
    return this.transport.request<CursorPage<RestaurantDto>>(
      `/me/restaurant-favorites?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
      { signal },
    );
  }
  nearby(
    input: {
      latitude: number;
      longitude: number;
      radiusMeters: number;
      tag?: string;
      cursor?: string;
    },
    signal?: AbortSignal,
  ) {
    const q = new URLSearchParams({
      latitude: String(input.latitude),
      longitude: String(input.longitude),
      coordinateSystem: "wgs84",
      radiusMeters: String(input.radiusMeters),
      limit: "20",
    });
    if (input.tag) q.set("tag", input.tag);
    if (input.cursor) q.set("cursor", input.cursor);
    return this.transport.request<CursorPage<RestaurantDto>>(
      `/restaurants/nearby?${q}`,
      { signal },
    );
  }
  restaurant(id: string) {
    return this.transport.request<RestaurantDto>(`/restaurants/${id}`);
  }
  favorite(id: string, add: boolean) {
    return this.transport.request(`/me/restaurant-favorites/${id}`, {
      method: add ? "PUT" : "DELETE",
    });
  }
}
export type RecognitionConfirmation = {
  assetId: string;
  jobId: string;
  items: FoodItemDraft[];
};
