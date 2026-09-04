# 清空本地数据技术设计

## 目标与边界

该能力复用现有整库备份/恢复事务边界，但不构造伪备份文件。清空命令由设置页发起，经应用服务和 repository port 进入 Dexie；React 组件不访问数据库。

```text
BackupRestoreCard（危险说明 + AlertDialog）
  -> BackupService.clearLocalData()
  -> UnitOfWork.write()
  -> BackupRepository.clearAll(deviceTimeZone)
  -> DexieBackupRepository（清空全部表 + 重建 inbox/timezone）
  -> application revision + ReminderRuntime.reconcile()
```

## 应用与仓储契约

扩展既有契约：

```ts
interface BackupRepository {
  readSnapshot(): Promise<BackupDataV1>;
  replaceAll(data: BackupDataV1): Promise<void>;
  clearAll(applicationTimeZone: TimeZoneId): Promise<void>;
}

interface BackupServiceDependencies {
  now?: () => string;
  detectTimeZone?: () => string;
  onRestored?: () => void;
  onCleared?: () => void;
}

BackupService.clearLocalData(): Promise<void>;
```

`clearLocalData()` 先通过共享 `decodeTimeZoneId` 验证当前设备时区，再进入 `UnitOfWork.write`。`clearAll()` 只能在外层全表事务中调用；它清空 `db.tables` 的所有表，然后只写回：

- `lists`: 规范 `system:inbox`；
- `settings`: 当前设备 `applicationTimeZone`。

全天计划提醒时间不写回，因此 `ReminderService.getAllDayDefaultTime()` 返回产品默认值。所有任务、系列、occurrence、标签、提醒、目标和 `meta` 保持为空。

将清表逻辑抽成 repository 内部共享步骤，供 `replaceAll()` 与 `clearAll()` 复用，避免未来新增表时两个整库操作发生漂移。该任务不改变表结构、索引或备份 v1 格式，因此不提升 Dexie schema 版本。

## 事务与失败行为

整个操作由 `DexieUnitOfWork.write` 覆盖 `db.tables`。清表、写入系统收件箱或写入时区任一步抛错时，Dexie 回滚全部表；`onCommitted`、`onCleared` 和成功 toast 均不得触发。

提交成功后顺序为：

1. `UnitOfWork` 发布一次本地及跨标签页应用变更信号；
2. `BackupService` 调用 `onCleared`；
3. composition root 触发 `ReminderRuntime.reconcile()`，其第一步取消旧 timer，并从空提醒表重建空队列。

设置页当前把提醒时间放在本地 React state，需订阅 `useApplicationRevision()` 并在提交后重新读取，确保删除偏好后立即展示默认值而不是旧值。

## UI 与确认

在 `BackupRestoreCard` 添加独立危险区域，与导出/恢复分区隔开：

- 常驻文案明确会删除此设备上的任务、历史、清单、提醒、目标和应用偏好，且无法撤销；
- 提供“先导出备份”的建议；
- 首次点击“清空本地数据”只打开 `AlertDialog`；
- 对话框再次列出范围，取消零写入；最终 destructive action 使用明确文案“确认清空全部数据”；
- 进行中禁用导出、导入、恢复、清空和关闭确认，避免并发整库操作；
- 成功关闭对话框、丢弃已检查的待恢复文件并显示成功 toast；失败关闭确认并显示“原数据保持不变”。

不尝试清除 Notification 权限、Service Worker/Cache Storage、浏览器站点权限或其他浏览器管理的数据，因为网页不能可靠重置这些外部状态。

## 测试策略

- Repository：非空全表清空后仅剩规范 inbox 和设备时区；全天计划提醒设置与 `meta` 被删除；在清空后注入失败会全量回滚。
- Application：设备时区被解码并传给 repository；成功只触发一次 commit/onCleared，失败不触发回调。
- Reminder：清空成功后的 reconcile 取消旧 timer，且不产生 delivery。
- UI：危险说明可见；首次点击只开确认；取消零调用；确认只调用一次；忙碌态防重复；成功/失败中文反馈；成功清理 restore inspection。
- 回归：备份导出/恢复行为、系统收件箱、设置页提醒时间重读、跨标签页 invalidation 保持可用。
- 全量门禁：format、lint、typecheck、Vitest 和 production build。

## 风险与回滚

| 风险 | 控制 |
|---|---|
| 漏清未来新增表 | 与整库恢复共享全表枚举和清表 helper；repository 测试断言所有当前表 |
| 清空后应用因缺系统数据崩溃 | 同事务重建规范 inbox 与设备时区 |
| 中途失败造成部分删除 | 外层覆盖全部表的 Dexie 事务 + 失败注入测试 |
| 旧提醒继续触发 | 提交后 reconcile，先取消 timer 再读取空表 |
| 用户误触 | 独立危险区域、不可撤销说明、两次显式点击、忙碌锁 |

代码回滚不需要数据库迁移；在未确认前没有写入，确认后的真实数据删除无法由代码回滚恢复，只能通过用户此前导出的备份恢复。
