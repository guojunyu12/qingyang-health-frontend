import { describe, it, expect, vi, afterEach } from "vitest";
import { api, safeReturnTo } from "../src/lib/api/client";
afterEach(() => vi.unstubAllGlobals());
describe("auth request client", () => {
  it("allows only known local return paths", () => {
    expect(safeReturnTo("//evil.com")).toBe("/dashboard");
    expect(safeReturnTo("/profile")).toBe("/profile");
    expect(safeReturnTo("/login")).toBe("/dashboard");
  });
  it("does not parse a 204 body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    );
    expect(
      await api("/test", { method: "POST", body: {}, csrf: false }),
    ).toBeUndefined();
  });
  it("shares one refresh for parallel 401s", async () => {
    let fresh = false;
    let n = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith("/auth/csrf"))
          return Response.json({ data: { csrfToken: "test" } });
        if (url.endsWith("/auth/refresh")) {
          n++;
          await new Promise((r) => setTimeout(r, 10));
          fresh = true;
          return Response.json({ data: {} });
        }
        if (!fresh)
          return Response.json(
            { error: { message: "expired" } },
            { status: 401 },
          );
        return Response.json({ data: { ok: true } });
      }),
    );
    await Promise.all([api("/me"), api("/me")]);
    expect(n).toBe(1);
  });
});
it('retries a lost refresh response with the identical authentication key',async()=>{let refreshed=false;const keys:string[]=[];vi.stubGlobal('fetch',vi.fn(async(url:string,options?:RequestInit)=>{if(url.endsWith('/auth/csrf'))return Response.json({data:{csrfToken:'test'}});if(url.endsWith('/auth/refresh')){keys.push((options!.headers as Record<string,string>)['Idempotency-Key']);if(keys.length===1)throw new TypeError('Network response lost');refreshed=true;return Response.json({data:{}});}return refreshed?Response.json({data:{ok:true}}):Response.json({error:{message:'expired'}},{status:401});}));await api('/me');expect(keys).toHaveLength(2);expect(keys[0]).toBeTruthy();expect(keys[0]).toBe(keys[1]);});
