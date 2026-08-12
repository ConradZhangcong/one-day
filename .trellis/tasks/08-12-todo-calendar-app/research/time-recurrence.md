# 时间、重复事项与提醒模型研究

## 结论

第一版必须把“人类日历日期”“本地墙上时间”“带时区的真实瞬时点”视为不同类型。重复事项采用“系列 + 一个活跃实例 + 虚拟未来投影 + 例外/历史记录”，不能延续旧原型把任务日期不断原地修改的模型。

## 历史问题证据

主代理只读核验了旧提交：

- `42eff82:src/types/task.ts` 使用 `startDate: Date | null`、`startTime: string | null`、`deadline: Date | null`，没有明确区分 LocalDate、墙上时间、Instant 和时区。
- `42eff82:src/utils/recurrenceUtils.ts` 在查询开始晚于系列开始时直接把游标改到查询开始，导致 interval 相位可能漂移；COUNT 只统计当前查询窗口；weekly 每次直接增加 N 周，不能正确展开一周多个星期几。
- 月/年计算依赖日期库默认加月/年行为，未固化 31 日和闰日语义。
- `42eff82:src/db/database.ts` 将重复任务存入单一任务表，没有系列、原发生键和例外记录边界。

## 时间值契约

持久化和领域接口只传 JSON 可序列化字符串，不传 JavaScript `Date`：

```ts
type LocalDate = string;       // YYYY-MM-DD
type LocalTime = string;       // HH:mm
type LocalDateTime = string;   // YYYY-MM-DDTHH:mm
type InstantString = string;   // ISO 8601 UTC, ends with Z
type TimeZoneId = string;      // IANA, e.g. Asia/Shanghai

type SchedulePoint =
  | { kind: 'none' }
  | { kind: 'allDay'; date: LocalDate }
  | { kind: 'timed'; localDateTime: LocalDateTime };
```

- 全局设置保存一个 `TimeZoneId`；第一版 UI 不允许单任务选择时区。
- 全天日期永远保持 `LocalDate`，不转换成 UTC。
- 精确时间以 `LocalDateTime + 当前用户时区` 解释；需要比较或触发提醒时才解析为 Instant。
- 用户修改应用时区必须显式确认；第一版保持墙上时间不变并重新解释 Instant，不跟随设备时区自动静默漂移。
- 实际完成时间、创建时间、更新时间和提醒触发记录保存为 Instant。

建议使用 Temporal/生产可用 polyfill：`PlainDate` 表示全天日期，`PlainDateTime` 表示墙上时间，`ZonedDateTime` 处理 IANA 时区和 DST，`Instant` 处理历史事实。

## 计划时间和截止时间

任务模板分别保存：

```ts
plannedAt: SchedulePoint;
deadlineAt: SchedulePoint;
```

校验规则：

- 两者均可为空。
- timed/timed 转成同一用户时区的 Instant 比较，截止不得早于计划。
- 只要一侧为 allDay，先比较本地日历日期；计划日期晚于截止日期时无效，同一天允许。
- 同一天的 allDay 计划 + timed 截止表示“当天安排，最迟具体时刻完成”。
- 同一天的 timed 计划 + allDay 截止表示“具体时刻开始计划，当天结束前完成”。

持久化状态只有 `pending | completed | skipped`。以下是查询时派生标签，不写入数据库：

- `missedPlan`：待处理且计划时间已过。
- `overdue`：待处理且截止时间已过。
- 全天计划/截止在对应本地日期结束后才分别视为错过/逾期；精确时间在对应 Instant 经过后生效。
- 同时满足时，以 `overdue` 作为主要恢复分组，避免同一任务在两个列表重复；详情仍可显示计划已错过。

## 重复系列契约

### 系列

```ts
interface RecurrenceSeries {
  id: string;
  template: TaskTemplate;
  anchor: 'planned' | 'deadline';
  rule: FixedRecurrenceRule;
  status: 'active' | 'paused' | 'ended' | 'archived';
  activeOccurrenceKey?: string;
  revision: number;
}

interface FixedRecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number; // >= 1
  weekdays?: number[];
  monthMode?: 'sameDay' | 'lastDay';
  end?: { kind: 'never' } | { kind: 'date'; inclusive: LocalDate } | { kind: 'count'; count: number };
}
```

