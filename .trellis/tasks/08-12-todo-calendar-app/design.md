# 个人待办日历应用 — 第一版技术设计

## 设计目标

- 交付响应式、可安装、核心功能离线可用的 Web/PWA。
- 保证列表、议程、日、周、月、年视图共享同一任务与重复事项事实来源。
- 从数据模型上区分计划执行时间、截止时间、纯日期、本地墙上时间和真实瞬时点。
- 支持固定日历周期、单活跃实例、未来虚拟投影和单次例外，不为未来云同步或习惯统计埋下不可逆结构。
- 无需账号或应用后端；本地数据库是第一版唯一事实来源。
- 让用户能安全导出和恢复数据，并明确受限后台、挂起和 PWA 关闭后的提醒限制。

## 非目标

- 不设计账号、服务端 API、云同步或冲突解决。
- 不实现团队协作、项目层级、习惯、日记、AI、外部日历同步或原生端。
- 不暴露完整 RFC 5545 编辑器，也不让 FullCalendar 或 UI 日期库拥有业务重复语义。
- 不保证 PWA 被关闭后仍能在所有平台准时提醒。

## 技术选型

实施开始时重新核验并锁定最新稳定补丁版本，预期技术线如下：

| 领域 | 选择 | 原因 |
|---|---|---|
| UI 框架 | React 19.2 稳定线 + TypeScript | 交互式列表、表单和日历生态成熟 |
| 构建 | Vite 8 稳定受支持线 + pnpm | 静态 SPA、快速开发和 PWA 插件生态 |
| 路由 | React Router 客户端模式 | URL 保存主视图、日期范围和筛选 |
| 通用组件 | Ant Design 6 | 中文日期时间输入、表单、弹窗和现代浏览器支持 |
| 日历 | FullCalendar React 7.0.2 | MIT 许可；标准 list/timeGrid/dayGrid/interaction 从 `@fullcalendar/react` 子路径导入，不混装仍停留在 6.x 的旧独立插件包 |
| 本地数据库 | Dexie 4 / IndexedDB | 事务、迁移、索引和 reactive query |
| 时间 | Temporal 兼容 polyfill | PlainDate、PlainDateTime、ZonedDateTime、Instant 语义清晰 |
| 运行时校验 | Zod 4 | 表单、持久化迁移和备份导入共用边界校验 |
| PWA | vite-plugin-pwa + Workbox | manifest、应用外壳预缓存和更新流程 |
| 测试 | Vitest、RTL、fake-indexeddb、Playwright | 领域、组件、数据库、浏览器和离线全覆盖 |

不采用 SSR/RSC：第一版无服务端数据和 SEO 页面，静态 SPA 更符合离线、隐私和部署边界。

## 总体架构

```text
┌─────────────────────────────────────────────────────────────┐
│ 路由与页面：首页/清单/恢复/日历/已完成/设置                 │
├─────────────────────────────────────────────────────────────┤
│ 展示组件：任务卡、快速新增、任务详情、重复编辑、日历适配器   │
├─────────────────────────────────────────────────────────────┤
│ 应用用例：创建、编辑、完成、跳过、改期、查询、恢复、备份     │
├─────────────────────────────────────────────────────────────┤
│ 领域核心：时间值、状态推导、重复展开、实例推进、业务校验     │
├─────────────────────────────────────────────────────────────┤
│ 仓储接口与投影接口                                           │
├───────────────────────────┬─────────────────────────────────┤
│ Dexie / IndexedDB         │ Reminder runtime / PWA worker   │
└───────────────────────────┴─────────────────────────────────┘
```

依赖规则：外层可以依赖内层；领域层不依赖 React、Dexie、Ant Design 或 FullCalendar。

## 代码边界建议

