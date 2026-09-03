# 重复任务列表展示技术设计

## 边界与数据流

保持 IndexedDB 与重复领域模型不变，数据继续沿既有边界流动：

```text
OccurrenceRecord.completedAt
  -> OccurrenceQueryService / TaskOccurrenceView
  -> TodoService.snapshot()
  -> task-view 纯展示投影
  -> TodoPage 统一任务行
```

`OccurrenceQueryService` 在 `includeHistory` 查询下把 completed occurrence 的 `completedAt` 复制到 typed view model。普通任务仍直接使用 `SingleTask.completedAt`。完成时间只在展示层按 `snapshot.timeZone` 格式化，不持久化本地字符串。

## Todo 快照查询

现有一次 `[today, today + 90 days)` 待处理查询不能返回已完成 occurrence。`TodoService.snapshot()` 增加一条仅覆盖今天的历史查询，并将其中 completed/skipped occurrence 与现有未来投影按稳定 key 合并。范围保持有界，日历和 recurrence projector 均不改变。

普通任务已经完整包含在 `snapshot.tasks` 中，不从 occurrence 查询重复映射。

## 展示投影

在 `src/features/todos/task-view.ts` 中集中实现纯函数：

- occurrence 筛选复用与普通任务相同的 URL filter 语义；
- upcoming 在筛选完成后按 `seriesId` 保留排序最早的一条；
- today 默认允许 pending 与 completed，skipped 只在显式筛选时进入；其他视图维持现有默认状态语义；
- 普通任务和 occurrence 映射为一个只供 Todo 页面使用的 discriminated row view，再以主要 schedule、标题、稳定 key 排序；
- 完成 Instant 用 Temporal 和应用时区格式化为 `HH:mm`，输出“完成于 HH:mm”。

筛选后再折叠，保证用户搜索或筛选命中后续实例时不会因为一个已被排除的更早实例而得到空结果。

## UI

抽取一个共享任务行组件或在同一渲染分支消费统一 row view，保留普通任务现有完成/跳过/撤销/编辑/删除命令，重复实例继续通过 `OccurrenceDetailsDrawer` 查看与操作。两种 row 的内容结构一致：状态、标题、计划/截止、完成时间、清单、优先级、标签；重复项增加“重复”和当前/未来作用域标识。

完成状态不能只依赖颜色：保留勾选符号和中文“已完成”，并在旁边展示完成时间。移动端沿用现有 task-row 响应式布局，不添加新的交互容器。

## Compatibility and Risks

- 不改数据库 schema、持久化实体或备份格式，回滚只需撤销 view-model/query/UI 修改。
- 今天历史查询会多一次有界仓储读取；范围仅一天，不改变 90 天未来投影上限。
- 合并两次 occurrence 查询时按 `key` 去重，避免边界或将来查询行为变化造成重复行。
- `TaskOccurrenceView.completedAt` 是可选字段；构造器只在 completed record/普通任务确有字段时提供，符合 `exactOptionalPropertyTypes`。
