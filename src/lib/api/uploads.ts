import { api } from "./client";
type UploadOptions = { operationKey?:string; signal?:AbortSignal; progress?:(message:string)=>void };
export async function uploadAvatar(file: File) {
  return uploadImage(file, 'avatar');
}
/** M01's single authenticated upload flow, shared by account and business modules. */
export async function uploadImage(file: File, purpose:'avatar'|'meal_photo', options:UploadOptions={}) {
  const limit=purpose==='avatar'?2:10;
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size <= 0 || file.size > limit * 1024 * 1024
  )
    throw Error(`请选择${limit}MB以内的JPEG、PNG或WebP图片`);
  options.signal?.throwIfAborted();
  options.progress?.('准备上传');
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const checksumSha256 = Array.from(new Uint8Array(digest), (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
  const signed = await api<{
    assetId: string;
    uploadUrl: string;
    requiredHeaders: Record<string, string>;
    method?:string;
    maxSizeBytes?:number;
  }>("/uploads/presign", {
    method: "POST",
    body: {
      purpose,
      filename: file.name.slice(0,150),
      contentType: file.type,
      sizeBytes: file.size,
      checksumSha256,
    },
    signal:options.signal,
    idempotencyKey:options.operationKey,
  });
  const url=new URL(signed.uploadUrl,location.origin);
  if(url.origin!==location.origin || !url.pathname.startsWith('/api/v1/uploads/local/') || (signed.method && signed.method!=='PUT'))throw Error('上传地址无效，请联系管理员');
  if(signed.maxSizeBytes && file.size>signed.maxSizeBytes)throw Error('图片超过上传服务大小限制');
  const current=await api<{status:string}>(`/uploads/${signed.assetId}`,{signal:options.signal});
  if(current.status==='ready') return signed.assetId;
  if(current.status==='rejected') throw Error('图片校验失败，请选择其他图片');
  if(current.status==='pending') {
    options.progress?.('上传照片');
    const csrf = await api<{ csrfToken: string }>("/auth/csrf",{signal:options.signal});
    const uploaded = await fetch(signed.uploadUrl, {
      method: "PUT",
      credentials: "include",
      headers: { ...signed.requiredHeaders, "X-CSRF-Token": csrf.csrfToken },
      body: bytes,
      signal:options.signal,
    });
    if (!uploaded.ok) throw Error("文件上传失败，请重试");
    await api(`/uploads/${signed.assetId}/complete`, {
      method: "POST",
      body: { checksumSha256 },
      signal:options.signal,
      idempotencyKey:options.operationKey,
    });
  } else if(current.status!=='validating') throw Error('图片状态不可用，请重新选择图片');
  options.progress?.('校验照片');
  for (let i = 0; i < 80; i++) {
    const asset = await api<{ status: string }>(`/uploads/${signed.assetId}`,{signal:options.signal});
    if (asset.status === "ready") return signed.assetId;
    if (asset.status === "rejected")
      throw Error("图片校验失败，请选择其他图片");
    await new Promise<void>((resolve,reject)=>{
      options.signal?.throwIfAborted();
      const abort=()=>{clearTimeout(timer);reject(new DOMException('Aborted','AbortError'));};
      const timer=setTimeout(()=>{options.signal?.removeEventListener('abort',abort);resolve();},750);
      options.signal?.addEventListener('abort',abort,{once:true});
    });
  }
  throw Error("图片仍在处理中，请稍后重试");
}
