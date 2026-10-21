# M02｜前端交付与团队接入

日期：2026-10-21。前端和后端分别提交到 [qingyang-health-frontend](https://github.com/guojunyu12/qingyang-health-frontend) 和 [qingyang-health-backend](https://github.com/guojunyu12/qingyang-health-backend)。团队现有M02代码位于 `codex/integrate-m02`；本轮交接补充在 `codex/m02-handoff-update`，提交评审后由主整合窗口合入。

## 源码和入口

| 页面/能力 | 源码 | 数据来源 |
| --- | --- | --- |
| 今日看板 /dashboard | src/features/dashboard/dashboard.tsx | /me/dashboard、档案与饮水/体重接口 |
| 7/30天大屏 /overview | src/features/overview/overview.tsx | /me/health/overview |
| 健康档案面板 | src/features/health/health-profile-panel.tsx | /me/health-profile；今日和“我的”共用 |
| 饮水/体重录入与历史 | src/features/health/record-panel.tsx | water-records / weight-records |
| M02接口适配 | src/features/health/runtime.ts、hooks.ts | 复用M01统一客户端和缓存失效 |

M02没有独立运营管理后台；本轮不向 qingyang-health-admin 添加页面。已有M01账号/通知、“我的”组合页面和M03真实饮食能力保留，不用旧独立交付包整页覆盖。

## 启动与依赖

```sh
npm ci
npm run dev
```

打开 http://127.0.0.1:3001 。前端通过同站 `/api/v1` 代理后端，服务端变量 API_INTERNAL_URL 默认 `http://127.0.0.1:3002`。独立克隆的后端在另一个目录启动，不要求放在前端server目录。

后端需完成MySQL、Redis、SMTP与认证密钥配置，执行迁移并运行 `npm run dev` 和 `npm run worker`。具体见 [后端M02交付说明](https://github.com/guojunyu12/qingyang-health-backend/blob/codex/m02-handoff-update/docs/HANDOFF-M02.md)、[接口调用说明](https://github.com/guojunyu12/qingyang-health-backend/blob/codex/m02-handoff-update/docs/M02/API_GUIDE.md)、[数据库连接说明](https://github.com/guojunyu12/qingyang-health-backend/blob/codex/m02-handoff-update/docs/M02/DATABASE.md)。

正式会话使用邮箱登录，Cookie为HttpOnly；复用 `src/lib/api/client.ts` 自动获取CSRF、刷新会话，所有写操作带稳定的幂等key。不要恢复独立联调版的A/B账号、/dev/session、4002端口或 NEXT_PUBLIC_M02_DEV_API。

## 对外组件与统计约定

- M05在“我的”组合HealthProfilePanel，并保留M01 AccountSummary和通知/退出；不另存健康档案或currentWeight。
- 健康写入成功调用统一invalidateHealth，跨页同步刷新；切换账号清理旧账号缓存和过期请求。
- 看板仅展示当前用户的真实健康记录。跨模块能力以availability为准，未知为null并显示“—”；缺少积分端口时rewardsAvailable=false，不承诺补发。
- 当前契约QY-MYSQL-1.1.0 / V004；公共类型维护源在后端，本仓库 contracts/shared_types.ts 为同步快照。未接入模块和外部供应商按实际配置单独验收。

## 本轮交付边界

本轮补齐接入文档，后端M02 OpenAPI修正Cookie名称、全部写操作幂等头和动态出生年份说明；保留已整合业务源码，不引入旧测试装配、不改数据库迁移。此前M02本地验收记录见 [整合完成与测试说明](../integration/M02_整合完成与测试说明.md)。

本机前端登录页可打开，数据库、Redis及任务进程已准备；SMTP尚缺，后端普通API未启动，真实登录和本轮完整业务流程未验收。历史验收和本轮检查分别记录，不将页面可见视为全栈上线。
