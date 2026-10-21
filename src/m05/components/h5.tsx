"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { api } from "../lib/api";
import type { User } from "./activity-shared";
import { H5Points } from "./points";
import { H5Rewards } from "./rewards";
import { H5Activities } from "./activities";

const navigation = [
  ["points", "积分任务"],
  ["rewards", "数字权益"],
  ["activities", "活动预约"],
  ["bookings", "我的预约"],
  ["redemptions", "我的兑换"],
  ["community", "社区设置"],
  ["blocks", "屏蔽管理"],
];

export function M05H5() {
  const { user: account } = useAuth();
  const pathname = usePathname();
  const path = pathname.replace(/^\/m05(?=\/|$)/, "") || "/points";
  const route = path.split("/")[1];
  const [session, setSession] = useState<User | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setSession(null);
    setError("");
    if (account)
      api<User>("/api/v1/me/m05-session")
        .then((value) => {
          if (active) setSession(value);
        })
        .catch((failure: Error) => {
          if (active) setError(failure.message);
        });
    return () => {
      active = false;
    };
  }, [account?.id, retry]);
  const user = session?.id === account?.id ? session : null;
  return (
    <div className="m05-scope">
      <header className="section-title">
        <div>
          <p className="eyebrow">轻养 · 坚持有回响</p>
          <h1>
            {navigation.find(([key]) => key === route)?.[1] ?? "页面未找到"}
          </h1>
        </div>
        <Link href="/profile" className="text-link">
          返回我的
        </Link>
      </header>
      <nav className="tabs" aria-label="积分与活动">
        {navigation.map(([key, title]) => (
          <Link
            key={key}
            href={"/m05/" + key}
            className={route === key ? "selected" : ""}
            aria-current={route === key ? "page" : undefined}
          >
            {title}
          </Link>
        ))}
      </nav>
      {error ? (
        <div role="alert">
          <p>{error}</p>
          <button className="button" onClick={() => setRetry((n) => n + 1)}>
            重新连接
          </button>
        </div>
      ) : !user ? (
        <p role="status">正在读取账号…</p>
      ) : (
        <div key={user.id}>
          {route === "points" ? (
            <H5Points user={user} />
          ) : ["rewards", "redemptions"].includes(route) ? (
            <H5Rewards
              user={user}
              path={path}
              refreshVersion={0}
              login={() => {}}
            />
          ) : ["activities", "bookings", "community", "blocks"].includes(
              route,
            ) ? (
            <H5Activities
              user={user}
              path={path}
              refreshVersion={0}
              login={() => {}}
            />
          ) : (
            <p>
              页面不存在。<Link href="/m05/points">返回积分任务</Link>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
