# 固定重复事项实施计划

## 实施原则

- 先稳定纯领域规则，再实现事务命令，最后接入统一查询和 UI。
- 每个阶段同步补测试，不在末尾集中补正确性。
- 不修改 occurrence key 格式，不引入第二套重复算法，不实现 PRD 外能力。
- 当前任务在用户批准本规划后才从 `planning` 切换到 `in_progress`。

## Phase 0 — 开发前门禁

- [ ] 用户明确批准 PRD、设计和实施摘要。
- [ ] 运行 `task.py start` 并记录当前分支、base 与工作树状态。
- [ ] 使用 `trellis-before-dev` 加载前端、应用、领域与持久化规范。
- [ ] 确认上一阶段提交存在且工作树中的规划文件归属清晰。

## Phase 1 — 领域 projector 与时间投影

- [ ] 在 `src/domain/recurrence/` 实现统一范围展开和严格后继查询，所有入口强制 limit。
- [ ] 实现 daily/weekly/monthly/yearly、interval、ISO 周多 weekday、sameDay/lastDay。
- [ ] 实现 never、inclusive date 与从 revision 锚点计数的 count。
- [ ] 将 occurrence 的计划/截止平移抽为通用 schedule projector，并保留 active 包装函数。
- [ ] 补齐 domain exports 与稳定领域错误码。
- [ ] 表驱动覆盖范围分片、月底无效日、闰日、ISO 跨年、DST 和上限保护。

验证点：相同系列在预览、整段查询和分片查询中产生相同 occurrence key 与 schedule。

## Phase 2 — RecurrenceService 与原子事务

- [ ] 定义 recurrence draft/patch decoder，并复用清单、标签、目标及时间校验。
- [ ] 实现 `preview` 与 `createSeries`，只物化首个 pending occurrence。
- [ ] 实现 active occurrence 完成、跳过和仅本次计划/截止改期。
- [ ] 实现严格晚于 `max(originalAnchor, now)` 的推进与有限规则自然结束。
- [ ] 实现 pause、resume、stop；stop 只移除 pending 并保留历史。
- [ ] 实现 entire-series 更新：确认后的 revision + 1、替换 pending、保留历史并重算未来。
- [ ] 更新系列 owned reminder 的 schedule revision/无效 target 处理，并在事务提交后 reconcile。
- [ ] 为非法状态、错误 key、重复处理、未来虚拟 key 添加稳定错误与测试。
- [ ] 添加 fake-indexeddb 原子提交/回滚和历史保留测试。

验证点：任一失败不会留下无 active record 的 active series 或两个 pending active record。

## Phase 3 — 统一 TaskOccurrenceView 查询

- [ ] 新增 `OccurrenceQueryService` 和 `TaskOccurrenceView`，合并普通任务、active occurrence、未来虚拟 occurrence 与历史 snapshot。
- [ ] 为查询范围和结果数量设置显式上限。
- [ ] 改造 `CalendarService` 只适配统一查询，不直接展开或读取 occurrence 事实。
- [ ] 改造 `TodoService.snapshot`/列表 projector 以展示 active 与相关未来项；未来项只读。
- [ ] 改造 `RecoveryService`，让当前 occurrence 进入 today/missedPlan/overdue 与回顾统计。
- [ ] 保持 ReminderRuntime 只调度当前 active occurrence，并复用通用 schedule projector。
- [ ] 添加 Todo/Recovery/Calendar 同范围 key、schedule、状态和 readonly 一致性测试。

验证点：列表、恢复区、提醒、议程/日/周/月没有各自的重复日期计算。

## Phase 4 — 快捷创建与规则预览 UI

