"use client";
import { useState } from "react";
import Link from "next/link";
import { HealthProfilePanel } from "@/features/health/health-profile-panel";
import { AccountSummary } from "@/components/account-summary";

export function Profile() {
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [notice, setNotice] = useState("");
  return (
    <>
      <section className="page-heading">
        <div>
          <p className="greeting">每一份坚持，都在悄悄改变你</p>
          <h1>成为，更喜欢的自己。</h1>
          <p className="muted">管理健康档案，查看积分与活动。</p>
        </div>
      </section>
      <section className="profile-banner">
        <AccountSummary />
        <button className="outline-button" onClick={() => setGoalsOpen(true)}>
          健康档案
        </button>
      </section>
      {notice && <p role="status">{notice}</p>}
      <div className="profile-columns">
        {[
          ["points", "我的健康积分", "查看真实积分账户、每日任务与收支明细"],
          ["rewards", "数字权益", "查看可兑换权益与实际库存"],
          ["activities", "活动预约", "发现活动、查询场次与报名名额"],
          ["bookings", "我的预约", "管理预约与取消记录"],
          ["redemptions", "我的兑换", "跟踪权益发放与退款状态"],
          ["community", "社区与隐私", "管理公开资料、屏蔽与举报"],
        ].map(([path, title, description]) => (
          <section className="card" key={path}>
            <h2>{title}</h2>
            <p className="muted">{description}</p>
            <Link className="text-link" href={"/m05/" + path}>
              进入{title} →
            </Link>
          </section>
        ))}
      </div>
      <HealthProfilePanel
        open={goalsOpen}
        onClose={() => setGoalsOpen(false)}
        onSaved={() => setNotice("健康档案已保存")}
      />
    </>
  );
}