```text
src/
  app/                 # 启动、路由、全局 provider、布局
  domain/
    task/              # 单次任务、状态、清单、标签、优先级
    schedule/          # 时间值对象、比较、时区
    recurrence/        # 规则、展开、实例推进、例外
    reminder/          # 提醒契约与派生触发时间
    backup/            # 领域备份格式与版本迁移
  application/         # 用例和查询投影
  infrastructure/
    db/                # Dexie schema、迁移、repository 实现
    pwa/               # SW 注册、更新、离线状态
    notifications/     # 页面运行期调度与权限适配
  features/            # 按用户能力组织页面和交互
  shared/              # 无业务语义的 UI、工具、测试设施
```

禁止：组件直接写 Dexie、多个视图分别计算重复规则、各模块自行把字符串转 `Date`、UI 层维护另一份持久任务列表。

## 领域模型

### 时间值

持久化使用字符串，不保存 JavaScript `Date`：

```ts
type LocalDate = string;       // YYYY-MM-DD
type LocalDateTime = string;   // YYYY-MM-DDTHH:mm
type InstantString = string;   // ISO UTC ...Z
type TimeZoneId = string;      // IANA

type SchedulePoint =
  | { kind: 'none' }
  | { kind: 'allDay'; date: LocalDate }
  | { kind: 'timed'; localDateTime: LocalDateTime };
```

- 用户级设置保存唯一 IANA 时区。
- 首次启动从浏览器检测并保存初始时区；后续检测到设备时区变化时只提示，不自动改写用户设置。
- 全天日期永不转换成 UTC。
- 精确计划和截止以本地墙上时间保存，需要比较/提醒时结合用户时区解析成 Instant。
- 创建、更新、完成、跳过等审计时间保存 Instant。
- 应用不跟随设备时区静默改变；用户主动修改应用时区时确认并保持墙上时间不变，重算提醒瞬时点。

### 单次任务

```ts
interface SingleTask {
  id: string;
  title: string;
  notes: string;
  listId: string;
  tagIds: string[];
  priority: 'none' | 'low' | 'medium' | 'high';
  plannedAt: SchedulePoint;
  deadlineAt: SchedulePoint;
  state: 'pending' | 'completed' | 'skipped';
  completedAt?: InstantString;
  skippedAt?: InstantString;
  createdAt: InstantString;
  updatedAt: InstantString;
}
```

`missedPlan` 和 `overdue` 是查询时派生状态，不写入生命周期字段。若两者同时成立，只进入“已逾期”主恢复分组，详情仍显示计划已错过，避免同一任务重复出现。全天计划在其本地日期结束后才进入 `missedPlan`；全天截止在其本地日期结束后才进入 `overdue`。精确时间在对应 Instant 经过后进入相应派生状态。

### 重复系列

重复系列保存任务模板、固定规则、状态和唯一活跃实例键。模板不混入实体 id、生命周期或审计字段：

```ts
interface TaskTemplate {
  title: string;
  notes: string;
  listId: string;
  tagIds: string[];
  priority: 'none' | 'low' | 'medium' | 'high';
  plannedAt: SchedulePoint;
  deadlineAt: SchedulePoint;
}

interface TaskSnapshot extends TaskTemplate {
  capturedAt: InstantString;
}

interface RecurrenceSeries {
  id: string;
  template: TaskTemplate;
  anchor: 'planned' | 'deadline';
  rule: FixedRecurrenceRule;
  status: 'active' | 'paused' | 'ended' | 'archived';
  activeOccurrenceKey?: string;
  revision: number;
  createdAt: InstantString;
  updatedAt: InstantString;
}
```

规则：

- 有计划时间时以计划时间为重复锚点；否则以截止时间为锚点。
- 两者都没有时，重复编辑器必须把用户选择的首次发生日期写入 `template.plannedAt`（默认 `allDay`，可选 `timed`）并设 `anchor = 'planned'`，不创建第三种独立日期。
- 每个 revision 的系列起始锚点直接从 `template[anchor]` 读取且不得为 `none`，不重复持久化第二份 `dtStart`，避免二者漂移。
- 同时有计划和截止时，每次投影保持二者的本地日历/墙上时间关系。
- 支持 daily/weekly/monthly/yearly、interval、weekday、sameDay/lastDay、never/inclusive date/count。
- `active`/`paused` 系列恰有一个 `activeOccurrenceKey`；有限规则耗尽后进入 `ended`，用户主动停止后进入 `archived`，这两种终态都不再保留活跃键。

