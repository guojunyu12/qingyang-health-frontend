"use client";
import { useEffect, useState } from "react";
import Link from "./m05-link";
import { useRouter } from "next/navigation";
import {
  type User,
  useRead,
  usePages,
  useAction,
  Feedback,
  More,
  Field,
  Select,
  Modal,
  time,
  params,
} from "./activity-shared";
import { api } from "../lib/api";
type Reward = {
  imageAssetId?: string | null;
  imageUrl?: string | null;
  id: string;
  title: string;
  description: string;
  costPoints: number;
  stock: number;
  dailyLimit: number;
  fulfillmentType: string;
  status: string;
  version: number;
  available: boolean;
  testOnly: boolean;
  providerMode: string;
};
type Order = {
  id: string;
  rewardId: string;
  rewardTitle: string;
  rewardVersionSnapshot: number;
  costPoints: number;
  status: string;
  fulfillmentStatus: string;
  version: number;
  createdAt: string;
  fulfilledAt: string | null;
  businessDate: string;
  code?: string;
  testOnly: boolean;
  userId?: string;
  codeAvailable?: boolean;
  execution?: {
    status: string;
    attempts: number;
    last_error_code: string | null;
  };
  ledger?: {
    id: string;
    delta: number;
    balance_after: number;
    business_type: string;
    reversal_of: string | null;
  }[];
};
const orderLabels: Record<string, string> = {
    pending: "处理中",
    fulfilled: "已发放",
    failed: "待核对",
    refunded: "已退款",
  },
  rewardLabels = { draft: "草稿", published: "已发布", archived: "已归档" };
