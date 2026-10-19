/** Shared invalidation boundary for M02–M06; requests remain no-store until modules opt into a query cache. */
export type Invalidation = {
  userId: string | null;
  resources: readonly string[];
  date?: string;
};
let activeUser: string | null = null;
const listeners = new Set<(event: Invalidation) => void>();
export function setCacheUser(userId: string | null) {
  if (activeUser === userId) return;
  activeUser = userId;
  for (const listener of listeners) listener({ userId, resources: ["all"] });
}
export function subscribeInvalidation(listener: (event: Invalidation) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function invalidateHealth(date: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(date + "T00:00:00Z"))
  )
    throw Error("Invalid business date");
  const event = {
    userId: activeUser,
    date,
    resources: [
      "health",
      "dashboard",
      "overview",
      "nutrition",
      "training",
      "points",
      "tasks",
    ],
  };
  for (const listener of listeners) listener(event);
}
export function invalidatePoints() {
  for (const listener of listeners)
    listener({
      userId: activeUser,
      resources: ["points", "tasks", "dashboard", "overview"],
    });
}
export function clearUserCache() {
  setCacheUser(null);
}
