# 集成实施计划

1. 完成并检查 `09-01-prototype-ui-shell`：初始化 shadcn/Tailwind，迁移全部 Ant Design 使用点并落地原型视觉和导航。
2. 完成并检查 `09-01-long-term-goals`：建立跨层数据合同和迁移，并使用已就绪的 shadcn primitive 实现目标页面与任务关联控件。
3. 完成并检查 `09-01-calendar-views`：基于最终外壳和真实数据服务实现四种日历视图。
4. 父任务集成验证：运行 `pnpm lint`、`pnpm typecheck`、`pnpm test:run`、`pnpm build`，并在桌面/手机视口检查核心流程。
5. 对照 `docs/prototype.html` 检查品牌、侧栏、标题区、视图标签、任务卡、状态表达、详情抽屉与响应式布局。
6. 以 import 搜索验证旧组件库零引用，并确认 `antd` 与 `@ant-design/icons` 依赖已移除。

## Rollback Points

- Dexie v2 与目标实体完成后单独检查迁移。
- 全局样式替换前后保留可独立审查边界。
- 日历查询服务与 UI 适配分离，避免因视图库问题回滚领域/应用投影。
