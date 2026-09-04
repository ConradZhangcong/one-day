# 清空本地数据实施计划

## Implementation

- [x] 扩展 `BackupRepository` 与 `DexieBackupRepository`，复用全表清空步骤并原子写回规范 inbox 和设备时区。
- [x] 在 `BackupService` 增加 `clearLocalData()`，验证设备时区、通过 `UnitOfWork.write` 执行并在提交后调用清空回调。
- [x] 在 composition root 接入提醒 reconcile，并让设置页在 application revision 后重新读取默认提醒时间。
- [x] 在 `BackupRestoreCard` 增加危险区域、双步骤 AlertDialog、忙碌互斥、成功/失败提示和成功后的 inspection 清理。
- [x] 补 repository/application/reminder/UI 回归测试，覆盖全表范围、全新安装状态、取消、单次提交与事务回滚。
- [x] 更新相关持久化 code spec，记录清空与整库恢复共享的原子替换契约。

## Validation

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:run
pnpm build
```

在本地浏览器使用测试数据打开设置页，仅验证危险说明与取消路径；不得对用户真实数据执行最终清空动作。成功清空路径由隔离的 fake-indexeddb 与组件 mock 测试验证。

## Rollback Points

- 不修改数据库 schema 或备份格式，代码可直接回滚。
- repository/API 改动和 UI 改动保持一个功能单元；若 UI 验收失败，不暴露入口，底层测试可独立保留。
- 禁止用真实用户数据库验证确认动作；任何成功路径验证都只使用隔离测试库。
