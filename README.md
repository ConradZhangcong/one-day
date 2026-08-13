# One Day

One Day 是一款本地优先、无需账号的个人待办与日历 Web/PWA。它用于快速记录任务、区分计划时间与截止时间、处理错过计划和逾期事项，并在浏览器允许执行时提供应用内或系统提醒。

当前分支已完成工程地基、基础待办闭环、恢复/回顾和运行期提醒。重复事项、多维日历和备份恢复仍在后续阶段开发中，详见 [实施计划](.trellis/tasks/08-12-todo-calendar-app/implement.md)。

## 技术栈

- React 19、TypeScript 6、Vite 8
- Ant Design 6、React Router 8
- Dexie 4 / IndexedDB
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

Vite 默认会在 [http://localhost:5173](http://localhost:5173) 启动应用；如果端口已占用，终端会显示实际地址。

## 生产构建与预览

```bash
pnpm build
pnpm preview
```

生产文件输出到 `dist/`。PWA manifest、Service Worker 和离线应用外壳只应以生产构建结果为准；安装能力通常需要 HTTPS 或 `localhost`。

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
pnpm build
```

## 当前功能

- 快速新增、编辑、完成、跳过、撤销完成和删除普通任务
- 系统收件箱、自定义一级清单、标签和四档优先级
- 全天或精确的计划时间与截止时间，并校验非法时间顺序
- 收件箱、今天、即将到来、已完成和自定义清单视图
- 文本、日期、清单、标签、优先级和状态筛选
- 错过计划与逾期的互斥恢复视图
- 日/周只读回顾
- 基于计划或截止的提前提醒、全天计划默认时间和稍后提醒
- 显式时区变更确认、DST 时间解释提示
- 响应式布局、浅色/深色模式和 PWA 应用外壳

## 数据与提醒说明

- 任务和设置仅保存在当前浏览器的 IndexedDB 中；当前版本没有账号或云同步。
- 清除站点数据、卸载浏览器/PWA 或设备损坏可能造成数据丢失。版本化备份恢复仍在开发中。
- 系统通知权限只会在用户主动点击启用后请求；拒绝权限不影响待办和应用内提醒。
- 页面可见且浏览器允许执行时，应用会调度提醒；进入受限后台、设备挂起或完全关闭浏览器/PWA 后无法保证准时送达。
- 应用恢复运行时只补发过去 15 分钟内尚未送达的提醒，避免弹出过时通知。

## 目录结构

```text
src/
├── app/                 # 组合根、路由、全局 Provider 和样式
├── domain/              # 领域类型、Zod schema、时间/状态/重复投影
├── application/         # 用例、查询服务、仓储端口和事务编排
├── infrastructure/      # Dexie 与浏览器通知适配器
├── features/            # 按产品能力组织的 React 页面和组件
└── main.tsx             # 浏览器入口

tests/
├── domain/              # 纯领域测试
├── application/         # 用例与跨层行为测试
├── infrastructure/      # IndexedDB、事务和迁移测试
└── features/            # 组件交互测试
```

依赖方向保持为：界面 → 应用用例 → 领域/仓储端口 → 基础设施适配器。React 组件不得直接读写 Dexie 表。

## Trellis 开发流程

项目使用 Trellis 管理需求、技术设计、实施阶段和项目规范：

- `.trellis/tasks/08-12-todo-calendar-app/`：当前 MVP 的 PRD、设计、研究和实施计划
- `.trellis/spec/`：项目实际编码与检查规范
- `.trellis/workflow.md`：规划、实施、检查和收尾流程

开始修改前请阅读根目录 `AGENTS.md` 以及本次变更涉及层的 `.trellis/spec/*/index.md`。
