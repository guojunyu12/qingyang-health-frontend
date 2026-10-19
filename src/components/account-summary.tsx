"use client";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "./auth-provider";
import { Dialog } from "./dialog";
import { api } from "@/lib/api/client";
import { uploadAvatar } from "@/lib/api/uploads";
type Notice = {
  id: string;
  title: string;
  body: string;
  readAt: string | null;
  action: { path: string };
};
export function AccountSummary() {
  const { user, logout, refreshUser } = useAuth();
  const avatarRetry = useRef(0);
  useEffect(() => {
    if (!user?.avatarUrlExpiresAt) return;
    const timer = setTimeout(
      () => {
        void refreshUser().catch(() => {});
      },
      Math.max(1000, Date.parse(user.avatarUrlExpiresAt) - Date.now() - 30000),
    );
    return () => clearTimeout(timer);
  }, [user?.avatarUrlExpiresAt, refreshUser]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState(false);
  const [nickname, setNickname] = useState("");
  const [avatar, setAvatar] = useState<File | null>(null);
  const [inbox, setInbox] = useState(false);
  const [items, setItems] = useState<Notice[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function load(cursor?: string) {
    setLoading(true);
    setError("");
    try {
      const page = await api<{ items: Notice[]; nextCursor: string | null }>(
        "/me/notifications" +
          (cursor ? "?cursor=" + encodeURIComponent(cursor) : ""),
      );
      setItems((old) => (cursor ? [...old, ...page.items] : page.items));
      setNext(page.nextCursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : "通知加载失败");
    } finally {
      setLoading(false);
    }
  }
  return (
    <>
      <div className="account-summary">
        {user?.avatarUrl && (
          <img
            className="account-avatar"
            src={user.avatarUrl}
            alt="我的头像"
            onError={() => {
              if (Date.now() - avatarRetry.current > 30000) {
                avatarRetry.current = Date.now();
                void refreshUser().catch(() => {});
              }
            }}
          />
        )}
        <h2>{user?.nickname ?? "轻养用户"}</h2>
        <p>{user?.email}</p>
        <div className="row-actions">
          <button
            className="text-link"
            onClick={() => {
              setNickname(user?.nickname ?? "");
              setAvatar(null);
              setError("");
              setEdit(true);
            }}
          >
            编辑账号
          </button>
          <button
            className="text-link"
            onClick={() => {
              setInbox(true);
              void load();
            }}
          >
            站内通知
          </button>
          <button
            className="text-link"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await logout();
              } catch {
                setError("退出失败，请重试");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "退出中…" : "退出登录"}
          </button>
        </div>
        {error && !edit && !inbox && <p role="alert">{error}</p>}
      </div>
      <Dialog
        open={edit}
        onClose={() => {
          if (!busy) setEdit(false);
        }}
        title="编辑账号"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const avatarAssetId = avatar
                ? await uploadAvatar(avatar)
                : undefined;
              await api("/me", {
                method: "PATCH",
                body: { nickname, ...(avatarAssetId ? { avatarAssetId } : {}) },
              });
              await refreshUser();
              setEdit(false);
            } catch (e) {
              setError(e instanceof Error ? e.message : "保存失败");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            昵称
            <input
              maxLength={30}
              minLength={1}
              required
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
          </label>
          <label>
            头像
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setAvatar(e.target.files?.[0] ?? null)}
            />
          </label>
          <p className="muted tiny">
            JPEG、PNG、WebP，最多2MB；图片需通过安全校验。
          </p>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button className="primary-button" disabled={busy}>
            {busy ? "上传校验并保存中…" : "保存账号"}
          </button>
        </form>
      </Dialog>
      <Dialog open={inbox} onClose={() => setInbox(false)} title="站内通知">
        <p className="note-block">
          当前支持站内消息；Web Push 尚未配置，暂不提供浏览器推送订阅。
        </p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {!loading && !items.length && <p className="empty">暂无通知</p>}
        {items.map((n) => (
          <article className="task-row" key={n.id}>
            <div>
              <strong>{n.title}</strong>
              <p>{n.body}</p>
              <a href={n.action.path} className="text-link">
                查看相关内容
              </a>
            </div>
            <button
              className="text-link"
              disabled={!!n.readAt}
              onClick={async () => {
                try {
                  await api(`/me/notifications/${n.id}/read`, {
                    method: "PUT",
                    body: {},
                  });
                  setItems((old) =>
                    old.map((x) =>
                      x.id === n.id
                        ? { ...x, readAt: new Date().toISOString() }
                        : x,
                    ),
                  );
                } catch (e) {
                  setError(e instanceof Error ? e.message : "更新失败");
                }
              }}
            >
              {n.readAt ? "已读" : "标为已读"}
            </button>
          </article>
        ))}
        {loading && <p role="status">正在加载…</p>}
        {next && (
          <button
            className="text-link"
            disabled={loading}
            onClick={() => void load(next)}
          >
            加载更多
          </button>
        )}
      </Dialog>
    </>
  );
}