锚点规则：

- 有计划时间时，以计划时间为发生锚点。
- 没有计划时间但有截止时间时，以截止时间为发生锚点。
- 两者都没有时，选择首次发生日期会直接写入 `TaskTemplate.plannedAt`（默认全天，也可选精确时间）并使用 planned 锚点；不创建第三种日期字段。
- 每个 revision 的系列起始锚点从 `anchor` 指向的 `template.plannedAt` 或 `template.deadlineAt` 读取且不可为 `none`；不重复持久化另一份 `dtStart`，避免数据漂移。
- 同时有计划和截止时，保存二者之间的本地日历/墙上时间关系，每个虚拟发生项投影出对应计划和截止；跨 DST 后仍保持当地墙上时间语义。

### 稳定实例标识

`occurrenceKey` 由 `seriesId + revision + 原始锚点本地值` 构成。所有完成、跳过和单次改期都引用原始 occurrence key，不能用改期后的日期作为身份。

### 例外与历史

```ts
interface OccurrenceRecord {
  occurrenceKey: string;
  seriesId: string;
  originalAnchor: SchedulePoint;
  overridePlannedAt?: SchedulePoint;
  overrideDeadlineAt?: SchedulePoint;
  state: 'pending' | 'completed' | 'skipped';
  completedAt?: InstantString;
  skippedAt?: InstantString;
}
```

- 没有交互的未来发生项按查询范围虚拟生成、不写数据库，且第一版只允许预览。
- 只有当前活跃实例可完成、跳过或单次改期；未来投影必须等待成为活跃实例，或通过编辑整个系列改变。
- 当前活跃、完成、跳过或当前实例单次改期时才物化记录。
- 编辑整个系列提升 `revision`，保留旧 revision 历史，只重算未来投影。
- 第一版“仅本次”只通过 occurrence record 覆盖计划/截止；标题、备注、清单、标签和优先级只允许编辑系列模板。“本次及以后”留待后续通过拆分系列实现。

## 单活跃实例推进算法

1. 创建系列时物化首次发生项，并记为唯一活跃实例。
2. 当前时间跨过后续规则日期时，不新增更多待处理记录；日历可继续显示标为“未来投影”的虚拟发生项。
3. 用户处理活跃实例时写入 completed 或 skipped 历史。
4. 从固定规则中寻找严格晚于当前活跃实例 `originalAnchor` 的后继，再跳过所有不晚于当前时刻/本地日期的候选；即寻找严格晚于 `max(originalAnchor, now)` 的下一合法发生项，避免提前完成时重复生成当前 occurrence。
5. 存在下一次时物化该发生项并更新 `activeOccurrenceKey`；有限规则耗尽时进入 `ended` 并清空活跃键，整个过程在一个事务中完成。
6. 暂停系列时从待办、日历和提醒查询中排除它，但保留活跃实例和历史；恢复时若活跃实例已过期仍先显示它，处理后再跳到未来。
7. 用户停止系列时删除当前 pending 记录、进入 `archived` 并停止投影；完成/跳过历史继续保留，除非另行确认永久删除。

不变量：

- 每个 active 系列最多一个 `pending` 的物化发生记录。
- 未来虚拟投影不能接受完成、跳过或单次改期命令。
- 处理一个实例不会修改固定规则的相位。
- 范围查询起点不会改变规则相位或 COUNT 统计。
- 任何视图对同一范围调用同一个投影器，返回相同 occurrence key。
- 未物化的漏过日期不计完成、跳过或漏做统计。

## 重复边界

