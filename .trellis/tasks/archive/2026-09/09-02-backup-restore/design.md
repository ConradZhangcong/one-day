# 备份与恢复技术设计

## 设计目标

建立一个独立于 Dexie 物理 record 的版本化备份契约。浏览器文件和数据库内容都视为不可信输入：先完整解码并验证跨表引用，再允许进入一次性整库替换事务。UI 只处理文件选择、摘要和确认，不直接访问 IndexedDB。

## 边界与职责

```text
本地 JSON 文件
  -> SettingsPage / BackupRestoreCard（读取文本、展示摘要、确认）
  -> BackupService（解析、版本路由、领域与引用校验）
  -> BackupRepository port（读取一致快照 / 原子替换）
  -> DexieBackupRepository（领域实体 <-> record 投影、全表事务）
  -> 应用变更通知 + ReminderRuntime.reconcile()
```

- `src/domain/backup/` 拥有稳定 v1 schema、解码器、摘要类型和跨实体一致性校验。
- `src/application/backup/` 拥有 `BackupService`，提供导出、检查导入和确认恢复用例。
- `src/application/repositories/backup-repository.ts` 定义一致快照和替换端口。
- `src/infrastructure/db/backup-repository.ts` 是唯一知道 Dexie 全部表和 record 投影的备份适配器。
- `src/features/settings/BackupRestoreCard.tsx` 只消费应用服务返回的备份文档、摘要和稳定错误。
- `src/app/application.ts` 负责注入恢复成功后的提醒 reconcile；事务提交继续通过现有应用变更信号刷新当前和其他标签页。

## v1 数据契约

顶层契约固定为：

```ts
interface OneDayBackupV1 {
  format: 'one-day-backup';
  version: 1;
  exportedAt: Instant;
  timeZone: TimeZoneId;
  data: {
    singleTasks: SingleTask[];
    recurrenceSeries: RecurrenceSeries[];
    occurrenceRecords: OccurrenceRecord[];
    lists: TaskList[];
    tags: Tag[];
    reminders: Reminder[];
    longTermGoals: LongTermGoal[];
    settings: {
      applicationTimeZone: TimeZoneId;
      allDayReminderTime?: LocalTime;
    };
  };
}
```

设计约束：

- `timeZone` 必须等于 `data.settings.applicationTimeZone`，顶层字段用于无需遍历数据即可展示摘要，也防止导入时语义不明确。
- 数组内容是领域实体，不含 `plannedLocalDate`、`normalizedTitle`、`anchorLocalDate` 等可重建索引字段。
- v1 只备份当前已定义且会影响用户体验的设置。增加新的可恢复设置时新增备份版本或显式 v1 迁移，不向旧 schema 静默塞字段。
- `meta` 是数据库内部元数据，不进入备份；整库替换时清空，由当前应用版本按需重建。
- 保留 Reminder 的 schedule/snooze revision、delivery identity 和 occurrence 历史，避免恢复后丢失领域状态或重复近期通知。

## 解码与一致性校验

导入分为三个纯阶段，任何失败都发生在写事务之前：

1. `JSON.parse` 将文本变为 `unknown`，语法错误映射为 `BACKUP_INVALID_JSON`。
2. 顶层 envelope 先检查 format/version；未知版本映射为 `BACKUP_UNSUPPORTED_VERSION`，v1 再调用唯一 Zod decoder。
3. `validateBackupGraph` 校验集合与引用：
   - 每类实体 id/key 唯一；
   - 恰有一个规范的 `system:inbox`；
   - 任务和系列引用存在的清单、标签及长期目标；
   - occurrence 引用存在的系列，且 key 中 series/revision/anchor 与记录一致；
   - active/paused 系列恰好引用一个自身 pending occurrence，ended/archived 不持有 active key；
   - reminder owner 存在且目标计划/截止在恢复后的 owner 上有效；
   - 顶层时区和设置时区一致。

校验失败使用稳定 `DomainErrorCode`，UI 只映射错误码为中文，不展示原始 JSON 或任务内容。Zod 细节保留给测试/诊断边界，不作为机器契约。

## 导出数据流

1. `BackupService.export()` 请求 `BackupRepository.readSnapshot()`。
2. Dexie 适配器在单个只读事务内读取所有领域表和设置，并经现有共享 decoder 转回领域实体。
3. 服务用注入时钟生成 `exportedAt`，构造 v1 文档，再以 v1 decoder 自校验。
4. UI 使用格式化 JSON 创建 Blob 下载，文件名为 `one-day-backup-YYYY-MM-DDTHH-mm-ssZ.json`，完成后释放 object URL。