### 发生实例与例外

未来未交互实例按范围虚拟生成且只读。只有当前活跃、完成、跳过或当前实例单次改期时写入 `OccurrenceRecord`：

```ts
interface OccurrenceRecord {
  occurrenceKey: string; // seriesId + revision + original anchor
  seriesId: string;
  originalAnchor: Exclude<SchedulePoint, { kind: 'none' }>;
  overridePlannedAt?: SchedulePoint;
  overrideDeadlineAt?: SchedulePoint;
  state: 'pending' | 'completed' | 'skipped';
  completedAt?: InstantString;
  skippedAt?: InstantString;
  templateSnapshot?: TaskSnapshot;
}
```

单次改期始终引用原始 occurrence key，不能用新日期改变身份。未来虚拟实例不能提前完成、跳过或建立单次覆盖；用户必须等待其成为活跃实例，或编辑整个系列。整个系列修改提升 revision，只重算未来投影并保留旧历史。第一版不支持“本次及以后”；后续通过拆分系列实现。

### 清单、标签和提醒

- `List`：系统收件箱 + 用户一级清单，包含排序和归档状态。
- `Tag`：唯一 id、名称、颜色；任务保存多个 tag id。
- `Reminder`：`ownerKind` 为 `task | series`。单次任务提醒引用 task；重复提醒保存为系列模板配置，调度时根据当前活跃 occurrence 派生 owner key 和触发时间。共同保存 `planned | deadline`、偏移分钟、调度 revision、上次已送达 delivery key 及可选 snoozedUntil，不复制计划/截止时间。
- 删除清单在事务内将任务/系列模板移回收件箱，再归档或删除清单。

## IndexedDB 设计

建议 Dexie 表：

| 表 | 关键索引 |
|---|---|
| `singleTasks` | id、state、listId、planned local date、deadline local date、tagIds* |
| `recurrenceSeries` | id、status、listId、activeOccurrenceKey |
| `occurrenceRecords` | occurrenceKey、seriesId、state、original local date |
| `lists` | id、order、archived |
| `tags` | id、normalizedName |
| `reminders` | id、ownerId、target |
| `settings` | key |
| `meta` | key（schema/backup metadata） |

索引字段由规范化投影器生成；领域实体保持清晰的联合类型。所有跨表写入使用 Dexie 事务。

## 核心用例与数据流

### 快速新增

1. 表单适配层把输入转为领域命令。
2. Zod 校验标题和可选时间。
3. 领域校验计划/截止顺序。
4. 无清单时使用系统收件箱。
5. 仓储事务写入，live query 推动所有视图更新。

### 范围查询

1. 页面提交 `[rangeStart, rangeEnd)`、筛选和当前时钟。
2. 查询单次任务和相关系列。
3. 统一 recurrence projector 展开虚拟实例并合并 occurrence records。
4. 统一 status projector 标记 today/missedPlan/overdue/completed。
5. 产生稳定 `TaskOccurrenceView`，再由列表、FullCalendar 或年度热力图格式化。

### 完成重复实例

在一个事务中：

1. 把当前 occurrence record 标为完成并保存快照/完成 Instant。
2. 从固定规则寻找严格晚于当前实例 `originalAnchor` 的后继，再跳过所有不晚于“现在”的候选；等价于寻找严格晚于 `max(originalAnchor, now)` 的下一合法发生项。全天比较本地日期，精确时间按应用时区解析后比较。
3. 有下一次时物化新的唯一 pending 活跃实例并更新 `series.activeOccurrenceKey`。
4. 没有下一次时把系列设为 `ended` 并清空活跃键。

