import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/e2e',testMatch:['health-live.spec.ts','nutrition-live.spec.ts'],workers:1,
 use:{channel:'chrome',baseURL:'http://127.0.0.1:3101',viewport:{width:390,height:844}},
 webServer:[
  {command:'node --import tsx tests/support/live-m03-api.ts',cwd:'./server',url:'http://127.0.0.1:3102/api/v1/meta/contract',env:{AUTH_NO_LISTEN:'1',DB_NAME:'qingyang_auth_test',APP_ORIGIN:'http://127.0.0.1:3101',DASHSCOPE_API_KEY:'',M03_AMAP_API_KEY:''},reuseExistingServer:false},
  {command:'node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3101',url:'http://127.0.0.1:3101',env:{API_INTERNAL_URL:'http://127.0.0.1:3102',QY_M03_E2E:'1'},reuseExistingServer:false},
 ],
 reporter:'list',
});