导出读取期间若存储中已有损坏 record，现有 decoder 必须让操作失败，不得把损坏数据原样打包。

## 导入预览与恢复数据流

1. UI 读取用户选择的 `.json` 文本并调用 `BackupService.inspect(text)`。
2. 服务返回只读 `BackupInspection`：已解码文档和仅含数量/时区/导出时间的摘要。UI 不自行重新解析。
3. 用户取消时丢弃 inspection，不写数据库；确认时把 inspection 交回 `restore()`。
4. 服务在恢复前再次对文档做 v1 和 graph 校验，防止被调用方构造伪造 typed value。
5. `UnitOfWork.write` 内调用 `BackupRepository.replaceAll(data)`：清空全部 v3 表，按依赖顺序写入设置、清单、标签、目标、任务、系列、occurrence、提醒；record 索引投影使用现有 encoder 重建。
6. 任一步骤抛错由 Dexie 回滚整个事务。提交后现有 `onCommitted` 只发布一次应用变更通知，随后调用 `ReminderRuntime.reconcile()`。

恢复不关闭或重建数据库实例，避免页面持有旧连接；live query 和显式应用 revision 在提交后重新读取同一数据库。

## 仓储与事务设计

`BackupRepository` 端口提供：

```ts
interface BackupRepository {
  readSnapshot(): Promise<BackupDataV1>;
  replaceAll(data: BackupDataV1): Promise<void>;
}
```

- `readSnapshot` 由 Dexie 适配器内部开启覆盖全部表的只读事务，保证导出没有跨表撕裂。
- `replaceAll` 不自行开启或提交事务，只能由 `UnitOfWork.write` 调用，复用外层覆盖 `db.tables` 的事务。
- 适配器复用或抽取 `projections.ts` 的 encoder/decoder，不复制领域到 record 的转换规则。
- 不增加 IndexedDB 表或索引，因此本任务不提升 `DATABASE_VERSION`；备份格式版本与数据库 schema 版本独立演进。

## UI 设计

设置页新增“本地数据”卡片：

- 导出区说明文件包含敏感个人信息，按钮触发下载并显示成功/失败 toast。
- 恢复区使用可访问的 file input，仅接受 JSON；选择后展示文件元信息与备份摘要。
- 恢复按钮打开 `AlertDialog`，明确“当前设备中的全部 One Day 数据将被替换，无法撤销”。
- 确认期间禁用重复操作；成功后关闭确认、清空文件选择并提示恢复数量；失败保留 inspection 供用户理解或重试。
- 文件名不是可信展示内容，不插入 HTML；错误文案不回显文件内容。

## 兼容与版本演进

- v1 decoder 使用严格顶层与 data object，拒绝未知 envelope 字段；领域实体 schema 继续允许其自身明确的兼容规则。
- `decodeBackup(input)` 使用显式 version switch。未来 v2 通过 `decodeV2 -> migrateToCurrent` 添加，不修改 v1 的历史含义。
- 当前应用拒绝 version > 1 和非 One Day 格式，不尝试猜测或部分导入。
- 数据库未来升级时，备份导入仍先迁移为当前领域实体，再由当前 record encoder 写入当前 schema。

## 测试策略

- 领域：合法 v1、format/version、重复 id、收件箱、跨表引用、系列 active key、提醒 owner、时区一致性。
- 应用：稳定摘要、确定性时钟、导出自校验、inspect 不写入、确认恢复回调只在提交后执行。
- 数据库：一致快照、全量替换、索引投影重建、旧数据移除、干净库往返、注入中途失败全事务回滚。
- UI：下载、文件读取、摘要、取消零写入、危险确认、忙碌态、稳定中文错误和同一文件重选。
- 回归：恢复后 Todo/Recovery/Calendar 可读取，ReminderRuntime reconcile 不重复已 claim 的 delivery。

## 风险与回滚

| 风险 | 控制 |
|---|---|
| 损坏备份覆盖好数据 | 完整预检 + 跨表校验 + 显式确认 + 单事务替换 |
| record 投影遗漏导致查询异常 | 只导出领域实体，恢复统一走共享 encoder，覆盖索引断言 |
| 导出过程中并发写导致引用撕裂 | 覆盖所有表的只读事务快照 |
| 恢复后重复提醒 | 保留 delivery identity；仅提交后 reconcile；覆盖回归测试 |
| 未来版本误导入 | 显式 format/version 路由并拒绝未知版本 |
| 文件泄露个人信息 | 设置页明确敏感提示；纯本地处理，不上传 |

代码回滚不依赖数据库降级：本任务不修改 DB schema。若实现失败，可撤回新增服务、适配器和 UI；用户原数据只会在通过验证并确认的事务内被替换。
