# 第一版技术架构研究

> 研究日期：2026-08-13
>
> 范围：响应式、本地优先、无需账号的个人待办 Web/PWA。本文只服务第一版设计，不代表已经开始实现。

## 结论

建议从干净工作树重新搭建单页 PWA，不恢复旧原型代码。沿用旧原型中已验证过的 React、TypeScript、Vite、Dexie 思路，但升级到当前稳定版本，并重建时间、重复事项和测试架构。

推荐组合：

- React 19.2 稳定通道 + TypeScript。
- Vite 8 当前受支持稳定线，使用官方 React 插件。
- React Router 的客户端路由模式。
- Ant Design 6 用于表单、弹窗、菜单、日期时间输入和无障碍基础交互；业务视觉使用应用级设计令牌覆盖。
- FullCalendar React 7.0.2 用于议程、日、周、月基础日历；年度热力图单独实现。v7 的 Standard 视图已合并为 `@fullcalendar/react/daygrid`、`/timegrid`、`/list`、`/interaction` 子路径；不要安装仍停留在 6.1.21 的旧独立插件包与 v7 混用。全应用统一使用其 peer `temporal-polyfill` 提供 Temporal API，避免同时打包两套 polyfill。
- Dexie 4 / IndexedDB 作为本地唯一事实来源，界面通过 reactive query 订阅数据。
- Temporal polyfill 统一处理纯日期、本地墙上时间、时区和瞬时时刻。
- Zod 4 作为表单边界、数据库迁移边界和备份导入边界的唯一运行时解码器。
- `vite-plugin-pwa` + Workbox 生成应用清单和离线应用外壳。
- Vitest + React Testing Library + fake-indexeddb 做单元/组件/数据库测试，Playwright 做 Chromium、Firefox、WebKit 及移动视口端到端测试。

在创建项目时应重新核验并锁定当时最新稳定补丁版本；不采用 canary、beta 或实验 API。

## 仓库与历史证据

当前 `main` 分支没有产品源码、包清单或已选技术栈。主代理只读核验了 Git 历史提交 `42eff82`：

- 实际使用 React 18.3、TypeScript 5.5、Vite 5.3、Ant Design 6.2、Zustand 4.5、React Router 6.26、Dexie 3.2、Day.js、dnd-kit、React Quill、Recharts、Vitest 和 React Testing Library。
- 旧代码包含 `src/types/task.ts`、`src/utils/recurrenceUtils.ts`、`src/db/`、`src/stores/` 和月历组件。
- 日、周、年视图未完成；重复编辑器不完整；日历没有正确展开重复实例；没有真实测试套件。
- 提交 `99fad24` 主动重置了原型。因此历史代码只能提供反例和局部经验，不能作为恢复基线。

## 推荐架构

### 1. 分层与依赖方向

```text
页面/组件
  ↓ 只调用用例
应用用例（创建、完成、改期、恢复、查询范围）
  ↓ 只依赖领域接口
领域核心（时间值对象、重复展开、状态推导、校验）
  ↓
仓储接口 ─────→ Dexie/IndexedDB 实现
  ↓
投影适配器 ───→ FullCalendar / 列表 / 年度热力图
```

约束：

- React 组件不能直接读写 Dexie 表，也不能自行解析数据库记录。
- FullCalendar 只接收领域层产生的只读展示投影，不拥有任务或重复规则。
- 所有日期序列化、重复展开、逾期判断和备份解码只有一个权威实现。
- 数据库实体不要完整复制进 Zustand。数据库数据通过 live query 获取；Zustand 仅在确有必要时保存跨页面的临时 UI 状态。
- 搜索条件、日期范围和日历视图尽量放入 URL，以便刷新后恢复。

### 2. 前端框架与构建

React 适合本产品大量交互式列表、表单和日历投影。React 官方目前将 19.2 标记为最新稳定版本，并建议用户应用使用 Latest 稳定通道。Vite 官方提供 React + TypeScript 模板，Vite 8 已稳定发布并使用 Rolldown；构建过程仍需单独运行 TypeScript 类型检查，因为 Vite 只转译 TypeScript。

不需要 SSR 或 React Server Components：第一版无账号、无服务端数据和 SEO 页面，纯静态 SPA 更符合离线与部署边界。

### 3. UI 与日历

Ant Design 6 支持 React 18+、现代浏览器、CSS variables 和中文日期时间组件，可快速提供完整表单、弹窗、菜单、通知和键盘焦点基础。但要避免把领域数据类型绑定到 Day.js；DatePicker 返回值必须在表单适配层转换成领域时间字符串。

FullCalendar React 7 Standard：

- React 适配器支持 React 17–19。
- Standard 插件使用 MIT 许可。
- `list`、`timeGrid`、`dayGrid`、`multiMonth` 和 `interaction` 足以支撑议程、日、周、月以及基础交互。
- 年视图的目标是密度和完成热力图，不应直接套用普通日历，因此单独实现年度投影。
- 不使用 FullCalendar 自带 recurrence 或 RRule 插件作为事实来源；产品的“单活跃实例、虚拟未来实例、例外记录”超出纯日历事件规则的职责。

### 4. 本地持久化

Dexie 提供 IndexedDB 封装、事务和 reactive query，适合第一版本地唯一事实来源。数据库按 schema version 迁移，所有写操作进入应用用例并使用事务保证：

- 任务/系列与实例例外一起变更。
- 删除清单与任务迁回收件箱原子完成。
- 恢复备份要么全部成功，要么保留恢复前数据。