### 编辑重复事项

- 仅本次：创建/更新 occurrence override，规则不变。
- “仅本次”第一版只覆盖计划和截止；标题、备注、清单、标签和优先级属于系列模板，只能修改整个系列。
- 整个系列：确认摘要需说明当前待处理实例会被替换；删除旧 pending 记录、提升 revision、替换模板和规则，从新锚点物化不早于当前时刻/日期的首个合法实例。新 revision 重新计算 COUNT，既有完成/跳过历史不变。
- 仅当前活跃实例允许走“仅本次”；未来重复投影只读，系列范围修改必须二次确认。
- 暂停系列时从待办、日历和提醒查询中排除它，但保留活跃记录和历史；恢复时同一活跃实例重新出现，若时间已过则进入恢复区。
- 停止整个系列时删除当前 pending 记录、清空活跃键并归档，历史记录保留在已完成视图；当前实例不伪记为完成/跳过，用户可再明确永久删除历史。

### 备份恢复

第一版备份格式：

```json
{
  "format": "one-day-backup",
  "version": 1,
  "exportedAt": "2026-08-13T00:00:00Z",
  "timeZone": "Asia/Shanghai",
  "data": {}
}
```

- 导出仅包含领域数据和必要设置，不包含缓存、临时 UI 或 service worker 状态。
- 导入先解析 JSON，再经版本路由和 Zod 完整校验。
- 第一版只做整库替换，不做合并。
- 写入前展示数量摘要并确认；在同一事务中清空/写入，异常全部回滚。
- 恢复成功后重新加载投影和提醒队列；失败保留原数据。

## 日期、重复与 DST 规则

- 每 N 周按当前 revision 的系列起始锚点所在周计算 interval，相符周内逐日匹配多个 weekday。
- 周界固定为 ISO 周 `[周一 00:00, 下周一 00:00)`，weekday 使用 1=Monday…7=Sunday；周视图第一版同样周一开周。
- COUNT 从当前 revision 的系列起始锚点起全系列计算，与查询起点无关。
- 结束日期包含当天。
- 固定 29/30/31 日遇到无效日期跳过；lastDay 单独计算。
- 2 月 29 日在非闰年跳过。
- 固定时间保持本地墙上时间；DST 缺口采用 Temporal compatible 顺延，重叠选择较早瞬时点，只生成一次。
- 规则预览和所有日历视图必须调用同一个 projector。

## UI 与交互设计

### 信息架构

- `/inbox`：收件箱。
- `/today`：当天计划、截止标记和恢复摘要。
- `/upcoming`：连续未来列表。
- `/recovery?kind=missed|overdue`：互斥恢复分组。
- `/lists/:listId`：自定义清单。
- `/completed`：完成/跳过历史及只读日/周汇总。
- `/calendar/:view`：agenda/day/week/month/year。
- `/settings`：时区、全天提醒、通知、备份、主题和数据风险说明。

### 响应式布局

- 桌面：固定侧栏 + 主内容 + 可选详情抽屉。
- 移动：底部主要导航 + 全屏详情 sheet；日历默认议程/日视图，仍可切换周/月/年。
- 全局快速新增始终一键可达，初始只显示标题和常用时间；其他字段展开后出现。

### 日历适配

- agenda：FullCalendar list 或自有连续列表。
- day/week：timeGrid + 单独全天区；无时长事项渲染成时间点。
- month：dayGrid，有限标签 + `+N`。
- year：自有 12 月密度/完成热力图和日期下钻。
- “计划负载”按本地日期统计待处理计划 occurrence 数量，“完成活动”按本地日期统计实际完成记录数量；各视图汇总与同筛选条件下的明细共用同一投影。
- 只有截止没有计划的任务作为 deadline marker，不伪造时间块。
- FullCalendar 回调转换成应用命令，不能直接修改其 event 对象后当作事实。

## PWA、离线与提醒

