import type { NextConfig } from "next";
const config: NextConfig = { devIndicators: false, distDir: process.env.QY_M03_E2E === '1' ? '.next-m03-e2e' : '.next', async rewrites() { return [{source:"/api/v1/:path*",destination:(process.env.API_INTERNAL_URL ?? "http://127.0.0.1:3002")+"/api/v1/:path*"}];} };
export default config;
