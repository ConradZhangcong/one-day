# 固定重复事项技术设计

## 设计目标

- 用一个纯领域 projector 生成预览、范围内虚拟 occurrence 和处理后的下一 occurrence，避免各页面重复计算规则。
- 保持“系列 + 一个物化的活跃实例 + 只读未来投影 + 历史记录”的既定模型，不为每个未来日期写数据库。
- 所有系列状态变更在单个 Dexie 事务内完成，并在提交后统一刷新提醒调度。
- 保持当前 shadcn/Base UI/Tailwind 界面风格；快捷新增默认路径不增加操作成本。

## 非目标

- 不支持 RFC RRULE、按完成时间滚动、已有普通事项转系列或“本次及以后”。
- 不允许操作未来虚拟 occurrence，也不实现拖拽改期。
- 不实现永久删除系列及历史；停止只归档系列并保留历史。
- 不改变数据库 schema 或 occurrence key 编码，除非实施时现有索引被证实无法满足正确性要求。

## 现有边界与改动方向

现有 `RecurrenceSeries`、`OccurrenceRecord`、`FixedRecurrenceRule`、稳定 occurrence key、Dexie repository 和提醒 owner 类型继续沿用。新增代码遵守以下依赖方向：

```text
React 表单/详情
      │ command / query
      ▼
RecurrenceService ───────► UnitOfWork / repositories
      │
      ├──► recurrence projector（纯函数）
      ├──► schedule projector（纯函数）
      └──► reminder reconciliation（事务提交后）

OccurrenceQueryService ──► 同一 projector ──► Todo / Recovery / Calendar
```

组件不访问 Dexie，不计算重复日期；日历、列表和恢复页不各自实现规则。

## 领域投影器

在 `src/domain/recurrence/` 增加纯函数模块，公开最小契约：

```ts
interface ProjectedOccurrenceIdentity {
  occurrenceKey: OccurrenceKey;
  originalAnchor: ScheduledPoint;
  ordinal: number; // 当前 revision 内从 1 开始，用于 COUNT
}

projectOccurrenceRange(input: {
  seriesId: string;
  revision: number;
  anchor: ScheduledPoint;
  rule: FixedRecurrenceRule;
  rangeStart?: ScheduledPoint;
  rangeEnd?: ScheduledPoint;
  limit: number;
}): ProjectedOccurrenceIdentity[];

nextOccurrenceAfter(input: {
  series: RecurrenceSeries;
  after: ScheduledPoint;
}): ProjectedOccurrenceIdentity | undefined;
```

实现约束：

- 锚点永远是 occurrence 序列第 1 项，COUNT 从该项开始计数；范围起点只过滤结果，不能重置相位或计数。
- `rangeStart` 包含、`rangeEnd` 排除；`nextOccurrenceAfter` 严格大于阈值。
- daily 按本地日历天推进；weekly 以 ISO 周一为周起点并按 weekday 升序；monthly 的 `sameDay` 遇无效日期跳月，`lastDay` 取当月最后一天；yearly 的 2 月 29 日在非闰年跳年。
- weekly 表单和 decoder 要求首次锚点的 weekday 包含在所选 weekdays 中，保证锚点确实是序列第 1 项。
- `end.date` 包含当天；`end.count` 限制当前 revision 的总 ordinal。
- timed occurrence 只改本地日期，保留墙上时间；转换成 Instant 比较“现在”时使用应用时区与 Temporal `compatible`。
- 所有公开展开必须带 `limit`，应用层另外限制可查询范围，避免 never 规则无限展开。

把现有提醒模块内的日期平移逻辑提升为通用 `projectOccurrenceSchedule(series, originalAnchor, overrides?)`。它保留模板锚点到计划/截止的本地日历天偏移以及各自墙上时间；`projectActiveOccurrenceSchedule` 改为薄包装，继续校验系列和实例确为当前活跃项。

## 应用服务与事务

新增 `RecurrenceService`，依赖 `UnitOfWork`、`now`、`createId`、时区探测和 `onScheduleChanged`。公开用例：

