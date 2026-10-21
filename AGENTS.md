<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 轻养项目：模块合并必读

在接收、适配或合并 M01–M06 模块前，必须依次读取：

1. [模块合并统一规范](docs/integration/模块合并规范.md)
2. [模块合并台账](docs/integration/模块合并台账.md)
3. [模块合并记录模板](docs/integration/模块合并记录模板.md)，以及本模块最近的实际合并记录。

按功能盘点当前实现与交付包，保留所有已合入并验收的能力。M01 邮箱账号/公共底座和 M02 档案、饮水、体重、看板是当前保护基线。页面或目录负责人不能覆盖其中其他模块的功能。

重复功能必须登记差异和确认来源；未确认时保留当前实现，只暂停对应替换，无冲突功能继续。共享入口、Provider、客户端、端口、Worker、公共契约及迁移由主整合窗口统一串行装配。不要整仓或整页覆盖，不还原其他窗口改动，不将整目录中的其他窗口文件混入提交。

每次重新核对实际前后端 HEAD 与最新台账；旧工作包、旧方案或交付者的自测不替代当前代码和本轮验收。前端根目录与 server/ 是两个独立 Git 仓库，分别交付。后端独立工作时读取其 AGENTS.md 和同版规范副本。

## 团队开发与提交入口

开发、审查与提交前还须读取 [团队开发与Git提交规范](docs/integration/团队开发与Git提交规范.md)，提交 PR 使用 [模块交付与PR说明模板](docs/integration/模块交付与PR说明模板.md)。主整合窗口指定实际开发基线并负责后续合并；模块成员不得默认从旧 main 开发或自行合 main/部署。代码格式、明确文件白名单、配套仓库 SHA、真实测试证据和迁移 CR 按该规范执行。

## 拉取代码与开工

收到同步/拉取/开工任务时，先读取 [Codex拉取代码与开工规范](docs/integration/Codex拉取代码与开工规范.md)。当前默认开发基线为各仓最新 origin/main；核实实际仓库和未提交改动后安全快进，保留其他窗口工作。仅拉取不自动授权安装、数据库迁移或重启；数据库和环境按任务授权另行核实。三个仓库分别更新，结果按文档模板报告，不自行合 main 或部署。
