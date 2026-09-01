# 长期目标实施计划

1. 新增长期目标领域 schema/type，并为普通任务 draft/entity 增加 optional `goalId`。
2. 新增 goal repository 接口、Dexie record/adapter 和 UnitOfWork 接线。
3. 增加 Dexie v2 schema 与迁移测试，确认 v1 数据保持不变。
4. 实现 `GoalService` CRUD/归档、任务关联校验与自动进度 snapshot；接入 application composition root。
5. 更新 TodoService 创建/编辑校验与相关测试。
6. 实现 `/goals` 页面、目标表单/详情，以及任务快速新增和详情中的目标选择器。
7. 运行目标领域、应用、数据库及 UI 测试，再执行 lint/typecheck/build。

## Risky Files / Rollback

- `src/domain/task/model.ts`：避免把 goal 字段意外传播到重复模板。
- `src/infrastructure/db/database.ts`、`schema.ts`：版本升级必须由旧数据库夹具覆盖。
- `src/application/todos/todo-service.ts`：归档目标关联兼容规则需回归现有任务更新路径。
