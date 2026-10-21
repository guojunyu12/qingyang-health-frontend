"use client";
import { useEffect, useState } from "react";
import { Dialog } from "@/components/dialog";
import type { HealthProfileInput } from "../../../contracts/shared_types";
import { healthApi, invalidateHealth } from "./runtime";
import { useHealthCommand, useHealthResource } from "./hooks";
import styles from "./health.module.css";
const fields = [
  ["heightCm", "身高（cm，可选）", 50, 250, false],
  ["birthYear", "出生年份（可选）", 1900, 9999, true],
  ["targetWeightKg", "目标体重（kg）", 20, 350, false],
  ["waterTargetMl", "饮水目标（ml）", 500, 6000, true],
  ["calorieTargetKcal", "基础热量目标（千卡）", 800, 5000, false],
  ["carbsTargetG", "碳水目标（g，可选）", 0, 1000, false],
  ["proteinTargetG", "蛋白质目标（g，可选）", 0, 1000, false],
  ["fatTargetG", "脂肪目标（g，可选）", 0, 1000, false],
] as const;
export function HealthProfilePanel({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose(): void;
  onSaved(): void;
}) {
  const resource = useHealthResource(
    "profile",
    (s) => healthApi.profile(s),
    open,
  );
  const [values, setValues] = useState<Record<string, string>>({}),
    [version, setVersion] = useState(0);
  const [goal, setGoal] = useState<HealthProfileInput["goalType"] | "">("");
  const command = useHealthCommand();
  useEffect(() => {
    if (resource.data === undefined) return;
    const data = resource.data;
    const next: Record<string, string> = {};
    for (const [key] of fields)
      next[key] = data?.[key] == null ? "" : String(data[key]);
    setValues(next);
    setVersion(data?.version ?? 0);
    setGoal(data?.goalType ?? "");
  }, [resource.data]);
  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!command.pending) onClose();
      }}
      title="健康档案与个人目标"
    >
      <p className="muted">
        目标由你主动设置。当前体重来自测量记录，历史页面使用当前目标。
      </p>
      {resource.loading && <p role="status">正在读取档案…</p>}
      {resource.error && (
        <div role="alert" className={styles.error}>
          {resource.error} <button onClick={resource.reload}>重试</button>
        </div>
      )}
      {resource.data !== undefined && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const payload: Record<string, unknown> = {
              version,
              goalType: goal,
            };
            for (const [key] of fields)
              payload[key] = values[key] === "" ? null : Number(values[key]);
            void command.run(
              payload,
              () =>
                healthApi.saveProfile(payload as unknown as HealthProfileInput),
              async () => {
                await invalidateHealth();
                onSaved();
                onClose();
              },
            );
          }}
        >
          <div className={styles.fields}>
            <p className={`${styles.wide} ${styles.fieldHeading}`}>
              个人目标 <small>必填，由你主动设置</small>
            </p>
            {fields
              .filter(([key]) =>
                [
                  "targetWeightKg",
                  "waterTargetMl",
                  "calorieTargetKcal",
                ].includes(key),
              )
              .map((field) => (
                <ProfileNumberField
                  key={field[0]}
                  field={field}
                  value={values[field[0]] ?? ""}
                  onChange={(value) =>
                    setValues((previous) => ({
                      ...previous,
                      [field[0]]: value,
                    }))
                  }
                />
              ))}
            <label className={styles.wide}>
              健康目标
              <select
                aria-label="健康目标"
                required
                value={goal}
                onChange={(e) => setGoal(e.target.value as typeof goal)}
              >
                <option value="">请选择你的目标</option>
                <option value="balanced">均衡生活</option>
                <option value="maintain">保持体重</option>
                <option value="lose">减重</option>
                <option value="gain">增重</option>
              </select>
            </label>
          </div>
          <details className={styles.optionalFields}>
            <summary>可选信息：身高、出生年份与营养目标</summary>
            <p className="muted tiny">
              可以稍后填写；留空的信息不会被自动补成默认值。
            </p>
            <div className={styles.fields}>
              {fields
                .filter(
                  ([key]) =>
                    ![
                      "targetWeightKg",
                      "waterTargetMl",
                      "calorieTargetKcal",
                    ].includes(key),
                )
                .map((field) => (
                  <ProfileNumberField
                    key={field[0]}
                    field={field}
                    value={values[field[0]] ?? ""}
                    onChange={(value) =>
                      setValues((previous) => ({
                        ...previous,
                        [field[0]]: value,
                      }))
                    }
                  />
                ))}
            </div>
          </details>
          {command.error && (
            <div role="alert" className={styles.error}>
              {command.error}
              {command.error.includes("重新加载") && (
                <button type="button" onClick={resource.reload}>
                  重新加载最新档案
                </button>
              )}
            </div>
          )}
          <button className="primary-button" disabled={command.pending}>
            {command.pending ? "正在保存…" : "保存个人目标"}
          </button>
        </form>
      )}
    </Dialog>
  );
}

function ProfileNumberField({
  field,
  value,
  onChange,
}: {
  field: (typeof fields)[number];
  value: string;
  onChange(value: string): void;
}) {
  const [key, label, min, max, integer] = field;
  return (
    <label>
      {label}
      <input
        type="number"
        inputMode={integer ? "numeric" : "decimal"}
        required={!label.includes("可选")}
        min={min}
        max={
          key === "birthYear"
            ? new Date(Date.now() + 8 * 3600000).getUTCFullYear()
            : max
        }
        step={integer ? 1 : 0.1}
        placeholder={label.includes("可选") ? "选填" : "请填写"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
