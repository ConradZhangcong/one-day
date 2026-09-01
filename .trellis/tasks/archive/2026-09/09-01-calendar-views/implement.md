# 日历实施计划

1. 定义 `CalendarQuery`/`CalendarItemView`/`CalendarSnapshot`，实现普通任务与已有 occurrence 的统一范围投影。
2. 增加 CalendarService 并接入 application composition root；为 live query 提供 hook。
3. 实现通用日历页头、视图 tabs、日期分页、今天按钮和 URL 筛选。
4. 实现 agenda 分组列表及普通任务详情/操作。
5. 实现 day/week 时间网格、全天计划区、deadline marker 和每日负载。
6. 实现 month 日格、标签上限、`+N` 和日视图下钻。
7. 实现已有 occurrence 的只读详情与边界说明。
8. 添加 service/component 测试，运行 lint/typecheck/test/build，并检查桌面与手机视口。

## Risky Files / Rollback

- 统一投影必须是唯一日期语义来源；发现视图分叉时先回滚 UI 局部计算。
- occurrence 投影只读且不生成未来数据，避免提前绑定未实现的系列生命周期。
- `src/app/router.tsx` 保留旧 `/calendar/:view` 兼容并对非法 view 安全回退。
