"use client";
import { useEffect, useRef, useState } from "react";
import Link from "./m05-link";
import { api, ApiError } from "../lib/api";
type User = {
  id: string;
  csrfToken: string;
  identityMode?: string;
  roles: string[];
};
type Account = {
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  version: number;
};
type Task = {
  code: string;
  title: string;
  description: string;
  rewardPoints: number;
  progress: number;
  status: string;
  active: boolean;
  ruleVersion: number;
  awardedPoints: number;
  action: { type: string; path?: string };
};
type Tasks = {
  date: string;
  serverDate: string;
  historical: boolean;
  items: Task[];
  consecutiveCheckinDays: number;
};
type Ledger = {
  id: string;
  userId?: string;
  nickname?: string;
  delta: number;
  balanceAfter: number;
  reason: string;
  businessDate: string;
  createdAt: string;
  ruleVersion: number | null;
  sourceId: string | null;
  scopeKey: string | null;
  businessType: string;
};
type Page<T> = { items: T[]; nextCursor: string | null };
// A network retry retains the same command key. A changed payload is a distinct operation.
function useCommand(user: User) {
  const pending = useRef<{ signature: string; key: string } | null>(null);
  return async <T,>(path: string, method: string, body: object) => {
    const signature = JSON.stringify({ path, method, body });
    if (pending.current?.signature !== signature)
      pending.current = { signature, key: crypto.randomUUID() };
    try {
      const result = await api<T>(path, {
        method,
        body: JSON.stringify(body),
        headers: {
          "X-CSRF-Token": user.csrfToken,
          "Idempotency-Key": pending.current.key,
        },
      });
      pending.current = null;
      return result;
    } catch (e) {
      if (
        e instanceof ApiError &&
        e.status < 500 &&
        e.code !== "REQUEST_IN_PROGRESS"
      )
        pending.current = null;
      throw e;
    }
  };
}
export function H5Points({
  user,
  compact = false,
  refreshVersion = 0,
}: {
  user: User;
  compact?: boolean;
  refreshVersion?: number;
}) {
  const [account, setAccount] = useState<Account | null>(null),
    [tasks, setTasks] = useState<Tasks | null>(null),
    [date, setDate] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(""),
    [revision, setRevision] = useState(0);
  const command = useCommand(user);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setLoadError("");
    setTasks(null);
    Promise.all([
      api<Account>("/api/v1/me/points/account"),
      api<Tasks>("/api/v1/me/points/tasks" + (date ? "?date=" + date : "")),
    ])
      .then(([a, t]) => {
        if (live) {
          setAccount(a);
          setTasks(t);
        }
      })
      .catch((e) => {
        if (live) setLoadError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [user.id, date, revision, refreshVersion]);
  const checkin = tasks?.items.find((t) => t.code === "daily_checkin");
  async function sign() {
    if (
      busy || loading || !tasks || tasks.historical || !checkin?.active ||
      checkin.status === "completed"
    ) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await command<{ alreadyCompleted: boolean; account: Account }>(
        "/api/v1/me/points/check-in",
        "POST",
        {},
      );
      setAccount(r.account);
      setNotice(
        r.alreadyCompleted
          ? "今天已经签到，积分不会重复发放。"
          : "签到成功，今天的小坚持已记下。",
      );
      setRevision((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {loadError && (
        <div>
          <p className="alert" role="alert">
            {loadError}
          </p>
          <button
            className="button secondary"
            onClick={() => setRevision((v) => v + 1)}
          >
            重新加载积分任务
          </button>
        </div>
      )}
      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      <section className={`card points-hero ${compact ? "compact" : ""}`}>
        <div className="section-title">
          <h2>{compact ? "我的健康积分" : "把坚持，变成看得见的积累"}</h2>
          <span className="pill">
            连续签到 {tasks?.consecutiveCheckinDays ?? "—"} 天
          </span>
        </div>
        <div className="points-overview">
          <div>
            <p className="muted-text">可用积分</p>
            <div className="point-value" data-testid="point-balance">
              {account?.balance ?? "—"}
              <small>积分</small>
            </div>
            <p className="muted-text">
              累计获得 {account?.lifetimeEarned ?? "—"} · 累计支出{" "}
              {account?.lifetimeSpent ?? "—"}
            </p>
          </div>
          <div>
            <button
              className="button"
              onClick={() => void sign()}
              disabled={
                busy ||
                !tasks ||
                tasks.historical ||
                checkin?.status === "completed" ||
                !checkin?.active
              }
            >
              {busy
                ? "正在签到…"
                : !tasks
                  ? loading
                    ? "正在读取任务"
                    : "任务读取失败"
                  : tasks.historical
                    ? "历史记录只读"
                    : checkin?.status === "completed"
                      ? "今日已签到"
                      : !checkin?.active
                        ? "签到暂停"
                        : `签到 +${checkin.rewardPoints}`}
            </button>
            <p className="muted-text">{tasks?.serverDate} · 上海时间</p>
          </div>
        </div>
        {compact && (
          <Link className="text-link" href="/points">
            查看全部任务与积分明细 →
          </Link>
        )}
      </section>
      {!compact && (
        <>
          <div className="section-title">
            <h2>每日小目标</h2>
            <label className="field inline">
              任务日期
              <input
                aria-label="任务日期"
                type="date"
                max={tasks?.serverDate}
                value={date || tasks?.date || ""}
                onInput={(e) => setDate(e.currentTarget.value)}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
          </div>
          {tasks?.historical && (
            <p className="notice">
              历史任务只读，不能补签；分值展示区分当前规则与当时实得积分。
            </p>
          )}
          <div className="task-grid">
            {tasks?.items.map((t, index) => (
              <section className="card task-card" key={t.code}>
                <span className={`task-icon tone-${index}`}>
                  {["✓", "◒", "♧", "↗"][index]}
                </span>
                <div>
                  <h2>{t.title}</h2>
                  <p>{t.description}</p>
                  <span className="pill muted">
                    当前规则 +{t.rewardPoints} /{" "}
                    {t.code === "course_workout" ? "课程 / 天" : "天"}
                  </span>
                </div>
                <div className="task-result">
                  <strong>
                    {t.progress
                      ? `实得 +${t.awardedPoints}`
                      : !t.active
                        ? "已暂停"
                        : "待完成"}
                  </strong>
                  <small>
                    {t.progress
                      ? `${t.progress} 次完成`
                      : `规则 v${t.ruleVersion}`}
                  </small>
                  {t.code !== "daily_checkin" && !tasks.historical && (
                    <>
                      <Link
                        className="text-link"
                        href={t.action.path || "/points"}
                      >
                        前往完成 →
                      </Link>
                    </>
                  )}
                </div>
              </section>
            ))}
          </div>
          <LedgerView user={user} revision={revision + refreshVersion} />
        </>
      )}
    </>
  );
}
function LedgerView({
  user,
  admin = false,
  revision = 0,
}: {
  user: User;
  admin?: boolean;
  revision?: number;
}) {
  const [data, setData] = useState<Page<Ledger>>({
      items: [],
      nextCursor: null,
    }),
    [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [uid, setUid] = useState(""),
    [type, setType] = useState(""),
    [filter, setFilter] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const sequence = useRef(0);
  async function load(cursor?: string) {
    const n = ++sequence.current;
    setLoading(true);
    setError("");
    try {
      const r = await api<Page<Ledger>>(
        `/api/v1/${admin ? "admin" : "me"}/points/ledger?limit=10${filter}${cursor ? "&cursor=" + encodeURIComponent(cursor) : ""}`,
      );
      if (n === sequence.current)
        setData((old) => ({
          items: cursor ? [...old.items, ...r.items] : r.items,
          nextCursor: r.nextCursor,
        }));
    } catch (e) {
      if (n === sequence.current) setError((e as Error).message);
    } finally {
      if (n === sequence.current) setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    return () => {
      sequence.current++;
    };
  }, [filter, revision, user.id]);
  function apply() {
    if (Boolean(start) !== Boolean(end)) {
      setError("起止日期需要同时填写");
      return;
    }
    const params = new URLSearchParams();
    if (start) {
      params.set("startDate", start);
      params.set("endDate", end);
    }
    if (admin && uid) params.set("userId", uid);
    if (admin && type) params.set("businessType", type);
    const next = params.size ? "&" + params.toString() : "";
    if (next === filter) void load();
    else {
      setData({ items: [], nextCursor: null });
      setFilter(next);
    }
  }
  return (
    <section className="card">
      <div className="section-title">
        <h2>积分收支明细</h2>
        <span className="pill muted">按时间倒序 · 只读账本</span>
      </div>
      <div className="filter-row">
        <label className="field">
          开始日期
          <input
            type="date"
            aria-label="流水开始日期"
            value={start}
            onInput={(e) => setStart(e.currentTarget.value)}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label className="field">
          结束日期
          <input
            type="date"
            aria-label="流水结束日期"
            value={end}
            onInput={(e) => setEnd(e.currentTarget.value)}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
        {admin && (
          <>
            <label className="field">
              用户 ID
              <input
                aria-label="流水用户 ID"
                value={uid}
                onChange={(e) => setUid(e.target.value)}
                placeholder="留空查看全部"
              />
            </label>
            <label className="field">
              流水类型
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="">全部</option>
                <option value="task_award">任务奖励</option>
                <option value="redemption">兑换支出</option>
                <option value="redemption_refund">兑换退款</option>
                <option value="adjustment">调整</option>
              </select>
            </label>
          </>
        )}
        <button className="button secondary" disabled={loading} onClick={apply}>
          筛选流水
        </button>
      </div>
      {error && (
        <div>
          <p className="alert" role="alert">
            {error}
          </p>
          <button
            className="button secondary"
            disabled={loading}
            onClick={() => void load()}
          >
            重新加载流水
          </button>
        </div>
      )}
      {!data.items.length && !error ? (
        <p className="ledger-empty">
          {loading
            ? "正在读取账本…"
            : "暂无积分流水，完成每日任务后在这里查看。"}
        </p>
      ) : (
        <div className="ledger-list">
          {data.items.map((row) => (
            <article className="ledger-row" key={row.id}>
              <div className="ledger-mark">{row.delta > 0 ? "＋" : "−"}</div>
              <div>
                <b>{row.reason}</b>
                <p>
                  {admin ? row.nickname + " · " : ""}
                  {new Date(row.createdAt).toLocaleString("zh-CN", {
                    timeZone: "Asia/Shanghai",
                  })}{" "}
                  · 规则 v{row.ruleVersion ?? "—"}
                </p>
                <details>
                  <summary>查看来源</summary>
                  <p className="mono">
                    流水 {row.id}
                    <br />
                    来源 {row.sourceId || "每日签到"}
                    <br />
                    业务日 {row.businessDate}
                    {row.scopeKey && (
                      <>
                        <br />
                        课程 {row.scopeKey}
                      </>
                    )}
                  </p>
                </details>
              </div>
              <div className="ledger-value">
                <strong>
                  {row.delta > 0 ? "+" : ""}
                  {row.delta}
                </strong>
                <small>余额 {row.balanceAfter}</small>
              </div>
            </article>
          ))}
        </div>
      )}
      {data.nextCursor && (
        <button
          disabled={loading}
          className="button secondary full"
          onClick={() => void load(data.nextCursor!)}
        >
          加载更多流水
        </button>
      )}
    </section>
  );
}
