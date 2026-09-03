# 重复任务列表展示实施计划

## Implementation

- [x] 扩展 `TaskOccurrenceView`，让普通任务与 completed occurrence 携带 `completedAt`，并补充 occurrence query 测试。
- [x] 调整 `TodoService.snapshot()`，合并今天 occurrence 历史与现有 90 天待处理/未来投影，按 key 去重并补应用测试。
- [x] 在 `task-view.ts` 集中实现 occurrence 筛选、upcoming 系列折叠、today 状态语义、统一列表行排序及本地完成时间格式化。
- [x] 重构 `TodoPage` 为普通任务与重复实例共用展示结构，保留各自正确的命令与只读边界。
- [x] 更新样式，使状态、完成时间和元数据在桌面与移动布局清晰可读。
- [x] 添加投影和组件回归测试，覆盖系列折叠、筛选后折叠、今天混排、完成状态/时间及只读行为。

## Validation

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:run
pnpm build
```

必要时运行与 Todo 核心流程相关的 Playwright 用例，确认完成操作后的 live-query 刷新与移动布局未回归。

## Rollback Points

- 数据库 schema 与领域记录不变，无数据迁移回滚。
- 若统一 JSX 重构引发命令行为回归，可保留纯投影与 view-model 改动，先恢复两类 row 的独立渲染分支。
