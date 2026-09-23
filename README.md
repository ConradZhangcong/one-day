# One Day

One Day 是一款按账号保存并跨设备同步的个人待办与日历 Web/PWA。它用于快速记录任务、区分计划时间与截止时间、处理错过计划和逾期事项，并在浏览器允许执行时提供应用内或系统提醒。

当前分支已完成工程地基、基础待办闭环、恢复/回顾、运行期提醒、固定重复事项、多维日历、长期任务、版本化 JSON 备份与原子整库恢复，以及 PWA 发布加固。自动化证据与正式发布前的 Android/iOS 真机门禁见 [发布检查清单](docs/release-checklist.md)。

普通和重复任务支持单层子任务清单：添加、编辑、勾选和删除多个子项，列表显示完成进度，子项没有独立时间。修改随任务保存并纳入账号数据和备份；重复任务支持仅本次修改与系列子项模板，每次完成状态独立、下次从未完成开始，历史保留。交互方案见 [原型](docs/prototype.html)。

## 技术栈

- React 19、TypeScript 6、Vite 8
- Base UI / shadcn、Tailwind CSS 4、React Router 8
- Node.js HTTP / SQLite（账号数据），Dexie 4 / IndexedDB（旧版数据导入）
- Temporal polyfill、Zod 4
- Vitest、React Testing Library、Playwright
- vite-plugin-pwa / Workbox

## 环境要求

- Node.js `>=24.14.0 <25`
- pnpm `>=11.16.0 <12`，项目声明版本为 `pnpm@11.16.0`

建议通过 Corepack 使用项目指定的 pnpm：

```bash
corepack enable
corepack prepare pnpm@11.16.0 --activate
```

## 安装与启动

```bash
# 安装锁文件中固定的依赖
pnpm install --frozen-lockfile

# 启动开发服务器
pnpm dev
```

