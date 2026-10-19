"use client";
import { setCacheUser, clearUserCache } from "@/lib/api/cache";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api/client";
import { HealthProvider } from "./health-provider";
import { AppShell } from "./app-shell";
export type Account = {
  id: string;
  nickname: string;
  email: string;
  joinedAt: string;
  timezone: string;
  avatarUrl?: string | null;
  avatarUrlExpiresAt?: string | null;
};
const Auth = createContext<{
  user: Account | null;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}>(null!);
export const useAuth = () => useContext(Auth);
const clear = () => {
  clearUserCache();
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("qingyang-health-v1")) localStorage.removeItem(key);
    }
    localStorage.removeItem("qingyang-account-id");
  } catch {
    /* Private browsing may disable storage. */
  }
};
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Account | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const path = usePathname();
  const router = useRouter();
  const refreshUser = useCallback(async () => {
    const u = await api<Account>("/me");
    try {
      if (localStorage.getItem("qingyang-account-id") !== u.id) {
        clear();
        localStorage.setItem("qingyang-account-id", u.id);
      }
    } catch {}
    setCacheUser(u.id);
    setUser(u);
    setError("");
  }, []);
  useEffect(() => {
    let active = true;
    refreshUser()
      .catch((e) => {
        if (active) {
          setUser(null);
          if (!(e instanceof ApiError && e.status === 401))
            setError("暂时无法连接账号服务，请重试");
        }
      })
      .finally(() => {
        if (active) setReady(true);
      });
    const expire = () => {
      clear();
      setUser(null);
    };
    const sync = () => {
      setUser(null);
      setReady(false);
      refreshUser()
        .catch(() => setUser(null))
        .finally(() => setReady(true));
    };
    const storage = (event: StorageEvent) => {
      if (event.key === "qingyang-account-id") sync();
    };
    window.addEventListener("storage", storage);
    window.addEventListener("auth-expired", expire);
    return () => {
      active = false;
      window.removeEventListener("auth-expired", expire);
      window.removeEventListener("storage", storage);
    };
  }, [refreshUser]);
  useEffect(() => {
    if (ready && !user && path !== "/login" && !error)
      router.replace("/login?returnTo=" + encodeURIComponent(path));
  }, [ready, user, path, router, error]);
  const logout = useCallback(async () => {
    await api("/auth/logout", { method: "POST", body: {} });
    clear();
    setUser(null);
    router.replace("/login");
  }, [router]);
  return (
    <Auth.Provider value={{ user, refreshUser, logout }}>
      {path === "/login" ? (
        children
      ) : !ready ? (
        <main className="auth-loading" role="status">
          正在恢复登录…
        </main>
      ) : user ? (
        <HealthProvider key={user.id} userId={user.id}>
          <AppShell>{children}</AppShell>
        </HealthProvider>
      ) : error ? (
        <main className="auth-loading">
          <p role="alert">{error}</p>
          <button className="primary-button" onClick={() => location.reload()}>
            重新连接
          </button>
        </main>
      ) : (
        <main className="auth-loading" role="status">
          正在进入登录页…
        </main>
      )}
    </Auth.Provider>
  );
}
