# 集成设计

## Boundaries

- 父任务只维护跨子任务需求、顺序和最终集成验收，不直接承载产品代码修改。
- `long-term-goals` 拥有领域实体、应用服务、Dexie v2 迁移及任务关联字段。
- `prototype-ui-shell` 拥有 shadcn/Tailwind 基础设施、应用外壳、通用 UI 迁移、导航、全局视觉变量和现有功能页布局。
- `calendar-views` 拥有统一日历查询投影、四种视图、日期范围 URL 状态和日历任务详情入口。

## Shared Contracts

- React 组件只能调用应用服务，不直接读写 Dexie。
- `SingleTask.goalId?: string` 是普通任务到长期目标的可选单向引用；目标删除采用归档语义，避免悬空引用。
- 日历投影输出统一的 `CalendarItemView`，区分 `planned`、`deadline` 与 `occurrence`，视图组件不得自行解释原始持久化记录。
- UI 使用 shadcn/ui 默认 Base UI 基础、Tailwind CSS v4 与 neutral 主题；通用组件源码落在 `src/components/ui/`，图标使用 Lucide。
- FullCalendar 仅作为日历布局引擎保留，不承担表单、对话框、导航或业务状态组件职责。

## Data Flow

```text
Dexie v2 -> repositories -> goal/todo/calendar services -> live query hooks
          -> shared typed projections -> todo / goal / calendar React views
```

## Compatibility and Rollback

- Dexie 从 v1 升到 v2，只新增 `longTermGoals` 表；任务的可选 `goalId` 不需要批量改写旧记录。
- 旧任务解码后 `goalId` 为 `undefined`，行为不变。
- 每个子任务保持独立提交边界；出现迁移或投影问题时可按子任务回滚，不改动已有任务语义。