开发服务器固定使用 [http://localhost:53028](http://localhost:53028)；如果端口已占用，启动会报错，不会自动切换端口。

## 生产构建与预览

```bash
pnpm build
pnpm preview
```

前端输出到 `dist/`，Node 服务输出到 `dist-server/`；不能仅部署静态文件。开发及预览命令已包含账号 API。

正式运行：

```bash
ONE_DAY_ORIGIN=https://todo.example.com pnpm start
```

服务默认监听 `127.0.0.1:53028`，由 HTTPS 反向代理转发；可用 `HOST`、`PORT` 修改监听地址。`ONE_DAY_ORIGIN` 必须与浏览器访问来源完全一致。数据默认存于 `data/one-day.sqlite`，可通过 `ONE_DAY_DATABASE` 指定持久卷路径。不要将数据库加入版本控制或部署到临时文件系统；备份 SQLite 时须连同 WAL 正确处理，建议停止服务后备份整个 `data/` 目录。

PWA manifest、Service Worker 和离线应用外壳只应以生产构建结果为准；安装能力通常需要 HTTPS 或 `localhost`。

## 质量检查

```bash
# 检查代码格式
pnpm format:check

# 自动格式化
pnpm format

# ESLint
pnpm lint

# TypeScript
pnpm typecheck

# 单元、组件和数据库测试（单次运行）
pnpm test:run

# 测试监听模式
pnpm test

# Playwright 端到端测试
pnpm test:e2e

# PWA 生产产物契约
pnpm test:pwa

# 大数据性能预算
pnpm test:performance
```

首次执行 Playwright 前可能需要安装浏览器：

```bash
pnpm exec playwright install
```

提交前建议至少运行：

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:run
pnpm test:pwa
pnpm test:e2e
pnpm test:performance
pnpm build
```

## 当前功能

- 账号注册、登录、退出、用户数据隔离、跨设备更新与旧数据导入
- 快速新增、编辑、完成、跳过、撤销完成和删除普通任务
- 系统收件箱、自定义一级清单、标签和四档优先级
- 全天或精确的计划时间与截止时间，并校验非法时间顺序
- 收件箱、今天、即将到来、已完成和自定义清单视图
- 文本、日期、清单、标签、优先级和状态筛选
- 错过计划与逾期合并的“待恢复”列表，逾期优先并保留具体状态
- 日/周只读回顾
- 基于计划或截止的提前提醒、全天计划默认时间和稍后提醒
- 显式时区变更确认、DST 时间解释提示
- 响应式布局、浅色/深色模式和 PWA 应用外壳
- 固定日/周/月/年重复、未来只读投影和系列生命周期管理
- 议程、日、周、月视图共享统一 occurrence 查询
- 完整 JSON 导出、导入预检摘要和失败自动回滚的整库恢复

## 数据与提醒说明

- 注册并登录后，任务、清单、重复事项、历史、目标、提醒和设置保存在服务端，按用户隔离。同一服务地址下的不同设备登录同一账号即可继续使用；可见页面每 15 秒及重新聚焦时检查更新。
- 首次登录检测到当前站点的旧版浏览器数据时，提示是否导入当前空账号；两种选择均保留原始本地数据。备份恢复和清空仅作用于当前账号，并影响其所有设备。
- 清除浏览器数据不会删除服务端账号数据；仍建议定期导出 JSON 备份，并由部署者备份服务端数据库。
- 登录及数据读写需要网络。离线外壳可打开，但不提供离线编辑队列；网络错误不会伪报保存成功。
- 密码使用随机盐 scrypt 派生值保存；登录会话为 HttpOnly / SameSite Cookie，有效期 7 天，HTTPS 部署启用 Secure。当前不含密码找回、邮件验证、第三方登录或服务端 Web Push。
- 系统通知权限只会在用户主动点击启用后请求；拒绝权限不影响待办和应用内提醒。
- 页面可见且浏览器允许执行时，应用会调度提醒；进入受限后台、设备挂起或完全关闭浏览器/PWA 后无法保证准时送达。
- 应用恢复运行时只补发过去 15 分钟内尚未送达的提醒，避免弹出过时通知。

## 目录结构

```text
src/
├── app/                 # 组合根、路由、全局 Provider 和样式
├── domain/              # 领域类型、Zod schema、时间/状态/重复投影
├── application/         # 用例、查询服务、仓储端口和事务编排
├── infrastructure/      # 账号仓储、旧版 Dexie 与浏览器通知适配器
├── features/            # 按产品能力组织的 React 页面和组件
└── main.tsx             # 浏览器入口

server/                  # HTTP 鉴权、SQLite 账号持久化和生产启动入口

tests/
├── server/              # 登录、会话失效、越权、跨设备与旧数据导入测试
├── domain/              # 纯领域测试
├── application/         # 用例与跨层行为测试
├── infrastructure/      # IndexedDB、事务和迁移测试
├── features/            # 组件交互测试
├── build/               # PWA 生产产物契约
├── e2e/                 # 跨浏览器、离线和发布质量流程
└── performance/         # 确定性大数据性能预算
```

依赖方向保持为：界面 → 应用用例 → 领域/仓储端口 → 基础设施适配器。React 组件不得直接读写 Dexie 表。

## 项目文档

- [开发变更同步约定](AGENT.md)：功能、页面、数据规则变更时需要联动更新的文件。
- [文档导航](docs/README.md)：需求、发布检查和原型入口。
- [产品需求文档](docs/需求文档.md)：当前功能规则、范围变更、实现限制与验收映射。
- [发布检查清单](docs/release-checklist.md)：自动化和真机发布门禁。
- [服务器部署文档](docs/部署文档.md)：HTTPS 反向代理、服务管理、SQLite 备份与更新步骤。

项目已移除 Trellis 工作流及相关配置，历史任务与规范可从 Git 历史查阅。

旧数据检测受浏览器同源规则限制：协议、域名或端口变更后，需要从原站点导出 JSON，再在新站点恢复；`localhost` 与 `127.0.0.1` 也是不同站点。

重复任务支持工作日快捷选择（周一至周五，不含节假日调休）与每周指定多天；长弹框的标题和操作区固定，提示消息可手动关闭。

任务现已统一：无计划和截止时间即长期任务，可暂停/恢复；设置时间后进入日期安排。旧目标自动按原 ID 合并并保留关联，旧 `/goals` 链接跳转 `/long-term`。卡片直接提供完成、跳过、撤销完成，编辑与删除为图标按钮。
