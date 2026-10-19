"use client";
import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useState,
  useCallback,
  type ReactNode,
  type Dispatch,
} from "react";
import { healthReducer, shanghaiDate } from "@/lib/health/reducer";
import { makeSeed } from "@/lib/health/seed";
import { readState, writeState } from "@/lib/health/storage";
import type { HealthState, HealthAction } from "@/lib/health/types";
const Context = createContext<{
  state: HealthState;
  dispatch: Dispatch<HealthAction>;
  ready: boolean;
  today: string;
  storageWarning: string;
}>(null!);
export function HealthProvider({ children, userId }: { children: ReactNode; userId: string }) {
  const accountStorage = { getItem: (_key: string) => window.localStorage.getItem("qingyang-health-v1:" + userId), setItem: (_key: string, value: string) => window.localStorage.setItem("qingyang-health-v1:" + userId, value) };
  const [state, rawDispatch] = useReducer(healthReducer, makeSeed());
  const [ready, setReady] = useState(false);
  const [today, setToday] = useState("2026-10-18");
  const [storageWarning, setWarning] = useState("");
  useEffect(() => {
    let result;
    try {
      result = readState(accountStorage);
    } catch {
      result = {
        state: makeSeed(shanghaiDate()),
        warning: "无法读取本地存储，本次记录可能无法保存。",
      };
    }
    rawDispatch({ type: "restore", state: result.state });
    setToday(shanghaiDate());
    setWarning(result.warning ?? "");
    setReady(true);
    const refreshDate = () => setToday(shanghaiDate());
    const t = setInterval(refreshDate, 30000);
    window.addEventListener("focus", refreshDate);
    document.addEventListener("visibilitychange", refreshDate);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", refreshDate);
      document.removeEventListener("visibilitychange", refreshDate);
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      if (!writeState(accountStorage, state))
        setWarning("浏览器无法保存记录，请检查存储空间或隐私设置。");
    } catch {
      setWarning("浏览器无法保存记录，本次记录刷新后可能丢失。");
    }
  }, [state, ready]);
  const dispatch = useCallback((action: HealthAction) => {
    setToday(shanghaiDate());
    rawDispatch(action);
  }, []);
  return (
    <Context.Provider value={{ state, dispatch, ready, today, storageWarning }}>
      {children}
    </Context.Provider>
  );
}
export const useHealth = () => useContext(Context);
