# 前端线上部署

更新：2026-10-21（Asia/Shanghai）。本次用户明确要求：暂时只发布前端页面，前后端代码分别提交 GitHub。

## 当前发布

- 正式地址：https://qingyang-health.vercel.app
- 登录页：https://qingyang-health.vercel.app/login
- Vercel项目：guo-4137/qingyang-health。
- 项目ID：prj_8Li4cfzDofvqlr46i6zr1H85KWFx。
- 部署ID：dpl_BLGcEACcNCr6QhMYyGy78qkzCf31。
- 固定部署地址：https://qingyang-health-18llltj8m-guo-4137.vercel.app（可能受平台保护，用户访问正式域名）。
- 发布来源前端提交：b5cfa8c；使用当前已测试的M01/M02/M03前端代码。
- 云端状态：Ready，已从生产候选promote到正式域名。

## 范围与使用边界

本次仅部署前端，不部署后端API、MySQL、Redis或Worker。生产环境尚无公网API_INTERNAL_URL，邮箱验证码发送、登录及真实健康/饮食业务不能在线使用；页面仍保留现有真实鉴权边界，没有新增测试身份或绕过登录。

这次不是旧localStorage交互演示版。HTTP页面路由能返回200不等于登录后的业务已完成上线。后续提供后端服务器、完成正式配置后，在Vercel设置服务端API_INTERNAL_URL并配套发布，才可验收全栈线上流程。M05、模型/地图密钥等既有前置条件仍按测试报告处理。

## GitHub代码

- 前端：https://github.com/guojunyu12/qingyang-health-frontend/tree/codex/integrate-m02
- 后端：https://github.com/guojunyu12/qingyang-health-backend/tree/codex/integrate-m02

两个仓库的codex/integrate-m02分支均已推送，包含M01/M02/M03实现和测试/合并规范；分支名称保留原名，不代表只有M02。不自动合并main或改写历史。前端根目录、后端server/是独立仓库。

## 发布与验证

部署包采用允许列表：package.json/锁文件、Next/TypeScript配置、src/、public/、contracts/，共56个源文件（平台实际源文件清单可能过滤非构建文件）。未上传.env、数据库、私有媒体、测试验证码、临时文件、后端目录、需求文档或本机配置。

先创建production候选并确认Ready，再promote到正式域名。CLI首次等待状态中断，随后inspect确认原部署成功；没有因此重复创建或误把状态查询失败当成构建失败。

匿名访问/login、/dashboard、/nutrition、/overview均返回200；/login包含邮箱表单。正式域名不要求Vercel平台登录。Chrome在390px与1440px下邮箱表单可见，无横向溢出、无pageerror。浏览器验证与构建以本次实测为准，不把无后端的页面发布当成业务验收。

Vercel连接器对该团队返回403，已使用同团队/同项目的现有CLI授权完成发布，无需修改其他项目权限。当前项目Node版本24.x，云端Next16.4.2构建Ready。

历史首次演示部署：2026-10-19，dpl_CxQwcsBtE1KZVRvcCbgL3VKd8y9s；如需回退应先评估与当前真实API前端的语义差异，不以演示数据代替真实服务。