- [ ] 从 `TodoPage` 抽出 QuickAdd，保留默认普通事项交互。
- [ ] 用本地 shadcn primitive 实现可折叠 `RecurrenceFields`；缺失 primitive 按项目模式补齐。
- [ ] 支持频率、interval、weekday、monthMode、end kind/date/count 输入。
- [ ] 无计划/截止时要求首次发生时间并写入 planned；提供明确校验提示。
- [ ] 以 production projector 实时展示最多三次预览。
- [ ] 展开重复时提交 `createSeries`，折叠时仍提交 `createTask`；成功后清空相应状态，失败保留输入。
- [ ] 补 RTL 测试：默认普通、展开系列、预览、有限不足三次、错误保留与键盘操作。

验证点：用户无需先创建普通任务，且不会因默认表单增加额外步骤。

## Phase 5 — occurrence 详情与系列生命周期 UI

- [ ] 新增 `OccurrenceDetailsDrawer`，active 项支持完成、跳过和“仅本次改期”。
- [ ] 未来虚拟项显示“未来只读”，不渲染状态/改期命令。
- [ ] 新增系列编辑表单与“整个系列”影响确认，展示 pending 替换及历史保留说明。
- [ ] 提供暂停、恢复和停止入口；停止确认明确保留历史且不等于完成/跳过。
- [ ] 接通 Todo、Recovery、Calendar 的 occurrence 点击与刷新。
- [ ] 检查焦点返回、Escape、屏幕阅读器标签、移动抽屉和窄屏布局。
- [ ] 补组件/集成测试覆盖 scope 标签和 command 路由。

验证点：仅 active occurrence 可操作，未来虚拟项无法通过 UI 或应用命令绕过限制。

## Phase 6 — 收敛与质量门禁

- [ ] 对照 PRD 验收项检查创建、投影、处理、暂停/恢复/结束/停止、whole-series revision。
- [ ] 运行 `pnpm format:check`、`pnpm lint`、`pnpm typecheck`、`pnpm test --run`、`pnpm build`。
- [ ] 在浏览器验证桌面/移动：普通快捷新增、重复预览与创建、漏期推进、未来只读、日历一致性。
- [ ] 检查 `package.json` 与产品源码无 Ant Design 依赖或 import。
- [ ] 检查没有 DB schema 漂移；若实施中确需迁移，必须补 migration fixture 和说明。
- [ ] 使用 `trellis-check` 做规范、跨层、复用、测试和工作树复审并修复问题。
- [ ] 更新必要 spec/开发日志，提交代码；完成后使用 `trellis-finish-work` 收尾。

## 预计影响文件

| 区域 | 主要文件 |
|---|---|
| 领域 | `src/domain/recurrence/*`、`src/domain/reminder/scheduling.ts`、领域 exports/errors |
| 应用 | `src/application/recurrence/*`、`src/application/occurrences/*`、todos/recovery/calendar/reminders、composition root |
| 持久化 | 现有 repositories/unit-of-work；预计仅测试，不改 schema |
| UI | `src/features/todos/*`、`src/features/recovery/*`、`src/features/calendar/*`、必要的 `src/components/ui/*` |
| 测试 | 对应 domain/application/infrastructure/feature 测试与浏览器验收 |

## 提交建议

为降低回滚成本，按可独立验证的边界提交：

1. `feat: add fixed recurrence projector`
2. `feat: add recurrence lifecycle service`
3. `feat: unify task occurrence queries`
4. `feat: add recurrence creation and management UI`
5. `test: harden recurrence integration`

实际提交可在不牺牲审查性的前提下合并，但领域 projector 与 UI 不应混成一个不可独立验证的提交。

## 完成定义

- PRD 全部验收项通过，普通事项行为无回归。
- 数据库中每个 active/paused 系列只有一个 pending active occurrence；未来 occurrence 不落库。
- 同一 occurrence 在预览、列表、恢复区、提醒和所有已实现日历视图拥有一致 key 与 schedule。
- 未来项只读；当前项、整个系列和停止操作的作用范围清晰且由应用层再次校验。
- 全量质量门禁与浏览器关键流程通过，代码已提交且任务记录完整。
