"use client";
import { useState, useSyncExternalStore } from "react";
import { Dialog } from "@/components/dialog";
import type {
  CursorPage,
  WaterRecordDto,
  WeightRecordDto,
} from "../../../contracts/shared_types";
import {
  healthApi,
  invalidateHealth,
  healthRevision,
  subscribeHealth,
} from "./runtime";
import { useHealthCommand, useHealthResource } from "./hooks";
import styles from "./health.module.css";

export function HealthErrorNotice({
  error,
  retry,
}: {
  error?: string;
  retry(): void;
}) {
  return error ? (
    <div role="alert" className={styles.error}>
      {error} <button onClick={retry}>重新加载</button>
    </div>
  ) : null;
}
export function MissingWeightChart({
  points,
}: {
  points: { date: string; weightKg: number | null }[];
}) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const measured = points.filter((x) => x.weightKg !== null);
  const selected =
    measured.find((p) => p.date === selectedDate) ?? measured.at(-1);
  if (!measured.length)
    return (
      <div className="empty">这段时间还没有体重测量，记录后会显示在这里</div>
    );
  const weights = measured.map((x) => x.weightKg!),
    min = Math.min(...weights) - 0.5,
    max = Math.max(...weights) + 0.5;
  const x = (i: number) => 35 + (i / Math.max(points.length - 1, 1)) * 550,
    y = (v: number) => 140 - ((v - min) / (max - min)) * 110;
  return (
    <div>
      <svg
        viewBox="0 0 620 190"
        className={styles.chart}
        role="group"
        aria-label="体重趋势，点击测量点查看详情，缺测日期不连接"
      >
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <line
              x1="35"
              x2="585"
              y1={30 + i * 55}
              y2={30 + i * 55}
              stroke="#eeedf5"
            />
            <text x="0" y={34 + i * 55}>
              {(max - (i * (max - min)) / 2).toFixed(1)}
            </text>
          </g>
        ))}
        {points.map((p, i) =>
          p.weightKg === null ? null : (
            <g key={p.date}>
              {i > 0 && points[i - 1].weightKg !== null && (
                <line
                  x1={x(i - 1)}
                  y1={y(points[i - 1].weightKg!)}
                  x2={x(i)}
                  y2={y(p.weightKg)}
                  stroke="#8c78da"
                  strokeWidth="3"
                />
              )}
              <circle
                cx={x(i)}
                cy={y(p.weightKg)}
                r={selected?.date === p.date ? 6 : 4}
                fill="#8c78da"
                role="button"
                tabIndex={0}
                className={styles.chartPoint}
                aria-label={`${p.date} 体重 ${p.weightKg} kg`}
                aria-pressed={selected?.date === p.date}
                onClick={() => setSelectedDate(p.date)}
                onFocus={() => setSelectedDate(p.date)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedDate(p.date);
                  }
                }}
              >
                <title>
                  {p.date} · {p.weightKg} kg
                </title>
              </circle>
            </g>
          ),
        )}
        {[0, Math.floor((points.length - 1) / 2), points.length - 1].map(
          (i, j) => (
            <text key={j} x={x(i)} y="175" textAnchor="middle">
              {points[i]?.date.slice(5)}
            </text>
          ),
        )}
      </svg>
      <p className={styles.chartDetail} aria-live="polite">
        {selected?.date} · <strong>{selected?.weightKg} kg</strong>
        <small>点击测量点查看当天数值</small>
      </p>
    </div>
  );
}
export function WaterHistoryChart({
  points,
}: {
  points: { date: string; waterMl: number; hasWaterRecord: boolean }[];
}) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const selected = points.find((p) => p.date === selectedDate) ?? points.at(-1);
  const maximum = Math.max(1, ...points.map((p) => p.waterMl));
  return (
    <div>
      <div className={styles.waterHistory} aria-label="选择日期查看饮水量">
        {points.map((p, i) => (
          <button
            key={p.date}
            type="button"
            className={styles.waterBar}
            aria-label={`${p.date} 饮水 ${p.hasWaterRecord ? `${p.waterMl} ml` : "未记录"}`}
            aria-pressed={selected?.date === p.date}
            onClick={() => setSelectedDate(p.date)}
          >
            <span className={styles.barArea}>
              <span
                className={
                  p.hasWaterRecord ? styles.barFill : styles.barMissing
                }
                style={{
                  height: p.hasWaterRecord
                    ? `${Math.max(2, (p.waterMl / maximum) * 100)}%`
                    : "2px",
                }}
              />
            </span>
            <small>
              {points.length === 7 ||
              i === 0 ||
              i === points.length - 1 ||
              i % 7 === 0
                ? p.date.slice(5)
                : "·"}
            </small>
          </button>
        ))}
      </div>
      <p className={styles.chartDetail} aria-live="polite">
        {selected?.date} ·{" "}
        <strong>
          {selected?.hasWaterRecord ? `${selected.waterMl} ml` : "未记录"}
        </strong>
        <small>点击日期查看明细，较长区间可左右滑动</small>
      </p>
    </div>
  );
}
export function RecordList(props: { type: "water" | "weight"; date: string }) {
  const revision = useSyncExternalStore(
    subscribeHealth,
    healthRevision,
    () => 0,
  );
  return (
    <RecordListPage
      key={`${props.type}:${props.date}:${revision}`}
      {...props}
    />
  );
}
function RecordListPage({
  type,
  date,
}: {
  type: "water" | "weight";
  date: string;
}) {
  const [cursor, setCursor] = useState<string | undefined>(),
    [pages, setPages] = useState<(WaterRecordDto | WeightRecordDto)[]>([]);
  const resource = useHealthResource(`${type}:${date}:${cursor ?? ""}`, (s) =>
    type === "water"
      ? (healthApi.water(date, cursor, s) as Promise<
          CursorPage<WaterRecordDto | WeightRecordDto>
        >)
      : healthApi.weights(date, cursor, s),
  );
  const command = useHealthCommand();
  const [deleting, setDeleting] = useState<
    WaterRecordDto | WeightRecordDto | null
  >(null);
  const items = cursor
    ? [...pages, ...(resource.data?.items ?? [])]
    : (resource.data?.items ?? []);
  return (
    <div className={styles.records}>
      <HealthErrorNotice error={resource.error} retry={resource.reload} />
      {resource.loading && <p role="status">正在读取记录…</p>}
      {!resource.loading && !resource.error && !items.length && (
        <p className="muted tiny">
          这一天还没有{type === "water" ? "饮水" : "体重"}记录
        </p>
      )}
      {items.map((r) => (
        <div key={r.id} className={styles.record}>
          <span>
            {new Date(r.recordedAt).toLocaleTimeString("zh-CN", {
              timeZone: "Asia/Shanghai",
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            ·{" "}
            <strong>
              {"amountMl" in r ? `${r.amountMl} ml` : `${r.weightKg} kg`}
            </strong>
          </span>
          <button
            disabled={command.pending}
            onClick={() => {
              command.clearError();
              setDeleting(r);
            }}
          >
            删除
          </button>
        </div>
      ))}
      <Dialog
        open={deleting !== null}
        title={`确认删除${type === "water" ? "饮水" : "体重"}记录`}
        onClose={() => {
          if (!command.pending) setDeleting(null);
        }}
      >
        <p>删除 {date} 的这条记录后，将重新计算看板和大屏统计。</p>
        {deleting && (
          <p className={styles.savePreview}>
            {new Date(deleting.recordedAt).toLocaleTimeString("zh-CN", {
              timeZone: "Asia/Shanghai",
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            ·{" "}
            {"amountMl" in deleting
              ? `${deleting.amountMl} ml`
              : `${deleting.weightKg} kg`}
          </p>
        )}
        {type === "water" && (
          <p className="muted tiny">
            删除不影响已获得的积分，也不会恢复当天的领奖资格。
          </p>
        )}
        {command.error && (
          <p role="alert" className={styles.error}>
            {command.error}
          </p>
        )}
        <div className={styles.formActions}>
          <button
            className="outline-button"
            disabled={command.pending}
            onClick={() => setDeleting(null)}
          >
            保留记录
          </button>
          <button
            className={styles.dangerButton}
            disabled={command.pending}
            onClick={() => {
              if (!deleting) return;
              const record = deleting;
              void command.run(
                { type, id: record.id },
                () => healthApi.remove(type, record.id),
                async () => {
                  setDeleting(null);
                  await invalidateHealth(date);
                },
              );
            }}
          >
            {command.pending ? "正在删除…" : "确认删除"}
          </button>
        </div>
      </Dialog>
      {resource.data?.nextCursor && (
        <button
          className="text-link"
          disabled={resource.loading}
          onClick={() => {
            setPages(items);
            setCursor(resource.data!.nextCursor!);
          }}
        >
          查看更多记录
        </button>
      )}
    </div>
  );
}
export function LocalIntegrationNotice() {
  const [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  const base =
    process.env.NODE_ENV === "development"
      ? process.env.NEXT_PUBLIC_M02_DEV_API
      : undefined;
  if (!base) return null;
  async function choose(account: "a" | "b") {
    setPending(true);
    setError("");
    try {
      const r = await fetch(`${base}/dev/session`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account }),
      });
      if (!r.ok) throw new Error("无法连接本地联调服务");
      window.dispatchEvent(new Event("m02-session"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "连接失败");
    } finally {
      setPending(false);
    }
  }
  return (
    <div className={styles.notice}>
      <span>本地联调 · 健康记录连接 M02；其他模块为显式测试适配器</span>
      <div className={styles.actions}>
        <button disabled={pending} onClick={() => void choose("a")}>
          测试账号 A
        </button>
        <button disabled={pending} onClick={() => void choose("b")}>
          测试账号 B
        </button>
      </div>
      {error && <span role="alert">{error}</span>}
    </div>
  );
}
