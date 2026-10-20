"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Droplets,
  Flame,
  Footprints,
  Leaf,
  Scale,
} from "lucide-react";
import {
  IntegrationStatus,
  HealthErrorNotice,
  LocalIntegrationNotice,
  MissingWeightChart,
  WaterHistoryChart,
} from "@/features/health/components";
import { todayShanghai, useHealthResource } from "@/features/health/hooks";
import { healthApi } from "@/features/health/runtime";
import styles from "@/features/health/health.module.css";
const moodNames = { happy: "开心", calm: "平静", tired: "疲惫", low: "低落" };
export function Overview() {
  const today = todayShanghai(),
    [range, setRange] = useState<7 | 30>(7),
    [endDate, setEndDate] = useState(today);
  const resource = useHealthResource(`overview:${range}:${endDate}`, (s) =>
    healthApi.overview(range, endDate, s),
  );
  const data = resource.data;
  const metrics = data
    ? [
        {
          name: "日均记录摄入",
          value: data.summary.avgIntakeKcal,
          unit: "千卡",
          icon: Flame,
          cls: "peach",
        },
        {
          name: "日均饮水",
          value: data.summary.avgWaterMl,
          unit: "ml",
          icon: Droplets,
          cls: "blue",
        },
        {
          name: "完成训练",
          value: data.summary.completedWorkouts,
          unit: "次",
          icon: Footprints,
          cls: "lilac",
        },
        {
          name: "最新有效体重",
          value: data.summary.latestWeightKg,
          unit: "kg",
          icon: Scale,
          cls: "mint",
        },
      ]
    : [];
  return (
    <div className={styles.stack}>
      <LocalIntegrationNotice />
      {data && <IntegrationStatus availability={data.availability} />}
      <header className="overview-header">
        <div>
          <p className="greeting">
            <Leaf size={15} />
            轻养 · 我的健康数据空间
          </p>
          <h1>看见坚持，留下的变化。</h1>
          <p>
            {data ? `${data.startDate} — ${data.endDate}` : "正在读取个人记录"}{" "}
            · 上海业务日期
          </p>
        </div>
        <div className="filter-row">
          <div className="range-select">
            {([7, 30] as const).map((n) => (
              <button
                key={n}
                className={range === n ? "active" : ""}
                aria-pressed={range === n}
                onClick={() => setRange(n)}
              >
                近 {n} 天
              </button>
            ))}
          </div>
          <label>
            截止日期{" "}
            <input
              type="date"
              aria-label="截止日期"
              value={endDate}
              max={today}
              onChange={(e) => {
                if (e.target.value) setEndDate(e.target.value);
              }}
            />
          </label>
          <Link className="outline-button" href="/dashboard">
            <ArrowLeft size={14} />
            返回今日
          </Link>
        </div>
      </header>
      <HealthErrorNotice error={resource.error} retry={resource.reload} />
      {resource.loading && <p role="status">正在汇总你的健康记录…</p>}
      {data && (
        <>
          <div className="overview-stat-grid">
            {metrics.map((x) => (
              <section className="card" key={x.name}>
                <div className="section-head">
                  <h3>{x.name}</h3>
                  <span className={`stat-icon ${x.cls}`}>
                    <x.icon size={19} />
                  </span>
                </div>
                <strong>
                  {x.value ?? "—"} <small>{x.unit}</small>
                </strong>
                <small>
                  {x.name === "最新有效体重"
                    ? "截至所选日期的最新有效测量"
                    : x.name === "完成训练"
                      ? "统计所选范围内的已完成训练"
                      : "平均值仅按该类有记录天数计算"}
                </small>
              </section>
            ))}
          </div>
          <div className={styles.grid}>
            <section className="card">
              <div className="section-head">
                <h2>体重变化趋势</h2>
                <span className="tag mint">
                  {data.coverage.weightDays} 天有测量
                </span>
              </div>
              <MissingWeightChart points={data.series} />
              <p className="muted tiny">
                保留全部 {range} 个日期，缺测日期不连接。
              </p>
            </section>
            <section className="card">
              <div className="section-head">
                <h2>饮水记录</h2>
                <small className="muted">
                  {data.coverage.waterDays} / {range} 天有记录
                </small>
              </div>
              <WaterHistoryChart points={data.series} />
              <p className="muted tiny">
                没有记录的日期保留为空，不参与饮水均值计算。
              </p>
            </section>
          </div>
          <div className="overview-lower">
            <section className="card">
              <h2>每一份运动都算数</h2>
              <div className="metric-number">
                <strong>{data.summary.totalExerciseKcal ?? "—"}</strong>
                <span>千卡估算消耗</span>
              </div>
              <p className="muted tiny">
                已完成 {data.summary.completedWorkouts ?? "—"} 次训练
              </p>
              <Link className="text-link" href="/training">
                查看训练计划
              </Link>
            </section>
            <section className="card">
              <h2>心情也值得看见</h2>
              <div className="metric-number">
                <strong>{data.summary.moodRecordedDays ?? "—"}</strong>
                <span>天心情记录</span>
              </div>
              <div className={styles.mood}>
                {data.series
                  .filter((x) => x.mood !== null)
                  .map((x) => (
                    <span key={x.date}>
                      {x.date.slice(5)} · {moodNames[x.mood!]}
                    </span>
                  ))}
              </div>
              {!data.summary.moodRecordedDays && (
                <p className="muted tiny">{data.availability?.companion ? "还没有心情记录，愿意和小养说说吗？" : "心情模块尚未接入"}</p>
              )}
            </section>
            <section className="card">
              <h2>每份坚持，都有回响</h2>
              <div className="metric-number">
                <strong>{data.summary.pointsBalance ?? "—"}</strong>
                <span>可用积分</span>
              </div>
              <p className="muted tiny">
                当前有效预约 {data.summary.activeBookings ?? "—"} 个
              </p>
              <Link className="text-link" href="/profile">
                查看成长足迹
              </Link>
            </section>
          </div>
          <section className="card">
            <div className="section-head">
              <h2>每一天，都有自己的节奏</h2>
              <small className="muted">缺测显示 —</small>
            </div>
            <div className={styles.scroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>日期</th>
                    <th>食物摄入 / 千卡</th>
                    <th>饮水 / ml</th>
                    <th>体重 / kg</th>
                    <th>训练 / 次</th>
                    <th>心情</th>
                  </tr>
                </thead>
                <tbody>
                  {data.series.map((p) => (
                    <tr key={p.date}>
                      <td>{p.date}</td>
                      <td>{p.hasMealRecord ? p.intakeKcal : "—"}</td>
                      <td>{p.hasWaterRecord ? p.waterMl : "—"}</td>
                      <td>{p.weightKg ?? "—"}</td>
                      <td>{p.completedWorkouts ?? "—"}</td>
                      <td>{p.mood ? moodNames[p.mood] : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted tiny">
              记录覆盖：饮食 {data.coverage.mealDays ?? "—"} 天 · 饮水{" "}
              {data.coverage.waterDays} 天 · 体重 {data.coverage.weightDays} 天
              · 心情 {data.coverage.moodDays ?? "—"} 天
            </p>
          </section>
        </>
      )}
      <footer className="page-footer">
        轻养，让健康自然发生。
        <span>个人记录与运动估算，不用于医疗测量或诊断</span>
      </footer>
    </div>
  );
}
