import { api } from "./client";
export async function uploadAvatar(file: File) {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 2 * 1024 * 1024
  )
    throw Error("请选择2MB以内的JPEG、PNG或WebP图片");
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const checksumSha256 = Array.from(new Uint8Array(digest), (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
  const signed = await api<{
    assetId: string;
    uploadUrl: string;
    requiredHeaders: Record<string, string>;
  }>("/uploads/presign", {
    method: "POST",
    body: {
      purpose: "avatar",
      filename: file.name,
      contentType: file.type,
      sizeBytes: file.size,
      checksumSha256,
    },
  });
  const csrf = await api<{ csrfToken: string }>("/auth/csrf");
  const uploaded = await fetch(signed.uploadUrl, {
    method: "PUT",
    credentials: "include",
    headers: { ...signed.requiredHeaders, "X-CSRF-Token": csrf.csrfToken },
    body: bytes,
  });
  if (!uploaded.ok) throw Error("文件上传失败，请重试");
  await api(`/uploads/${signed.assetId}/complete`, {
    method: "POST",
    body: { checksumSha256 },
  });
  for (let i = 0; i < 20; i++) {
    const asset = await api<{ status: string }>(`/uploads/${signed.assetId}`);
    if (asset.status === "ready") return signed.assetId;
    if (asset.status === "rejected")
      throw Error("图片校验失败，请选择其他图片");
    await new Promise((r) => setTimeout(r, 750));
  }
  throw Error("图片仍在处理中，请稍后重试");
}
