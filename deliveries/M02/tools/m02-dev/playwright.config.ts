import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "../../tests/e2e",
  testMatch: "m02.spec.ts",
  fullyParallel: false,
  timeout: 90000,
  workers: 1,
  use: {
    channel: "chrome",
    baseURL: "http://127.0.0.1:3001",
    viewport: { width: 390, height: 844 },
  },
  reporter: "list",
  outputDir: "../../test-results/m02",
  webServer: {
    command: "NEXT_PUBLIC_M02_DEV_API=http://127.0.0.1:4002 npm run dev",
    cwd: "../..",
    url: "http://127.0.0.1:3001",
    reuseExistingServer: true,
  },
});
