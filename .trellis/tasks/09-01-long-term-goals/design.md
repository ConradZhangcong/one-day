# 长期目标技术设计

## Domain and Contracts

新增 `LongTermGoal`：

```ts
type LongTermGoalStatus = 'planned' | 'active' | 'completed' | 'archived';

interface LongTermGoal {
  id: string;
  title: string;
  description: string;
  status: LongTermGoalStatus;
  createdAt: Instant;
  updatedAt: Instant;
}
```

`SingleTask` 与 `TaskDraft` 新增可选 `goalId`。字段只进入普通任务 schema，不扩展 `TaskDetails`/重复模板，避免越过已确认的重复任务边界。

应用层提供 `GoalService`：snapshot、create、update、archive。`GoalSnapshot` 合并目标与普通任务后计算 `totalCount`、`completedCount` 和百分比，不持久化派生进度。

## Persistence

- Dexie schema 升级到 v2，新增 `longTermGoals: 'id, status, updatedAt'`。
- v1 的 `singleTasks` store 索引不变；`goalId` 不作为索引，目标快照在本地规模下以内存合并。
- 新增 goal repository，并接入 `UnitOfWork` 和 composition root。
- `goalId` 为 optional，旧记录通过新 schema 解码时无需数据回填。

## Invariants

- 创建/更新任务时，若 `goalId` 非空，目标必须存在且未归档；编辑一个已关联到后来归档目标的任务时允许保留原关联或清除，不允许改绑到其他归档目标。
- 归档不级联修改普通任务；删除目标不在 MVP 中提供。
- 进度只由 `state === 'completed'` 计入完成数；pending/skipped 只计分母。

## UI

- `/goals` 使用 shadcn Card、Badge、Progress、Dialog/Sheet、Select 等 primitive 展示原型风格目标卡与新建入口。
- 目标卡显示状态、说明、关联数和自动进度；点击打开编辑/关联任务详情。
- QuickAdd 与 TaskDetailsDrawer 使用 shadcn Select/Combobox 目标选择器；QuickAdd 默认不关联。

## Tests and Rollback

- 领域 schema、服务不变量、自动进度、任务关联校验、v1→v2 迁移均测试。
- 迁移只新增表，回滚风险集中在版本声明和新增 repository；不重写旧记录。
