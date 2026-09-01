# 日历技术设计

## Query Contract

新增 framework-free `CalendarService.query(input)`，输入包括 `[rangeStart, rangeEnd)`、应用时区和筛选，输出统一 `CalendarSnapshot`：

```ts
interface CalendarItemView {
  key: string;
  ownerKind: 'task' | 'occurrence';
  ownerId: string;
  title: string;
  kind: 'planned' | 'deadline';
  schedule: ScheduledPoint;
  deadlineAt?: SchedulePoint;
  state: 'pending' | 'completed' | 'skipped';
  readonly: boolean;
  listId: string;
  priority: Priority;
}
```

- 普通任务：有计划时产生 planned item，并把截止作为附加信息；仅有截止时产生 deadline item，避免重复显示。
- 重复实例：仅投影数据库已有 occurrence record。通过 series template + override 解析当前计划/截止；无法完整解析或系列暂停/终态时不展示。
- completed/skipped 普通任务根据筛选决定是否展示；默认日历聚焦 pending。
- 所有范围包含判断按本地 `[start, end)` 日期语义执行。

## UI Adapter

- `CalendarPage` 解析 route `view` 和 query params，非法值回退 agenda/今天；页头、Tabs、筛选、Badge、Sheet、Popover 与按钮使用 shadcn/ui。
- FullCalendar 或自有轻量视图只消费 `CalendarItemView`；组件事件转回 task id，再调用现有 TodoService/TaskDetailsDrawer。
- agenda 使用自有分组列表，便于把恢复状态与截止语义表达清楚。
- day/week 使用时间网格；无时长任务渲染为时间点，全天和 deadline marker 分区。
- month 使用日格，限制可见项并提供 `+N` 与日期下钻。

## Occurrence Boundary

- occurrence item `readonly: true`，点击展示只读详情/说明，不调用不存在的系列管理命令。
- 本任务不调用规则展开器，也不虚构未来 occurrence；这是与后续重复任务的明确接缝。

## Testing and Performance

- service 测试覆盖四类计划/截止组合、范围边界、状态筛选、周一开周和 existing occurrence override。
- UI 测试覆盖视图切换、分页/今天、月下钻、任务详情与只读 occurrence。
- 本地个人数据量采用单次 snapshot + memoized projection；不增加 Dexie schema/索引。
