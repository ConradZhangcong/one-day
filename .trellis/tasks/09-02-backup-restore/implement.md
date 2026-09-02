# 备份与恢复实施计划

## Phase 0 — 开发前门禁

- [x] 用户审核并明确批准本 PRD、技术设计和实施计划。
- [x] 运行 `task.py start`，确认分支、base 和干净工作树。
- [x] 使用 `trellis-before-dev` 加载后端、前端和跨层规范。
- [x] 再次确认本任务不包含 PWA 发布加固、合并恢复或云端能力。

## Phase 1 — v1 领域契约与图一致性

- [x] 新增 `src/domain/backup/`，定义严格 envelope、v1 data、设置和摘要 schema/type/decoder。
- [x] 实现 format/version 路由、JSON 语法错误与稳定备份错误码。
- [x] 实现唯一 id/key、规范收件箱、清单/标签/目标、occurrence/series、reminder owner 和时区一致性校验。
- [x] 复用现有领域 schema、occurrence key parser 与时间 decoder，不声明第二套实体形状。
- [x] 添加表驱动领域测试覆盖合法、空集合、重复键、非法引用、错误状态和未知版本。

验证点：任意被接受的备份都是可写入当前领域模型的闭合数据图。

## Phase 2 — 备份仓储与原子替换

- [x] 新增 `BackupRepository` 端口并接入 `OneDayRepositories`。
- [x] 实现 Dexie 适配器的全表只读一致快照，输出解码后的领域实体和显式设置。
- [x] 实现 `replaceAll`：清空全部表、通过共享 projection encoder 重建 records、按依赖顺序批量写入。
- [x] 确保 `replaceAll` 只在 `UnitOfWork.write` 外层事务中执行，提交只触发一次应用变更通知。
- [x] 添加导出并发一致性、残留旧数据清除、索引投影重建和所有表往返测试。
- [x] 增加可控中途失败测试，逐表断言恢复前数据完整保留。

验证点：成功后数据库只包含备份语义数据；任一失败后逐表等于恢复前快照。

## Phase 3 — BackupService 用例

- [x] 实现 `export()`：读取一致快照、取得应用时区、生成 exportedAt 并自校验 v1 文档。
- [x] 实现 `inspect(text)`：解析、版本路由、完整校验并返回无敏感内容的数量摘要。
- [x] 实现 `restore(inspection)`：再次校验、单事务替换，只在提交后触发恢复回调。
- [x] 在 composition root 注册服务，并把成功回调连接到 `ReminderRuntime.reconcile()`。
- [x] 添加应用测试覆盖确定性导出、inspect 零写入、取消语义、成功回调及失败不回调。

验证点：应用层是 UI 唯一入口，任何导入错误都不会到达写事务。

## Phase 4 — 设置页导出与恢复界面

- [x] 新增 `BackupRestoreCard` 并放入设置页“本地数据”区域。
- [x] 实现敏感数据提示、JSON Blob 下载、稳定文件名和 object URL 释放。
- [x] 实现文件选择、异步读取、摘要展示、同文件重选和取消。
- [x] 使用本地 shadcn `AlertDialog` 实现不可撤销整库替换确认。
- [x] 实现忙碌态、防重复提交、成功清理与按错误码映射的中文失败提示。
- [x] 补 RTL 测试覆盖下载、合法/非法文件、摘要、取消、确认、失败保留及键盘标签。

验证点：没有用户确认就没有恢复写入，UI 不读取 Dexie record 或自行解析领域实体。

## Phase 5 — 跨层回归与质量门禁

- [x] 完成非空库导出—清空—恢复—再导出的语义等价测试。
- [x] 验证普通任务、重复历史、长期目标、清单标签、提醒设置和 delivery identity 均保留。
- [x] 验证恢复提交后 Todo/Recovery/Calendar/Settings 通过应用 revision 重读。
- [x] 验证 ReminderRuntime 使用恢复后的数据 reconcile，已 claim delivery 不重复发送。
- [x] 检查产品代码无 raw record 泄漏、unchecked cast、敏感内容日志或组件直写数据库。
- [x] 运行 `pnpm format:check`、`pnpm lint`、`pnpm typecheck`、`pnpm test:run`、`pnpm build`。
- [x] 使用 `trellis-check` 完成规范、跨层、复用、事务和测试复审并修复问题。
- [x] 使用 `trellis-update-spec` 记录稳定备份格式与整库恢复事务契约，更新 README 当前能力。
- [ ] 提交代码、归档任务并执行 `trellis-finish-work`。

## 预计影响文件

| 区域 | 主要文件 |
|---|---|
| 领域 | `src/domain/backup/*`、`src/domain/errors.ts`、领域 exports |
| 应用 | `src/application/backup/*`、`src/application/repositories/*`、应用 exports |
| 持久化 | `src/infrastructure/db/backup-repository.ts`、repositories/projections/unit-of-work 接线 |
| 组合根 | `src/app/application.ts`、应用变更与 reminder reconcile 接线 |
| UI | `src/features/settings/BackupRestoreCard.tsx`、`SettingsPage.tsx`、必要样式 |
| 测试 | domain/application/infrastructure/feature 对应测试与备份夹具 |
| 文档 | `.trellis/spec/backend/database-guidelines.md`、README |

## 风险文件与回滚点

| 边界 | 风险 | 回滚/验证 |
|---|---|---|
| v1 schema | 发布后不可随意改变 | 固定夹具和 decoder 测试；未来新增版本路由 |
| 全表替换 | 数据丢失 | 写前完整验证；单 Dexie 事务；故障注入逐表比对 |
| record projection | 恢复后索引查询错误 | 复用现有 encoder；按查询索引断言 |
| reminder reconcile | 近期重复通知 | 保留 delivery key；只在提交后调用；伪时钟测试 |
| 设置 UI | 重复点击/误确认 | AlertDialog、忙碌锁、取消零写入测试 |

## 完成定义

- PRD 全部验收项通过并有自动化证据。
- 合法 v1 备份可在干净或非空当前数据库中完整整库恢复。
- 所有非法或故障路径保持恢复前数据库逐表不变。
- 恢复后页面数据和提醒运行时与恢复内容一致。
- 全量质量门禁通过，规范和 README 已同步，代码已提交且任务记录完整。