- `preview(draft, limit = 3)`：解码与验证输入，调用生产 projector，不写数据库。
- `createSeries(draft)`：解析标签、清单和长期目标，校验计划/截止；确定 planned 优先的锚点；写入 revision 1 系列和第一个 pending occurrence。
- `completeOccurrence` / `skipOccurrence`：只接受 `activeOccurrenceKey`；保存模板快照和审计 Instant；以 `max(originalAnchor, now)` 为严格阈值寻找下一项，创建新的 pending 或令系列 `ended`。
- `rescheduleOccurrence`：只写当前 pending record 的计划/截止 override，并校验覆盖后的时间顺序；不改变 original anchor、key 或规则相位。
- `updateSeries`：显式 entire-series 命令；删除旧 pending、revision + 1、替换模板与规则，从当前时刻之后物化新 revision 第一项，旧完成/跳过记录不变。
- `pauseSeries` / `resumeSeries`：只切换 active/paused，保留 active key 和 record；暂停数据从查询及提醒隐藏。
- `stopSeries`：删除当前 pending，清空 active key，状态置 archived；历史和系列提醒记录保留但不调度。

所有读取—校验—多表写入在一次 `unitOfWork.write` 内完成。服务返回成功后才调用 `onScheduleChanged`，保证提醒运行时看见已提交状态。不存在系列、key 不属于当前 revision、未来虚拟 key、已处理或状态不允许时，返回稳定领域错误码。

### 处理后跳过漏期

全天 occurrence 用应用时区下的今日 `LocalDate` 比较；timed occurrence 把本地墙上时间按 `compatible` 解释成 Instant。完成或跳过时，下一项必须严格晚于当前 original anchor，且严格晚于现在对应的本地阈值；因此连续漏做只保留一条历史，不补建中间 pending。

若有限规则已经没有合法后继，事务内把系列设为 `ended` 并清除 active key。

### 整个系列编辑

用户确认后，旧 pending record 被移除而不伪装为完成/跳过。新模板锚点是新 revision 的 occurrence 1；如果该锚点已过去，projector 按原相位找到第一个未来项。COUNT 从新 revision 锚点重新计算。旧 revision 的 completed/skipped record 及其 template snapshot 保留。

## 统一 occurrence 查询

新增 `OccurrenceQueryService` 作为跨页面读模型，输出统一的 `TaskOccurrenceView`：

```ts
interface TaskOccurrenceView {
  key: string;
  ownerKind: 'task' | 'occurrence';
  ownerId: string;
  seriesId?: string;
  title: string;
  plannedAt: SchedulePoint;
  deadlineAt: SchedulePoint;
  state: 'pending' | 'completed' | 'skipped';
  readonly: boolean;
  virtual: boolean;
  listId: string;
  tagIds: string[];
  goalId?: string;
  priority: Priority;
  updatedAt?: Instant;
}
```

查询规则：

- 普通任务直接映射。
- active 系列合并唯一物化 pending record 和 override，`readonly=false`。
- active 系列在请求范围内继续虚拟展开后续项，跳过与 active key 相同的项，`readonly=true`、`virtual=true`。
- paused/archived/ended 不产生待处理投影；completed/skipped 历史由 review/已完成查询按 record 与 snapshot 映射。
- 范围查询使用 `[rangeStart, rangeEnd)` 且有显式最大跨度/结果上限；稳定 key 用于 React 与日历。

`CalendarService` 改为适配这个查询结果，不再直接读 occurrence 表。`TodoService.snapshot` 与 `RecoveryService` 接入同一读模型，使今天、即将到来、恢复区和日历对当前 occurrence 的计划/截止及状态一致。Todo 的 `today` 使用单日范围，`upcoming` 使用与产品导航一致的有限展望窗口并显示窗口说明/继续入口，禁止为 never 规则请求无界未来。普通任务命令仍留在 `TodoService`，重复命令统一转发到 `RecurrenceService`。

提醒仍只调度系列的当前物化 active occurrence；改用通用 schedule projector。paused/ended/archived 或不匹配 active key 的记录不生成 candidate。

## UI 设计

### 快捷新增

从 `TodoPage` 抽出 `QuickAdd` 和 `RecurrenceFields`：

