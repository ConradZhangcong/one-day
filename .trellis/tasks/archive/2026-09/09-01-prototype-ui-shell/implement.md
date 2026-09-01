# 应用外壳与视觉实施计划

1. 按官方 Vite 现有项目步骤安装 Tailwind CSS v4、shadcn/ui 默认 Base UI/neutral 配置、Lucide 与所需依赖。
2. 生成并审查最小所需 `src/components/ui/*` 原语，建立全局主题 token、reset、焦点样式和 toast provider。
3. 迁移 AppProviders、全局错误/PWA/时区/提醒提示，替换 App.useApp message/modal 和 Ant Design provider。
4. 重构 `AppShell`：标准 Logo、导航配置、计数、侧栏收起和移动导航。
5. 抽取可复用的页面标题、状态 badge/card 样式，减少页面间重复 UI 组合。
6. 迁移 TodoPage、TaskDetailsDrawer、ListManager、TaskReminderEditor，保留所有 service 调用与 aria 行为。
7. 迁移 RecoveryPage、ReviewPage、SettingsPage 和其他残余 Ant Design 使用点。
8. 接入目标和日历子任务提供的导航入口，不在本任务复制其业务投影。
9. 更新组件测试；确认旧库 import 为零后移除 `antd`/`@ant-design/icons`，运行 lint/typecheck/test/build，并做 1440px 与 390px 视口检查。

## Risky Files / Rollback

- `src/app/styles.css` 与 Tailwind 入口：全局影响最大，分块替换并检查每个现有页面。
- `src/app/AppShell.tsx`：保持所有旧路由可达。
- `src/features/todos/TodoPage.tsx`：布局修改不得改变保存、筛选和状态操作。
- 对话框/抽屉迁移：逐个保留提交中不可关闭、危险确认和草稿不丢失规则。
