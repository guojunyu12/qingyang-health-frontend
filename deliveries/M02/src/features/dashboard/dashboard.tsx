"use client";
import { useState, useRef } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  Droplets,
  Flame,
  Plus,
  Scale,
  Sparkles,
  Sun,
} from "lucide-react";
import { HealthRecordPanel } from "@/features/health/record-panel";
import { HealthProfilePanel } from "@/features/health/health-profile-panel";
import {
  HealthErrorNotice,
  LocalIntegrationNotice,
  RecordList,
} from "@/features/health/components";
import { healthApi, invalidateHealth } from "@/features/health/runtime";
import {
  todayShanghai,
  useHealthCommand,
  useHealthResource,
} from "@/features/health/hooks";
import styles from "@/features/health/health.module.css";
export function Dashboard() {
  const today = todayShanghai();
  const waterTrigger = useRef<HTMLButtonElement>(null),
    weightTrigger = useRef<HTMLButtonElement>(null);
  const closeRecordPanel = (type: "water" | "weight") => {
    if (type === "water") setWaterOpen(false);
    else setWeightOpen(false);
    requestAnimationFrame(() =>
      (type === "water" ? waterTrigger : weightTrigger).current?.focus(),
    );
  };
  const [date, setDate] = useState(today),
    [profileOpen, setProfileOpen] = useState(false),
    [weightOpen, setWeightOpen] = useState(false),
    [waterOpen, setWaterOpen] = useState(false);
  const resource = useHealthResource(`dashboard:${date}`, (s) =>
    healthApi.dashboard(date, s),
  );
  const data = resource.data,
    water = useHealthCommand();
  const [success, setSuccess] = useState("");
  const dates = Array.from({ length: 7 }, (_, i) =>
    new Date(Date.parse(today + "T00:00:00Z") - (6 - i) * 86400000)
      .toISOString()
      .slice(0, 10),
  );
  const addWater = (amountMl: number) => {
    const body = { amountMl };
    void water.run(
      body,
      (key) => healthApi.addWater(body, key),
      async (result) => {
        setSuccess(
          result.awards.length
            ? `饮水已记录，获得 ${result.awards.reduce((s, a) => s + a.points, 0)} 积分`
            : "饮水已记录",
        );
        setDate(result.record.businessDate);
        setWaterOpen(false);
        await invalidateHealth(date);
      },
    );
  };
  return (
    <div className={styles.stack}>
      <LocalIntegrationNotice />
      <section className="page-heading">
        <div>
          <p className="greeting">
            <Sun size={16} />
            今天，也要好好照顾自己
          </p>
          <h1>每一点改变，都算数。</h1>
          <p className="muted">
            吃得均衡，动得开心，把生活慢慢调成喜欢的样子。
          </p>
        </div>
        <Link href="/overview" className="outline-button desktop-only">
          健康数据大屏
          <ArrowUpRight size={16} />
        </Link>
      </section>
      <HealthErrorNotice error={resource.error} retry={resource.reload} />
      {resource.loading && <p role="status">正在读取你的健康记录…</p>}
      {success && (
        <p role="status" className={styles.notice}>
          {success}
        </p>
      )}
      {data && (
        <>
          {data.water.targetMl === null && (
            <div className={styles.notice}>
              <span>先记录生活，再慢慢设定目标。你还没有健康档案。</span>
              <button onClick={() => setProfileOpen(true)}>设置个人目标</button>
            </div>
          )}
          <div className="dashboard-layout">
            <div className="dashboard-left">
              <section className="daily-hero">
                <div className="section-head">
                  <h2>
                    今日健康日记{" "}
                    <span className="subtle-badge">
                      {date.slice(5).replace("-", "月")}日
                    </span>
                  </h2>
                  <CalendarDays size={19} />
                </div>
                <div className="week-strip">
                  {dates.map((d) => (
                    <button
                      key={d}
                      aria-pressed={d === date}
                      className={d === date ? "selected" : ""}
                      onClick={() => {
                        setDate(d);
                        setSuccess("");
                      }}
                    >
                      <span>
                        {
                          ["日", "一", "二", "三", "四", "五", "六"][
                            new Date(d + "T00:00:00Z").getUTCDay()
                          ]
                        }
                      </span>
                      <strong>{Number(d.slice(-2))}</strong>
                      <i
                        className={
                          data.week.some((x) => x.date === d && x.hasMealRecord)
                            ? "has-record"
                            : ""
                        }
                      />
                    </button>
                  ))}
                </div>
                <label className="muted tiny">
                  查看记录日期{" "}
                  <input
                    type="date"
                    aria-label="查看记录日期"
                    value={date}
                    max={today}
                    onChange={(e) => {
                      if (e.target.value) {
                        setDate(e.target.value);
                        setSuccess("");
                      }
                    }}
                  />
                </label>
                {date !== today && (
                  <div className={styles.actions}>
                    <span className="muted tiny">
                      正在查看历史记录 · 当前目标口径
                    </span>
                    <button
                      className="text-link"
                      onClick={() => setDate(today)}
                    >
                      返回今天
                    </button>
                  </div>
                )}
                <div className="hero-data">
                  <div>
                    <span className="muted">
                      {data.energy.remainingKcal === null
                        ? "记录的食物摄入"
                        : "剩余热量预算"}
                    </span>
                    <p className={styles.number}>
                      {data.energy.remainingKcal ?? data.energy.intakeKcal}
                      <small> 千卡</small>
                    </p>
                    <p className="muted tiny">
                      {data.energy.effectiveTargetKcal === null
                        ? "设置目标后显示预算"
                        : "当前目标 + 当日运动估算消耗"}
                    </p>
                    {!!data.energy.exceededKcal && (
                      <p>超出预算 {data.energy.exceededKcal} 千卡</p>
                    )}
                  </div>
                  <div className="hero-stats">
                    <div>
                      <span className="stat-icon peach">
                        <Flame size={20} />
                      </span>
                      <p>
                        食物摄入
                        <strong>
                          {data.energy.intakeKcal}
                          <small>千卡</small>
                        </strong>
                      </p>
                    </div>
                    <div>
                      <span className="stat-icon lilac">
                        <Flame size={20} />
                      </span>
                      <p>
                        运动消耗
                        <strong>
                          {data.energy.exerciseKcal}
                          <small>千卡</small>
                        </strong>
                      </p>
                    </div>
                  </div>
                </div>
                <div className={styles.nutrients}>
                  {(["carbs", "protein", "fat"] as const).map((key, i) => {
                    const n = data.nutrients[key];
                    return (
                      <div className={styles.nutrient} key={key}>
                        <span>{["碳水", "蛋白质", "脂肪"][i]}</span>
                        <strong>
                          {n.consumedG} / {n.targetG ?? "—"} g
                        </strong>
                        <div className={styles.track}>
                          <span
                            style={{
                              width: n.targetG
                                ? `${Math.min(100, (n.consumedG / n.targetG) * 100)}%`
                                : "0%",
                            }}
                          />
                        </div>
                        <span className="muted tiny">
                          {!n.complete
                            ? "部分营养未知，显示已知量"
                            : n.targetG === null
                              ? "目标待设置"
                              : "按真实餐记录汇总"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
              <div className="metric-grid">
                <section className="card water-card">
                  <div className="section-head">
                    <h2>
                      <Droplets size={19} />
                      喝水，给身体充充电
                    </h2>
                    <span className="muted tiny">
                      {data.water.targetMl === null
                        ? "目标待设置"
                        : `当前目标 ${data.water.targetMl} ml`}
                    </span>
                  </div>
                  <div className="metric-number">
                    <strong data-testid="water-value">
                      {data.water.totalMl.toLocaleString()}
                    </strong>
                    <span>ml</span>
                    <small>
                      {data.water.progress === null
                        ? "—"
                        : `${Math.round(data.water.progress * 100)}%`}
                    </small>
                  </div>
                  <div
                    className="water-cups"
                    aria-label={
                      data.water.targetMl
                        ? "饮水目标完成度"
                        : "设置目标后显示饮水进度"
                    }
                  >
                    {Array.from({ length: 8 }, (_, i) => (
                      <span
                        key={i}
                        className={
                          i <
                          Math.floor(
                            data.water.targetMl
                              ? (data.water.totalMl / data.water.targetMl) * 8
                              : 0,
                          )
                            ? "filled"
                            : ""
                        }
                      >
                        <Droplets size={24} />
                      </span>
                    ))}
                  </div>
                  <div className={styles.actions}>
                    <button
                      className="soft-button"
                      disabled={
                        water.pending ||
                        data.water.totalMl >= 6000 ||
                        date !== today
                      }
                      onClick={() => addWater(250)}
                    >
                      <Plus size={16} />
                      {water.pending ? "正在保存…" : "喝一杯水"}
                      <span>250 ml</span>
                    </button>
                    <button
                      className="text-link"
                      ref={waterTrigger}
                      onClick={() => setWaterOpen(true)}
                    >
                      手动记录 / 补录
                    </button>
                  </div>
                  {water.error && (
                    <p role="alert" className={styles.error}>
                      {water.error}
                    </p>
                  )}
                  <RecordList key={`water:${date}`} type="water" date={date} />
                </section>
                <section className="card weight-card">
                  <div className="section-head">
                    <h2>
                      <Scale size={19} />
                      体重小变化
                    </h2>
                    <button
                      className="icon-button"
                      aria-label="记录体重"
                      ref={weightTrigger}
                      onClick={() => {
                        setWeightOpen(true);
                      }}
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                  <div className="metric-number">
                    <strong>{data.weight.latestKg ?? "—"}</strong>
                    <span>kg</span>
                    <small>
                      {data.weight.changeKg === null
                        ? "暂无变化对比"
                        : `${data.weight.changeKg > 0 ? "+" : ""}${data.weight.changeKg} kg`}
                    </small>
                  </div>
                  <p className="muted tiny">
                    当前目标 {data.weight.targetKg ?? "待设置"}
                    {data.weight.bmi !== null
                      ? ` · BMI ${data.weight.bmi}`
                      : ""}
                  </p>
                  <p className="muted tiny">
                    {data.weight.latestKg === null
                      ? "当天尚未测量，不沿用其他日期数值"
                      : "显示当天最新有效测量"}
                  </p>
                  <RecordList
                    key={`weight:${date}`}
                    type="weight"
                    date={date}
                  />
                </section>
              </div>
              <section className="card meal-summary">
                <div className="section-head">
                  <h2>认真吃饭，也是爱自己</h2>
                  <Link className="text-link" href="/nutrition">
                    查看饮食日记
                  </Link>
                </div>
                {data.latestMeal ? (
                  <div className="meal-summary-body">
                    <div>
                      <h3>
                        {data.latestMeal.items.map((x) => x.name).join("、")}
                      </h3>
                      <strong>
                        {data.latestMeal.totals.caloriesKcal} 千卡
                      </strong>
                    </div>
                  </div>
                ) : (
                  <div className="empty">这一天还没有餐记录</div>
                )}
              </section>
            </div>
            <div className="dashboard-right">
              <section className="buddy-card">
                <div className="section-head">
                  <span className="tag white">你的健康搭子</span>
                  <Sparkles size={18} />
                </div>
                <h2>
                  健康这件事，
                  <br />
                  我们一起慢慢来。
                </h2>
                <p>按自己的节奏，慢慢来就好。</p>
                <img
                  className="buddy-art"
                  src="/buddy.svg"
                  alt="头顶嫩叶的紫色健康陪伴精灵"
                />
                <div className="buddy-chat">
                  <span>今天的你，感觉怎么样？</span>
                  <Link href="/companion">
                    和小养聊聊
                    <ArrowUpRight size={16} />
                  </Link>
                </div>
              </section>
              <section className="card">
                <div className="section-head">
                  <h2>今天，动一小会儿</h2>
                  <Link href="/training" className="text-link">
                    训练计划
                  </Link>
                </div>
                <div className="empty">
                  {data.recommendedWorkout?.title ??
                    "暂无推荐课程，按自己的节奏活动吧"}
                </div>
              </section>
              <section className="points-teaser">
                <span className="points-symbol">✦</span>
                <div>
                  <h3>每份坚持，都有回响</h3>
                  <p>
                    可用积分 <strong>{data.pointsBalance}</strong>
                  </p>
                </div>
              </section>
              <section className="card">
                <div className="section-head">
                  <h2>个人目标</h2>
                  <button
                    className="text-link"
                    onClick={() => setProfileOpen(true)}
                  >
                    编辑档案
                  </button>
                </div>
                <p className="muted tiny">
                  历史日期展示当前目标。录入边界不代表个人健康建议。
                </p>
                {data.dailyTasks.map((t) => (
                  <div className={styles.record} key={t.code}>
                    <span>{t.title}</span>
                    <span>
                      {t.status === "completed" ? "已完成" : "待完成"}
                    </span>
                  </div>
                ))}
              </section>
            </div>
          </div>
        </>
      )}
      <HealthProfilePanel
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        onSaved={() => setSuccess("个人目标已保存")}
      />
      {weightOpen && (
        <HealthRecordPanel
          type="weight"
          initialDate={date}
          onClose={() => closeRecordPanel("weight")}
          onSaved={(savedDate, message) => {
            setDate(savedDate);
            setSuccess(message);
          }}
        />
      )}
      {waterOpen && (
        <HealthRecordPanel
          type="water"
          initialDate={date}
          onClose={() => closeRecordPanel("water")}
          onSaved={(savedDate, message) => {
            setDate(savedDate);
            setSuccess(message);
          }}
        />
      )}
    </div>
  );
}