function OrderStatus({ value }: { value: string }) {
  return (
    <span className={"pill " + (value === "fulfilled" ? "success" : "muted")}>
      {orderLabels[value] || value}
    </span>
  );
}
function TestNotice() {
  return (
    <p className="notice">
      独立测试权益：兑换码仅用于验收，不能兑换真实商品或服务。
    </p>
  );
}
export function H5Rewards({
  user,
  path,
  refreshVersion,
  login,
}: {
  user: User | null;
  path: string;
  refreshVersion: number;
  login: () => void;
}) {
  return path.split("/")[1] === "redemptions" ? (
    user ? (
      <Orders
        key={path.split("/")[2] || "list"}
        user={user}
        id={path.split("/")[2]}
        refreshVersion={refreshVersion}
      />
    ) : null
  ) : (
    <Catalog user={user} refreshVersion={refreshVersion} login={login} />
  );
}
function Catalog({
  user,
  refreshVersion,
  login,
}: {
  user: User | null;
  refreshVersion: number;
  login: () => void;
}) {
  const router = useRouter(),
    action = useAction(user),
    [revision, setRevision] = useState(0),
    page = usePages<Reward>(
      "/api/v1/points/rewards",
      refreshVersion + revision,
    ),
    account = useRead<{ balance: number }>(
      user ? "/api/v1/me/points/account" : null,
      refreshVersion + revision,
    ),
    [selected, setSelected] = useState<Reward | null>(null);
  useEffect(() => {
    if (action.errorCode === "REWARD_CHANGED") {
      setSelected(null);
      setRevision((v) => v + 1);
    }
  }, [action.errorCode]);
  return (
    <>
      <section className="rewards-hero">
        <div>
          <p className="eyebrow">SMALL STEPS, LOVELY REWARDS</p>
          <h2>
            把每天的坚持
            <br />
            换成一点小欢喜
          </h2>
          <p>挑选喜欢的数字权益，给努力的自己一份奖励。</p>
          <Link href="/redemptions" className="button secondary">
            我的兑换 →
          </Link>
        </div>
        <div className="rewards-balance">
          <span>可用积分</span>
          <strong>{user ? (account.data?.balance ?? "—") : "—"}</strong>
          {user ? (
            <Link href="/points">去完成积分任务 →</Link>
          ) : (
            <button className="text-button" onClick={login}>
              登录查看积分
            </button>
          )}
        </div>
      </section>
      <Feedback error={action.error || account.error} />
      {action.errorCode === "REWARD_CHANGED" && (
        <p role="status" className="notice">
          已重新读取权益列表，请核对最新价格与库存后重新选择。尚未扣分。
        </p>
      )}
      {page.items.some((r) => r.testOnly) && <TestNotice />}
      <div className="section-title">
        <h2>为自己挑一份奖励</h2>
        <button
          className="button secondary"
          onClick={() => setRevision((v) => v + 1)}
          disabled={page.loading || action.busy}
        >
          刷新权益
        </button>
      </div>
      <div className="reward-grid">
        {page.items.map((r) => (
          <section className="card reward-card" key={r.id}>
            <div className="reward-art">
              {r.imageUrl ? (
                <img src={r.imageUrl} alt={r.title + "封面"} />
              ) : (
                <span aria-hidden="true">◇ ✦</span>
              )}
            </div>
            <div className="section-title">
              <span className="pill muted">
                {r.testOnly ? "测试数字权益" : "数字权益"}
              </span>
              <small>剩余 {r.stock}</small>
            </div>
            <h2>{r.title}</h2>
            <p className="reward-description">{r.description}</p>
            <p className="muted-text">每日限 {r.dailyLimit} 次 · 每次 1 份</p>
            <div className="rule-bottom">
              <strong>
                {r.costPoints}
                <small> 积分</small>
              </strong>
              <button
                className="button"
                disabled={action.busy || r.stock === 0 || !r.available}
                onClick={() => (user ? setSelected(r) : login())}
              >
                {!r.available
                  ? "履约暂未开放"
                  : r.stock === 0
                    ? "已兑完"
                    : "立即兑换"}
              </button>
            </div>
          </section>
        ))}
      </div>
      <More page={page} />
      {selected && (
        <Modal
          title="确认积分兑换"
          close={() => setSelected(null)}
          busy={action.busy}
        >
          <h3>{selected.title}</h3>
          {selected.testOnly && <TestNotice />}
          <div className="exchange-price">
            {selected.costPoints}
            <small> 积分 / 1 份</small>
          </div>
          <p>
            当前可用 {account.data?.balance ?? "—"} 积分，剩余 {selected.stock}{" "}
            份；每日最多 {selected.dailyLimit} 次。
          </p>
          <p className="muted-text">
            提交后扣分并进入履约。结果未知时保持处理中；确认最终失败后原额退款。退款订单仍计入当日次数。
          </p>
          <Feedback error={action.error} />
          {(account.data?.balance ?? 0) < selected.costPoints && (
            <p className="alert">积分不足，先去完成每日任务吧。</p>
          )}
          <button
            className="button full"
            disabled={
              action.busy ||
              !account.data ||
              account.data.balance < selected.costPoints
            }
            onClick={() =>
              void action.run<Order>(
                "/api/v1/me/points/redemptions",
                "POST",
                {
                  rewardId: selected.id,
                  quantity: 1,
                  expectedRewardVersion: selected.version,
                },
                "兑换申请已提交",
                (r) => {
                  setSelected(null);
                  router.push("/m05/redemptions/" + r.id);
                },
              )
            }
          >
            {action.busy
              ? "正在提交…"
              : "确认扣除 " + selected.costPoints + " 积分"}
          </button>
        </Modal>
      )}
    </>
  );
}
function Orders({
  user,
  id,
  refreshVersion,
  admin = false,
}: {
  user: User;
  id?: string;
  refreshVersion: number;
  admin?: boolean;
}) {
  const [status, setStatus] = useState(""),
    [uid, setUid] = useState(""),
    [filter, setFilter] = useState(""),
    [revision, setRevision] = useState(0),
    action = useAction(user),
    base = "/api/v1/" + (admin ? "admin" : "me") + "/points/redemptions",
    rev = revision + refreshVersion + action.revision,
    page = usePages<Order>(base + "?" + filter, rev),
    detail = useRead<Order>(id ? base + "/" + id : null, rev),
    rows = id ? (detail.data ? [detail.data] : []) : page.items;
  useEffect(() => {
    if (!rows.some((r) => r.status === "pending")) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") setRevision((v) => v + 1);
    }, 5000);
    return () => clearInterval(timer);
  }, [rows.some((r) => r.status === "pending")]);
  return (
    <>
      <div className="section-title">
        <Link className="text-link" href={id ? "/redemptions" : "/rewards"}>
          ← {id ? "全部兑换记录" : "权益目录"}
        </Link>
        <button
          className="button secondary"
          onClick={() => setRevision((v) => v + 1)}
        >
          刷新订单
        </button>
      </div>
      {!id && (
        <section className="card">
          <form
            className="filter-row"
            onSubmit={(e) => {
              e.preventDefault();
              setFilter(params({ status, ...(admin ? { userId: uid } : {}) }));
              setRevision((v) => v + 1);
            }}
          >
            <Select
              label="兑换状态"
              value={status}
              onChange={setStatus}
              all="全部状态"
              options={orderLabels}
            />
            {admin && (
              <Field label="兑换用户编号" value={uid} onChange={setUid} />
            )}
            <button className="button secondary">查询兑换</button>
          </form>
        </section>
      )}
      <Feedback error={detail.error || action.error} notice={action.notice} />
      {id && detail.loading && <p role="status">正在读取兑换详情…</p>}
      {id && detail.error && (
        <button className="button secondary" onClick={detail.reload}>
          重新加载兑换详情
        </button>
      )}
      {rows.map((r) => (
        <section className="card redemption-card" key={r.id}>
          <div className="section-title">
            <h2>{r.rewardTitle}</h2>
            <OrderStatus value={r.status} />
          </div>
          {r.testOnly && <span className="pill muted">仅测试权益</span>}
          <p>
            实付 <b>{r.costPoints} 积分</b> · {time(r.createdAt)}
          </p>
          <p className="muted-text">
            {r.status === "pending"
              ? "正在核对履约结果，请勿重复兑换。超时不会自动退款。"
              : r.status === "refunded"
                ? "供应商确认最终失败，原额积分已退回，库存已恢复。"
                : r.status === "fulfilled"
                  ? "权益已发放，兑换信息仅本人可查看。"
                  : "订单需由后台核对。"}
          </p>
          {r.code && !admin && (
            <div className="redemption-code">
              <small>
                {r.testOnly
                  ? "测试兑换码 · 无真实兑换价值"
                  : "兑换码 · 请妥善保管"}
              </small>
              <code>{r.code}</code>
            </div>
          )}
          <div className="button-row">
            {!id && (
              <Link className="button secondary" href={"/redemptions/" + r.id}>
                查看兑换详情
              </Link>
            )}
            {admin && r.status === "pending" && (
              <button
                className="button secondary"
                disabled={action.busy}
                onClick={() =>
                  void action.run(
                    base + "/" + r.id + "/reconcile",
                    "POST",
                    { version: r.version },
                    "已安排供应商结果核对，请稍后刷新。",
                  )
                }
              >
                核对履约结果
              </button>
            )}
            {!admin && r.status === "refunded" && (
              <Link className="text-link" href="/points">
                查看退款流水 →
              </Link>
            )}
          </div>
          {id && (
            <>
              <dl className="detail-list">
                <dt>订单编号</dt>
                <dd className="mono wrap">{r.id}</dd>
                <dt>权益版本快照</dt>
                <dd>{r.rewardVersionSnapshot}</dd>
                <dt>兑换业务日</dt>
                <dd>{r.businessDate}</dd>
                <dt>发放时间</dt>
                <dd>{time(r.fulfilledAt || undefined)}</dd>
                {admin && (
                  <>
                    <dt>用户编号</dt>
                    <dd className="mono wrap">{r.userId}</dd>
                    <dt>执行器状态</dt>
                    <dd>
                      {r.execution?.status || "—"} · 已尝试{" "}
                      {r.execution?.attempts || 0} 次
                    </dd>
                    <dt>核对提示</dt>
                    <dd>{r.execution?.last_error_code || "无异常"}</dd>
                    <dt>兑换码</dt>
                    <dd>
                      {r.codeAvailable
                        ? "已加密保存，管理员不可读取"
                        : "尚未发放"}
                    </dd>
                  </>
                )}
              </dl>
              {admin && (
                <>
                  <h3>关联扣分与退款流水</h3>
                  {r.ledger?.map((l) => (
                    <div className="ledger-row" key={l.id}>
                      <div>
                        <b>
                          {l.business_type === "redemption_refund"
                            ? "兑换退款"
                            : "兑换扣分"}
                        </b>
                        <p className="mono wrap">{l.id}</p>
                        {l.reversal_of && (
                          <small className="wrap">
                            对应原扣分 {l.reversal_of}
                          </small>
                        )}
                      </div>
                      <strong>
                        {l.delta > 0 ? "+" : ""}
                        {l.delta}
                      </strong>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </section>
      ))}
      {!id && <More page={page} />}
    </>
  );
}