- 每 N 周从当前 revision 的系列起始锚点所在 ISO 周计算 interval；周界固定为 `[周一 00:00, 下周一 00:00)`，`weekdays` 使用 1=Monday…7=Sunday，相符周内逐日选择，不能每命中一次就直接跳 N 周。
- COUNT 从当前 revision 的系列起始锚点起全系列计数，与查询窗口无关。
- UNTIL/结束日期包含当天。
- 固定每月 29/30/31 日遇到不存在日期时跳过该月。
- `lastDay` 显式选择每月最后一天。
- 每年 2 月 29 日非闰年跳过。
- 生成器必须接收有限范围，并有安全的最大展开数量，但安全上限不能改变合法 COUNT 语义。

RFC 5545 同样要求忽略无效日期/不存在本地时间，并通过 recurrence id 标识原始发生项；第一版只实现产品明确需要的子集，不向用户暴露完整 RRULE。

## DST 与时区策略

- 固定重复以本地墙上时间计算，例如每天 09:00 在 DST 前后仍是当地 09:00。
- 春季跳时产生不存在的本地时间时，采用 Temporal `compatible` 语义顺延到间隙后的对应时刻，并在规则预览中可见。
- 秋季重复时刻选择较早的瞬时点，只生成一次。
- 用户手动输入不存在时间时，在保存前提示实际解释后的时间，禁止无提示改写。
- 全部策略必须在至少一个有 DST 的 IANA 时区测试，不只测试 `Asia/Shanghai`。

## 提醒契约

```ts
interface Reminder {
  id: string;
  ownerKind: 'task' | 'series';
  ownerId: string;
  target: 'planned' | 'deadline';
  offsetMinutes: number;
  scheduleRevision: number;
  lastDeliveryKey?: string;
  snoozedUntil?: InstantString;
}
```

- 单次任务 reminder 引用 task；重复 reminder 保存为 series 模板配置，并从当前活跃 occurrence 派生触发时间。二者都只引用计划或截止，不复制业务日期。
- snooze 只改 `snoozedUntil`，不改计划/截止。
- 启动、focus、visibilitychange、系统恢复、应用时区变更后重新计算队列。
- 页面可见且事件循环正常时，不早于目标触发，目标后 60 秒内送达；持久化 delivery key 保证同一调度 revision 至多一次。
- 恢复执行只补发过去 15 分钟内未送达提醒；更早提醒不补发，任务仍按当前计划/截止状态出现在今天、即将到来或既有恢复视图。
- 通知权限必须由用户动作触发。
- 应用处于前台或浏览器仍允许执行时，使用应用内提醒和受支持的 Notification API。
- 进入受限后台、挂起或 PWA 关闭后，本地计时器不可作为可靠保证；服务端 Push API 留待后续。

## 必测矩阵

| 领域 | 最小覆盖 |
|---|---|
| 计划/截止 | 空值、全天/全天、全天/timed、timed/全天、timed/timed、同日、跨日、非法逆序 |
| 时区 | Asia/Shanghai、America/New_York 的 DST 前后、显式修改用户时区 |
| 日重复 | interval 1、3，范围从系列中间开始，COUNT/截止日 |
| 周重复 | 单日、多 weekday、interval 2、周日/周一边界、ISO 跨年周 |
| 月重复 | 28/29/30/31、lastDay、闰年 |
| 年重复 | 普通日期、2 月 29 日、COUNT |
| 单活跃实例 | 连续漏过、提前/按时/延迟完成、跳过、暂停/恢复、单次改期晚于下一投影 |
| 系列编辑 | 仅本次计划/截止、整个系列模板、保留历史、revision 后 key 稳定 |
| 提醒 | 单次/系列模板推进、权限允许/拒绝、snooze、休眠恢复、时钟跳变、15 分钟窗口、delivery key 去重、页面关闭限制 |

## 官方资料

- [Temporal 文档](https://tc39.es/proposal-temporal/docs/)
- [Temporal PlainDate](https://tc39.es/proposal-temporal/docs/plaindate.html)
- [Temporal PlainDateTime](https://tc39.es/proposal-temporal/docs/plaindatetime.html)
- [RFC 5545](https://www.rfc-editor.org/info/rfc5545/)
- [FullCalendar RRule 与时区说明](https://fullcalendar.io/docs/rrule-plugin)
- [MDN Notifications API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API)