备份不建议直接把内部数据库原样暴露为长期产品格式。使用独立的版本化领域 JSON 包装：

```json
{
  "format": "one-day-backup",
  "version": 1,
  "exportedAt": "...Z",
  "timeZone": "Asia/Shanghai",
  "data": {}
}
```

导入先用 Zod 解码并迁移到当前领域版本，再在单个 Dexie 事务中执行“替换式恢复”。恢复前自动生成内存中的回滚快照；任何异常都回滚。第一版不做有冲突风险的合并式导入。

### 5. PWA 与提醒

`vite-plugin-pwa` 当前稳定版本为 Vite 提供 manifest 和 Workbox 集成。缓存策略：

- precache 构建生成的应用外壳、图标和必要字体。
- 导航使用离线 fallback。
- 用户任务不进入 Cache Storage，只进入 IndexedDB。
- 应用更新使用明确的“有新版本，重新加载”提示，避免 service worker 在编辑中强制刷新。

提醒调度：

- 应用处于前台或浏览器仍允许执行时维护下一批提醒计时器。
- 启动、从后台恢复、标签页重新可见、系统时钟或时区变化后统一 reconciliation：只补发过去 15 分钟内未送达的提醒并重算下一次；更早提醒不补发，任务仍按当前计划/截止状态出现在今天、即将到来或既有恢复视图。
- 页面可见且事件循环正常时以目标后 60 秒为交付容差；持久化 delivery key 使 focus、reload 和 reconciliation 不会重复送达同一调度版本。
- 只有用户主动启用时才请求通知权限。
- 进入受限后台、挂起或页面关闭后不依赖实验性的本地 Notification Trigger。MDN 明确说明非持久通知的生命期绑定页面；PWA 关闭后可靠推送通常需要服务端 Push API，这已被 PRD 延后。

### 6. 状态、搜索与投影

- 持久状态：Dexie。
- URL 状态：当前主视图、日期范围、清单/标签/优先级筛选、是否显示已完成。
- 临时状态：编辑抽屉、选择范围、表单草稿、键盘导航。
- 派生状态：今天、错过计划、逾期、年度密度、每日负载，均从仓储记录和当前时钟计算，禁止重复持久化。
- 搜索第一版可对规范化标题和备注做本地包含匹配；数据规模验证后再决定是否引入专用全文索引。

## 测试策略

### 单元测试

- 时间值对象的解析、序列化、比较和 DST 边界。
- 重复规则在日、周、月、年以及次数/截止日边界的展开。
- 单活跃实例推进、暂停、跳过、改期和系列编辑不变量。
- 计划错过与截止逾期的互斥展示规则。
- Zod 解码、备份版本迁移和非法输入拒绝。

### 数据库与应用用例测试

- 使用 fake-indexeddb 验证 Dexie 迁移与事务回滚。
- 删除清单时单次任务与重复系列模板原子迁回收件箱。
- 备份导出—清空—恢复的完整往返。
- 任意恢复失败不改变恢复前数据库。

### 组件与无障碍测试

- 用 React Testing Library 按用户可见标签与角色操作，不测试内部实现。
- 键盘完成快速新增、任务编辑、范围选择和重复规则确认。
- 状态同时使用文字/图标/形状，不只依赖颜色。

### E2E 与 PWA 测试

- Playwright 覆盖 Chromium、Firefox、WebKit和桌面/移动视口。
- 覆盖创建、完成、重复、跨视图一致性、清单删除、备份恢复。
- 用真实构建验证 manifest、service worker 注册、离线重启和升级提示。
- 通知能力按 feature detection 分支测试；不把平台不支持的行为计为失败。

## 主要风险与控制

| 风险 | 控制措施 |
|---|---|
| 日期在 UTC 转换后跨日 | 纯日期始终保存 ISO `YYYY-MM-DD`，不转换成 `Date` |
| 重复规则在不同视图不一致 | 所有视图调用同一个范围投影用例 |
| FullCalendar 规则和领域规则分叉 | 只传展开后的事件投影，不启用其 recurrence 作为事实来源 |
| 浏览器清除站点数据导致丢失 | 明确风险提示、版本化导出、可验证恢复 |
| PWA 关闭后提醒不可靠 | 产品内明确限制，后续再引入服务端 Web Push |
| Service worker 缓存旧代码 | 明确版本更新提示、自动化离线/升级回归 |
| 依赖版本继续变化 | 实施建项时核验兼容矩阵并锁定稳定补丁版本 |

## 官方资料

- [React 版本](https://react.dev/versions)
- [Vite 入门与浏览器支持](https://vite.dev/guide/)
- [Vite 8 发布说明](https://vite.dev/blog/announcing-vite8)
- [Ant Design 6 迁移与 React 支持](https://ant.design/docs/react/migration-v6-cn/)
- [FullCalendar React 组件](https://fullcalendar.io/docs/react)
- [FullCalendar 插件索引](https://fullcalendar.io/docs/plugin-index)
- [FullCalendar 许可](https://fullcalendar.io/license)
- [Dexie 官方文档](https://dexie.org/docs/Dexie.js)
- [Dexie 导出导入能力](https://dexie.org/docs/ExportImport/dexie-export-import)
- [Zod 4](https://zod.dev/)
- [MDN PWA 离线与后台运行](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation)
- [MDN Notifications API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API)
- [Playwright 浏览器矩阵](https://playwright.dev/docs/browsers)