- 折叠时保持现有普通任务流程。
- 展开“重复”后显示频率、间隔、周几/月模式、结束条件和未来三次预览，并将主按钮语义改为“创建重复事项”。
- 周规则默认选首次发生日对应的 weekday；月规则默认 `sameDay`。
- 没有计划/截止时，展开后要求选择首次发生日期并写入 planned。
- 预览展示来自 `RecurrenceService.preview`，空结果或无效组合阻止保存；失败保留输入。

使用现有 Button/Input/Popover/Dialog/Drawer/Checkbox 等 shadcn primitive；若缺少 `Collapsible` 或单选 primitive，只按项目现有生成方式补齐本地组件，不引入 Ant Design。

### occurrence 与系列操作

- 列表和日历打开 active occurrence 时使用 `OccurrenceDetailsDrawer`，提供完成、跳过和“仅本次改期”。
- 未来虚拟项打开只读详情，展示“未来只读”，只允许进入“编辑整个系列”。
- 整个系列编辑在确认对话框中明确“替换当前待处理实例、保留既有历史、重算未来”。
- active 项可暂停或停止整个系列；paused 系列的恢复入口放在系列管理界面，而不是隐藏后无处恢复。
- 所有按钮与字段有作用域文字，不只依赖颜色或图标表达。

## 数据与迁移

现有 Dexie v2 已包含系列与 occurrence 表及所需主索引，预计不升 schema 版本。实现前通过 repository/事务测试验证：

- 一个 active/paused 系列只能关联一个 pending active key。
- series 更新和 occurrence 写入原子提交。
- 停止/整个系列编辑只删除旧 pending，不影响历史。

若查询性能需要新索引，必须先补 migration fixture，再提升数据库版本；不能静默修改现有 schema 声明。

## 错误与边界

- projector 对 malformed 规则、反向范围、非正 limit 和保护上限返回领域错误，不做容错猜测。
- 表单展示可行动的中文错误；应用服务保留稳定 error code，组件不解析英文 message。
- 同时含 planned/deadline 时复用 `assertValidSchedulePair`；仅本次 override 先投影未覆盖字段再整体校验。
- DST gap 允许 Temporal compatible 前移，并沿用现有 adjusted 提示能力；DST overlap 选 compatible 的较早偏移。
- 查询和预览设置硬上限并有单元测试，防止 never + 大区间阻塞页面。

## 测试策略

1. 领域表驱动测试：四种频率、interval、ISO 周、多 weekday、sameDay/lastDay、29/30/31、闰日、date/count/never、范围分片稳定、occurrence key、上限。
2. 时区测试：Asia/Shanghai 与 DST gap/overlap；planned/deadline 本地关系不漂移。
3. 应用测试：创建、完成、跳过、漏期推进、自然结束、仅本次改期、暂停/恢复/停止、whole-series revision、错误 key 与提醒回调。
4. Dexie 事务测试：系列与 active record 原子性、失败回滚、历史保留；无 schema 变更则验证 v2 fixture 可直接使用。
5. 查询一致性测试：同一范围在 Todo、Recovery、Calendar 输出相同 key/schedule/readonly；范围分片合并等于整段查询。
6. UI 测试：折叠默认普通任务、展开创建系列、三次预览、作用域确认、未来只读、键盘与移动布局。
7. 全量门禁：format、lint、typecheck、Vitest、build；关键流程再做浏览器手工验收。

## 风险与控制

| 风险 | 控制 |
|---|---|
| COUNT 因范围起点不同而漂移 | ordinal 从 revision 锚点计算；加入分片等价测试 |
| 无限规则导致大循环 | 所有 projector 调用强制 limit 与应用范围上限 |
| DST/月底产生错误日期 | 只用 Temporal 日历运算，按规则跳过无效日并做边界夹具 |
| 多服务投影不一致 | 只导出一个 projector 和一个 occurrence 查询服务 |
| 事务成功但提醒仍是旧计划 | 提交后统一触发 reminder reconciliation |
| 系列编辑误伤历史 | 只移除 pending；completed/skipped 由测试锁定不可删除 |
