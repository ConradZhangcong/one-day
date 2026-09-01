# 实现固定重复事项

## Goal

让用户以可预测的固定日历周期管理重复事项，并让列表、恢复区、提醒和日历共享同一 occurrence 投影；连续漏做不会产生待办堆积，处理当前实例后按原始相位推进。

## Background

- 领域层已有 `RecurrenceSeries`、`FixedRecurrenceRule`、`OccurrenceRecord` 和稳定 `occurrenceKey` schema，Dexie 仓储与提醒运行时已有系列读取边界，但缺少规则 projector 和系列命令。
- 当前日历只展示数据库中已有的活跃 occurrence，未来 occurrence 保持只读；本任务交付后改为消费统一范围 projector。
- 历史研究已固定“系列 + 一个活跃实例 + 虚拟未来投影 + 例外/历史记录”模型，禁止把任务日期原地滚动或使用 FullCalendar recurrence 作为事实来源。

## Requirements

1. 支持每 N 天、N 周、N 月、N 年；周规则使用 ISO 周并可选多个星期；月规则区分固定日和每月最后一天。
2. 结束条件支持永久、包含当天的结束日期和总发生次数；保存前使用生产 projector 预览最多三次，有限规则不足三次时展示全部剩余项。
3. 有计划时间时以计划为锚点，否则以截止为锚点；两者都没有时必须先选择首次发生时间并写为计划时间。计划与截止的本地日期/墙上时间关系随每次 occurrence 保持。
4. 创建系列时只物化一个活跃 pending occurrence。未来合法 occurrence 在范围查询中虚拟生成并保持只读，不写入数据库。
5. 当前活跃 occurrence 可完成、跳过或仅本次修改计划/截止；标题、备注、清单、标签和优先级只允许编辑整个系列。
6. 处理当前 occurrence 后，在同一事务中保存历史并物化严格晚于当前原始锚点及当前时刻/本地日期的下一合法 occurrence；跳过已经过去且未物化的日期，不形成逾期堆积。
7. 有限规则耗尽时系列进入 `ended`；暂停保留当前 occurrence 和相位但从列表、日历及提醒隐藏；恢复重新显示原活跃 occurrence；停止归档系列、移除当前 pending occurrence并保留历史。
8. 编辑整个系列必须确认影响范围、增加 revision、保留旧 revision 历史并重建当前及未来投影；本任务不提供永久删除系列历史的入口。
9. 固定月 29/30/31 遇到无效日期时跳过该月；2 月 29 日在非闰年跳过；timed recurrence 保持本地墙上时间并使用 Temporal compatible DST 语义。
10. Todo/恢复/提醒/日历通过统一应用查询消费普通任务、当前 occurrence 和未来虚拟 occurrence；只有当前活跃 occurrence 接受状态或改期命令。
11. 产品界面使用项目本地 shadcn primitive，并明确显示“仅本次”“整个系列”“未来只读”三种作用范围。
12. 快速新增继续默认创建普通任务；用户主动展开“重复”设置后，表单直接创建重复系列并显示未来三次预览，不先创建普通任务，也不提供普通任务转系列流程。

## Acceptance Criteria

- [ ] 日/周/月/年规则、interval、date/count/never 结束条件在规则预览和范围查询中返回一致 occurrence key，查询起点或分片方式不改变相位及 COUNT。
- [ ] 创建系列后只有一个活跃 pending occurrence；连续漏过多期也不新增堆积，处理后直接推进到下一未来合法 occurrence。
- [ ] 完成、跳过和仅本次改期只作用于当前实例，不改变后续规则相位；未来虚拟 occurrence 不能被操作。
- [ ] 暂停、恢复、自然结束、停止和整个系列编辑满足状态、revision、历史保留及提醒可见性规则。
- [ ] 同时有计划和截止的系列在每次 occurrence 中保持原本的本地时间关系；无效月日、闰日和 DST 边界具有回归测试。
- [ ] 列表、恢复区、提醒和议程/日/周/月日历消费同一 occurrence projector，写入后通过 Dexie live query 实时一致。
- [ ] 表单可预览三次、明确作用范围并在手机与键盘操作下可用；产品代码无 Ant Design 依赖。
- [ ] format、lint、typecheck、领域/应用/事务/UI 测试和生产构建通过。

## Out of Scope

- 完整 RFC RRULE、按实际完成时间重复、“本次及以后”、节假日顺延、农历、自定义周起始日和单任务时区。
- 未来 occurrence 提前完成/跳过/单次改期。
- 拖拽改期和永久删除系列及历史。
- 已存在普通任务转换为重复系列。
- 备份恢复和云同步。
