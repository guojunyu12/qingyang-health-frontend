"use client";
import { useState } from "react";
import { Dialog } from "@/components/dialog";
import { healthApi, invalidateHealth } from "./runtime";
import { todayShanghai, useHealthCommand } from "./hooks";
import styles from "./health.module.css";

/** Editing a record date never changes the dashboard's selected day until save succeeds. */
export function HealthRecordPanel({
  type,
  initialDate,
  onClose,
  onSaved,
}: {
  type: "water" | "weight";
  initialDate: string;
  onClose(): void;
  onSaved(date: string, message: string): void;
}) {
  const today = todayShanghai();
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(
    new Date(Date.now() + 8 * 3600000).toISOString().slice(11, 16),
  );
  const [useNow, setUseNow] = useState(initialDate === today);
  const [value, setValue] = useState(type === "water" ? "250" : "");
  const command = useHealthCommand();
  const minDate = new Date(Date.now() - 30 * 86400000 + 8 * 3600000)
    .toISOString()
    .slice(0, 10);
  const title = type === "water" ? "记录饮水" : "记录体重";
  const recordedAt =
    useNow && date === today ? undefined : `${date}T${time}:00+08:00`;
  return (
    <Dialog
      open
      onClose={() => {
        if (!command.pending) onClose();
      }}
      title={title}
    >
      <p className="muted">
        {type === "water"
          ? "每一杯水，都值得好好记录。"
          : "记录当下的自己，不必被数字定义。"}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (type === "water") {
            const body = { amountMl: Number(value), recordedAt };
            void command.run(
              body,
              (key) => healthApi.addWater(body, key),
              async (result) => {
                await invalidateHealth(result.record.businessDate);
                const earned = result.awards.reduce(
                  (sum, a) => sum + a.points,
                  0,
                );
                onSaved(
                  result.record.businessDate,
                  earned ? `饮水已记录，获得 ${earned} 积分` : "饮水已记录",
                );
                onClose();
              },
            );
          } else {
            const body = { weightKg: Number(value), recordedAt };
            void command.run(
              body,
              (key) => healthApi.addWeight(body, key),
              async (result) => {
                await invalidateHealth(result.businessDate);
                onSaved(result.businessDate, "体重已记录");
                onClose();
              },
            );
          }
        }}
      >
        <div className={styles.fields}>
          <label className={styles.wide}>
            {type === "water" ? "饮水量（ml）" : "体重（kg）"}
            <input
              autoFocus
              required
              type="number"
              min={type === "water" ? 1 : 20}
              max={type === "water" ? 1000 : 350}
              step={type === "water" ? 1 : 0.1}
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </label>
          {type === "water" && (
            <div
              className={`${styles.actions} ${styles.wide}`}
              aria-label="快捷饮水量"
            >
              {[100, 250, 500].map((ml) => (
                <button
                  type="button"
                  key={ml}
                  aria-pressed={Number(value) === ml}
                  className={styles.choice}
                  onClick={() => setValue(String(ml))}
                >
                  {ml} ml
                </button>
              ))}
            </div>
          )}
          <label className={styles.wide}>
            记录日期（上海）
            <input
              required
              type="date"
              min={minDate}
              max={today}
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setUseNow(e.target.value === today);
              }}
            />
          </label>
          {date === today && (
            <label className={`${styles.check} ${styles.wide}`}>
              <input
                type="checkbox"
                checked={useNow}
                onChange={(e) => setUseNow(e.target.checked)}
              />
              使用保存时的当前时间
            </label>
          )}
          {(!useNow || date !== today) && (
            <label className={styles.wide}>
              记录时间（上海）
              <input
                required
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </label>
          )}
        </div>
        <p className={styles.savePreview} role="status">
          将记录到 {date || "所选日期"} ·{" "}
          {useNow && date === today ? "当前时间" : time}（上海时间）
        </p>
        <p className="muted tiny">
          可补录过去 30 天；历史补录不补发日任务积分。
        </p>
        {command.error && (
          <p role="alert" className={styles.error}>
            {command.error}，输入已保留。
          </p>
        )}
        <div className={styles.formActions}>
          <button
            type="button"
            className="outline-button"
            disabled={command.pending}
            onClick={onClose}
          >
            取消
          </button>
          <button className="primary-button" disabled={command.pending}>
            {command.pending
              ? "正在保存…"
              : type === "water"
                ? "保存饮水记录"
                : "保存记录"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