- precache 应用外壳、图标和必要字体；任务数据只在 IndexedDB。
- 导航离线 fallback 到应用壳。
- 新版本采用显式更新提示，不在用户编辑时强刷。
- 应用处于前台或浏览器仍允许执行时，提醒调度器保存下一批 timer；启动、focus、visibilitychange、休眠恢复和应用时区变化后统一 reconciliation。
- 页面可见且事件循环正常时，计时器不得早触发，目标后 60 秒是可测交付容差。
- delivery key 由 reminder id、调度 revision、解析后的触发 Instant 和 snooze revision 构成并持久化；先原子记录再展示，保证 focus、reload 和 reconciliation 至多送达一次。
- reconciliation 只对过去 15 分钟内的未送达提醒补发系统/应用内提醒；更早提醒不弹陈旧通知，任务仍按其当前计划/截止状态出现在今天、即将到来或既有恢复视图。
- 通知权限仅在用户主动启用提醒时请求；拒绝不影响核心功能。
- 进入受限后台、挂起或关闭后仅尽力提醒，不依赖实验性本地定时通知 API。

## 校验与错误处理

- Zod schema 是外部/持久化 unknown 数据进入领域的唯一入口。
- 业务冲突返回带 code 的领域错误，例如 `DEADLINE_BEFORE_PLAN`、`INVALID_RECURRENCE`、`BACKUP_VERSION_UNSUPPORTED`。
- UI 根据 code 显示中文提示，不解析异常字符串。
- 数据库写入错误必须回滚并保留用户表单输入。
- 全局错误边界不能吞掉错误；提供重试、导出诊断信息和安全返回入口。

## 兼容与迁移

- 第一版正式支持实施时当前稳定 Chrome、Edge、Firefox、Safari 的核心 Web 功能，并以 Chromium/WebKit 移动视口覆盖手机布局。
- PWA 安装和系统通知使用 feature detection；浏览器不提供的能力显示说明而非伪造成功。
- 发布前至少在真实 Android Chrome 和 iOS Safari/PWA 上手工验证安装、离线、恢复和通知权限流程。
- 每次 Dexie schema 与备份格式都独立版本化；迁移测试必须覆盖旧版本夹具。
- 不导入 Git 历史原型数据库；若未来需要迁移，另立任务并使用显式适配器。

## 隐私与安全

- 第一版不发送任务内容、标签或统计到远端。
- 不默认接入分析、错误上报或第三方 AI；若后续加入必须显式披露并获得选择。
- 备份文件可能含敏感信息，导出前提示用户妥善保存。
- Markdown/富文本不在第一版；备注按纯文本渲染，避免不必要的 XSS 面。
- service worker 只缓存同源必要资源，更新策略和缓存清理可审计。

## 发布与回滚

- 先发布可清除的内部预览构建，再发布第一版稳定构建。
- 数据迁移发布前必须用旧数据库夹具升级并导出/恢复验证。
- 应用代码可回滚到上一静态版本，但数据库迁移必须向前兼容；禁止依赖“降级数据库”。
- 破坏性迁移前先生成本地备份并提示用户；第一版应尽量只做可逆的增量迁移。

## 关键风险

| 风险 | 控制 |
|---|---|
| 日期跨时区漂移 | 领域值对象 + Temporal + 全天日期永不 UTC 化 |
| 重复范围查询相位漂移 | 每个 revision 固定系列起始锚点、全系列 COUNT、属性测试 |
| 多视图不一致 | 单一范围投影用例和稳定 occurrence key |
| 数据丢失 | 事务、版本化备份、恢复失败回滚和风险提示 |
| PWA 通知预期过高 | 功能检测、前台/允许执行时保证、受限后台与关闭后限制说明 |
| 依赖 UI 库锁定业务 | 适配层隔离 AntD、FullCalendar 和 Day.js 类型 |

## 研究依据

- [research/architecture.md](./research/architecture.md)
- [research/time-recurrence.md](./research/time-recurrence.md)
- [research/prd-review.md](./research/prd-review.md)
