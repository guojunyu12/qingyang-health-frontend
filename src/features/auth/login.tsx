"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Leaf, ArrowRight, ShieldCheck, Mail } from "lucide-react";
import { api, ApiError, safeReturnTo } from "@/lib/api/client";
import { useAuth } from "@/components/auth-provider";
export function Login() {
  const router = useRouter();
  const loginAttempt = useRef({ body: "", key: "" });
  const { refreshUser, user } = useAuth();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState("");
  const [until, setUntil] = useState(0);
  const [left, setLeft] = useState(0);
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const destination = () =>
    safeReturnTo(new URLSearchParams(location.search).get("returnTo"));
  useEffect(() => {
    const tick = () =>
      setLeft(Math.max(0, Math.ceil((until - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  }, [until]);
  useEffect(() => {
    if (user)
      router.replace(
        safeReturnTo(new URLSearchParams(location.search).get("returnTo")),
      );
  }, [user, router]);
  async function send() {
    setSending(true);
    setError("");
    setNotice("");
    try {
      const result = await api<{
        challengeId: string;
        resendAfterSeconds: number;
      }>("/auth/email-codes", {
        method: "POST",
        csrf: false,
        body: { email: email.trim(), purpose: "login" },
      });
      setChallenge(result.challengeId);
      setCode("");
      setUntil(Date.now() + result.resendAfterSeconds * 1000);
      setNotice("验证码已发送，请查看邮箱和垃圾邮件。");
    } catch (e) {
      setError(e instanceof Error ? e.message : "发送失败，请重试");
      if (e instanceof ApiError && e.retryAfterSeconds)
        setUntil(Date.now() + e.retryAfterSeconds * 1000);
    } finally {
      setSending(false);
    }
  }
  async function login(e: React.FormEvent) {
    e.preventDefault();
    if (!challenge) return;
    setSubmitting(true);
    setError("");
    try {
      let deviceId = crypto.randomUUID();
      try {
        const saved = localStorage.getItem("qingyang-device-id");
        if (saved)
          deviceId =
            saved as `${string}-${string}-${string}-${string}-${string}`;
        else localStorage.setItem("qingyang-device-id", deviceId);
      } catch {
        /* Session can work when browser storage is disabled. */
      }
      const fingerprint = challenge + ":" + code + ":" + deviceId;
      if (loginAttempt.current.body !== fingerprint)
        loginAttempt.current = { body: fingerprint, key: crypto.randomUUID() };
      await api("/auth/login", {
        idempotencyKey: loginAttempt.current.key,
        method: "POST",
        csrf: false,
        body: { challengeId: challenge, code, deviceId, platform: "h5" },
      });
      await refreshUser();
      router.replace(destination());
    } catch (e) {
      setError(e instanceof Error ? e.message : "登录失败，请重试");
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <main id="main" className="login-page">
      <div className="login-decoration" aria-hidden="true">
        <img src="/buddy.svg" alt="" />
        <span>
          每一份坚持
          <br />
          都有温柔的回应。
        </span>
      </div>
      <section className="login-card">
        <a href="/login" className="brand">
          <span className="brand-mark">
            <Leaf size={25} />
          </span>
          <span>
            轻养<small>让健康，自然发生</small>
          </span>
        </a>
        <p className="login-eyebrow">YOUR EVERYDAY WELLNESS</p>
        <h1>
          从今天开始，
          <br />
          好好照顾自己。
        </h1>
        <p className="muted">用邮箱登录，开启你的健康空间。</p>
        <form onSubmit={login}>
          <label htmlFor="login-email">邮箱地址</label>
          <div className="login-email">
            <Mail size={18} />
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              maxLength={254}
              required
              placeholder="请输入你的邮箱"
              value={email}
              disabled={sending || submitting}
              onChange={(e) => {
                setEmail(e.target.value);
                setChallenge("");
                setCode("");
                setNotice("");
                setError("");
              }}
            />
          </div>
          <label htmlFor="login-code">验证码</label>
          <div className="login-code">
            <input
              id="login-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              placeholder="6 位邮箱验证码"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
            <button
              type="button"
              className="text-link"
              disabled={
                sending ||
                submitting ||
                left > 0 ||
                !email ||
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
              }
              onClick={send}
            >
              {sending
                ? "发送中…"
                : left > 0
                  ? `${left} 秒后重发`
                  : "获取验证码"}
            </button>
          </div>
          {notice && (
            <p className="login-message" role="status">
              {notice}
            </p>
          )}
          {error && (
            <p className="error login-message" role="alert">
              {error}
            </p>
          )}
          <button
            className="primary-button full-width login-submit"
            disabled={!challenge || code.length !== 6 || submitting || sending}
          >
            {submitting ? "正在登录…" : "登录 / 注册"}
            <ArrowRight size={18} />
          </button>
          <p className="login-hint">未注册邮箱验证成功后，将自动创建账号。</p>
        </form>
        <div className="login-security">
          <ShieldCheck size={16} />
          验证码仅用于身份验证，请勿转发给他人
        </div>
        <p className="login-demo">
          当前饮食、运动等业务仍为演示；账号登录已连接真实服务。
        </p>
      </section>
    </main>
  );
}
