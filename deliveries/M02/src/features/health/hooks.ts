"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  healthRevision,
  healthSessionRevision,
  subscribeHealth,
} from "./runtime";
export const todayShanghai = () =>
  new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
export function useHealthResource<T>(
  key: string,
  load: (signal: AbortSignal) => Promise<T>,
  enabled = true,
) {
  const revision = useSyncExternalStore(
    subscribeHealth,
    healthRevision,
    () => 0,
  );
  const loader = useRef(load);
  loader.current = load;
  const [retry, setRetry] = useState(0);
  const scope = `${key}:${revision}:${retry}`;
  const [result, setResult] = useState<{
    scope: string;
    data?: T;
    error?: string;
  }>({ scope: "" });
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    loader
      .current(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setResult({ scope, data });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setResult({
            scope,
            error:
              error instanceof Error ? error.message : "读取失败，请稍后重试",
          });
      });
    return () => controller.abort();
  }, [scope, enabled]);
  return {
    data: result.scope === scope ? result.data : undefined,
    error: result.scope === scope ? result.error : undefined,
    loading:
      enabled &&
      (result.scope !== scope || (!result.error && result.data === undefined)),
    reload: useCallback(() => setRetry((n) => n + 1), []),
  };
}
export function useHealthCommand() {
  const session = useSyncExternalStore(
    subscribeHealth,
    healthSessionRevision,
    () => 0,
  );

  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const busy = useRef(false),
    operation = useRef<{ body: string; key: string } | null>(null);
  useEffect(() => {
    operation.current = null;
    setError("");
  }, [session]);
  async function run<T>(
    body: unknown,
    command: (key: string) => Promise<T>,
    success: (data: T) => void | Promise<void>,
  ) {
    if (busy.current) return;
    const operationSession = healthSessionRevision();
    const signature = JSON.stringify(body);
    if (!operation.current || operation.current.body !== signature)
      operation.current = { body: signature, key: crypto.randomUUID() };
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const data = await command(operation.current.key);
      operation.current = null;
      if (healthSessionRevision() === operationSession) await success(data);
    } catch (e) {
      if (healthSessionRevision() === operationSession)
        setError(
          e instanceof Error ? e.message : "保存失败，输入已保留，可重试",
        );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return { pending, error, run, clearError: () => setError("") };
}
