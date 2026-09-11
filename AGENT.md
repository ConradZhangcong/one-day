# 开发变更同步约定

本文说明修改 One Day 时应同步检查的文件。按本次变更的实际影响更新，不要求每次修改所有文件，也不要为了保持文件更新时间一致而制造无意义差异。

## 文档与原型

| 变更内容                               | 需要同步检查的文件                                                                                                   | 更新要求                                                                                                         |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 新增、删除功能，修改业务规则或实现边界 | [docs/需求文档.md](docs/需求文档.md)、[README.md](README.md)                                                         | 更新对应需求、当前限制、验收映射；影响功能概览或使用方式时更新 README。不能只追加说明而保留相互矛盾的旧描述。    |
| 页面布局、导航、交互流程、可见文案     | [docs/prototype.html](docs/prototype.html)、[docs/原型说明.md](docs/原型说明.md)、相关 `src/features/` 页面          | 原型与实际页面保持一致；记录演示边界和真实验证情况。用户明确要求先改原型时，先完成原型并标明尚未同步实现的部分。 |
| 修复体验评审中的问题                   | [docs/体验评审.md](docs/体验评审.md)、[docs/原型说明.md](docs/原型说明.md)                                           | 标明哪些问题已落实、哪些仍待处理；保留原始观察的时间与上下文，避免让历史问题看起来仍是当前状态。                 |
| 新增、移动或重命名文档                 | [docs/README.md](docs/README.md)、引用该文档的其他文件                                                               | 更新导航和相对链接；删除文件前检查引用。                                                                         |
| 依赖、运行环境、脚本或开发命令         | `package.json`、`pnpm-lock.yaml`、[README.md](README.md)、相关配置                                                   | 保持技术栈、版本要求、安装和检查命令一致；依赖变更使用包管理器更新锁文件。                                       |
| PWA、离线能力、通知限制或发布验收      | [docs/release-checklist.md](docs/release-checklist.md)、[docs/需求文档.md](docs/需求文档.md)、[README.md](README.md) | 区分自动化验证、浏览器视口检查和真机验证，不将其中一种表述为另一种已通过。                                       |

## 实现之间的联动

| 修改位置或能力         | 同步检查范围                                                                                                                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 路由、页面名称和导航   | `src/app/router.tsx`、`src/app/AppShell.tsx`、各页面入口及 URL 参数；检查桌面侧栏、手机五入口和更多菜单。                                                                                                                |
| 全局视觉样式           | `src/app/prototype-theme.css`、`src/app/styles.css`、`src/main.tsx`、`docs/prototype.html`；检查样式加载顺序、覆盖关系、浅深色和手机布局。                                                                               |
| 标题栏与新增任务       | `src/app/PageActions.tsx`、`src/features/todos/AddTaskButton.tsx`、`QuickAdd.tsx` 及使用它们的页面；确认清单与日历日期等默认值正确传入。                                                                                 |
| 任务显示、筛选与历史   | `src/features/todos/task-view.ts`、`TodoPage.tsx`、`src/application/todos/todo-service.ts`、`src/application/occurrences/occurrence-query-service.ts`；同时核对普通任务、重复事项、实际完成日期及历史只读状态。          |
| 计划、截止与改期       | `src/domain/schedule/`、`src/features/todos/ScheduleFields.tsx`、`TaskDetailsDrawer.tsx`、`OccurrenceDetailsDrawer.tsx`、`src/features/recovery/RecoveryPage.tsx` 及对应应用服务；保留具体时间、应用时区和时间顺序校验。 |
| 重复事项规则与生命周期 | `src/domain/recurrence/`、`src/application/recurrence/`、`src/application/occurrences/`，以及待办、日历、恢复和回顾入口；确认本次操作、整个系列操作及未来只读投影的边界一致。                                            |
| 目标关联或进度         | `src/features/goals/GoalsPage.tsx`、`src/application/goals/`、新增与详情表单；检查归档目标、关联数量、进度和任务列表。                                                                                                   |
| 持久化模型或数据库版本 | `src/domain/`、`src/application/repositories/`、`src/infrastructure/db/`；评估迁移、历史数据兼容、备份 schema、导入导出和恢复服务是否需要同步。不要仅修改页面中的数据形状。                                              |

React 页面通过应用服务读写数据，不直接操作 Dexie 表。原型中的固定时钟、示例任务和演示提示不应直接带入正式页面。

## 验证与交付

- 行为变更同步对应的 `tests/domain/`、`tests/application/`、`tests/features/` 或 `tests/infrastructure/` 测试；关键跨页面流程变更检查 `tests/e2e/`。
- 测试验证用户可观察的行为和数据结果；不要只因样式、静态文案或文档变更增加重复实现的测试。
- 代码变更运行适用的类型检查、Lint、测试和构建；数据库、PWA 或性能相关变更补充对应专项检查。检查已通过后，除非又有修改或发现新问题，不重复运行无关检查。
- 页面变更检查桌面和手机布局，重点确认溢出、弹窗、导航、空状态及主要操作。不能完成的检查明确记为待验证。
- 纯文档修改检查格式、路径和链接即可，不要求运行应用测试或构建。
- 交付时说明实际改动、同步文件和验证结果。不要将原型演示写成已实现功能，不要将未运行的检查写成已通过。

项目结构、文档入口或共用组件变化后，也应同步更新本文件中的路径与约定。用户在当前任务中的明确要求优先。
