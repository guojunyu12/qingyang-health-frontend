# M01 本地开发环境

2026-10-19 已安装并验证：MySQL 8.4.11、Redis 8.10.2。采用 Homebrew；项目使用独立数据目录，不启用开机自动启动。

| 项目 | 本地值 |
| --- | --- |
| MySQL | 127.0.0.1:3307 |
| 开发库 | qingyang_dev_m01 |
| 应用用户 | qingyang_m01，仅本库 SELECT/INSERT/UPDATE/DELETE |
| Redis | 127.0.0.1:6380，密码认证 |
| 数据目录 | 项目下 `.local/`，已被 Git 忽略 |
| 服务端配置 | `.env.m01.local`，权限600，已被 Git 忽略 |
| SMTP | smtp.163.com:465，TLS，发件人「轻养健康」 |

数据库和 Redis 密码随机生成，不在本文公开。SMTP 授权码只保存在服务端私有配置。不得复制到 NEXT_PUBLIC_ 环境变量、浏览器或交付文档。

## 启停

在项目根目录执行：

```sh
python3 scripts/local-infra.py start
python3 scripts/local-infra.py status
python3 scripts/local-infra.py stop
```

独立实例不使用默认3306/6379端口，避免与其他项目争用。脚本不重置或删除数据。停机后数据保留；重新启动不重复运行基线。

## 数据库基线

已从 M01 工作包逐字提取 `db/migrations/V001__baseline.sql`，SHA-256：

`64ec33a66c813321d12a7bbc29eff4d3981d6d3f3eacf6fc1eb7f9265efd3c56`

已在全新的独立开发库执行成功，共44张业务表；没有导入演示账号、健康记录或320积分。基线仍保留原手机号字段，邮箱注册登录需要后续增量迁移，不能直接修改已发布 V001。

`python3 scripts/local-infra.py migrate` 仅适用于全新空库，非空库会拒绝执行。当前工具仅用于本地环境引导，`.local/baseline-applied.txt` 是本地执行记录，不能替代未来后端正式迁移历史或 `/meta/contract` 实现。

## 配置加载与当前范围

`.env.m01.local` 不会被 Next.js 自动作为标准环境文件加载；未来 M01 NestJS 服务须显式加载，或由服务端进程注入。前端仍使用原有演示实现。本次只完成本地基础服务与私有配置，不代表邮箱验证码接口、注册登录、邮件发送或前端联调已完成。

SMTP 检查仅验证 TLS 和账号认证，不发送测试邮件。系统 Python 默认 CA 路径缺失时，检查使用 `/etc/ssl/cert.pem`；不得关闭 TLS 校验。

## M01后续更新（2026-10-19）

认证与公共底座已实现，当前本地库已升级V004。后端运行时读取 `server/.env.local`；根目录 `.env.m01.local` 仅为最初本地基础服务引导配置，不会自动覆盖后端配置。实际启动、测试、待配置能力及线上SQL以 `server/docs/HANDOFF-M01.md`、`server/db/releases/建表与升级说明.md` 为准。
