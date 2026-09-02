# PWA 与发布加固实施计划

## Phase 0 — 开发前门禁

- [x] 用户审核并明确批准 PRD、技术设计和本实施计划。
- [x] 运行 `task.py start`，确认基线提交 `fb26dad` 和干净工作树。
- [x] 使用 `trellis-before-dev` 加载前端、测试和跨层规范。
- [x] 确认年视图、真机执行、账号/云同步/Web Push 和新业务能力均不在实现范围。

## Phase 1 — 安装资产与构建契约

- [x] 从现有 One Day 标志确定性生成 192/512 普通 PNG、512 maskable PNG 和 180 Apple touch icon，不修改 logo 源文件。
- [x] 完善 manifest 的 id/scope/start_url/display/colors 和分离的 any/maskable 图标声明。
- [x] 补齐 HTML favicon、Apple touch icon、描述和主题色契约。
- [x] 新增 `scripts/verify-pwa-build.mjs`，验证 manifest、PNG 尺寸、产物引用、Service Worker 与导航回退预缓存。
- [x] 新增 `test:pwa` 脚本并证明篡改关键字段/删除资产时验证会失败。

回滚点：安装资产和 manifest 独立成提交；出现平台兼容问题可回退配置而保留验证脚本。

## Phase 2 — 跨浏览器核心 E2E

- [x] 建立 `tests/e2e/` 共享 helper，按 UI 清理/隔离 IndexedDB，禁止用实现细节直接伪造成功状态。
- [x] 编写创建—安排—今天—完成—日历一致性的核心 smoke。
- [x] 配置五个现有 Playwright 项目稳定运行，收集失败 trace/screenshot，避免共享端口和测试数据冲突。
- [x] 捕获 `pageerror`/未预期 console error；为浏览器能力差异使用显式条件和原因。
- [x] 添加深层路由刷新、后退/前进和应用错误边界基础检查。

回滚点：每个浏览器项目保持相同业务断言；若某引擎存在平台限制，只收窄平台专属断言，不删除核心 smoke。

## Phase 3 — PWA 离线与升级生命周期

- [x] 新增 Chromium-only Service Worker fixture，等待 active/controller 而非固定 sleep。
- [x] 覆盖在线安装外壳、持久数据、切换离线、关闭页面、深层路由重启和离线读写。
- [x] 验证重新联网后数据没有丢失、重复或回滚。
- [x] 为 `PwaUpdatePrompt` 添加可控模块 mock，验证提示、关闭和用户点击更新行为。
- [x] 在生产预览通过浏览器面板/自动检查复核 manifest、控制中的 worker 和离线导航。

回滚点：保持 `registerType: 'prompt'`；不得用 auto-update 绕过升级测试。

## Phase 4 — 无障碍、主题与移动布局

- [x] 用键盘完成快速新增、导航、详情保存与完成，断言焦点顺序和可见焦点。
- [x] 在 Pixel 7/iPhone 15 等效视口检查无页面级水平溢出、底部导航不遮挡操作。
- [x] 在 200% 根字号下重跑核心流程并检查对话框、表单和日历可滚动可操作。
- [x] 在浅色/深色模式检查关键控件和非颜色状态表达。
- [x] 修复发现的可访问性/响应式阻断问题，并补最小回归测试。

## Phase 5 — 性能基准与发布证据

- [x] 创建确定性大数据夹具：2,000 普通任务和 200 长期重复系列。
- [x] 记录快照、14 天查询、366 天重复投影和移动首屏基线；预热后五次取中位数。
- [x] 达到 1 秒/1 秒/2 秒/3 秒预算；超限时通过 profile 定位并优化共享查询或 projector。
- [x] 新增 `docs/release-checklist.md`，记录自动证据、命令、性能环境/结果和真实 Android/iOS 待执行项。
- [x] 更新 README 链接和当前 MVP 状态，不增加装饰性提示文案。

## Phase 6 — 全量发布门禁

- [ ] 运行 `pnpm format:check`、`pnpm lint`、`pnpm typecheck`、`pnpm test:run`、`pnpm test:pwa`、`pnpm test:e2e`、`pnpm build`。
- [ ] 对照 AC10、AC11、AC15、AC16 和本任务验收标准逐项留证。
- [ ] 使用 `trellis-check` 检查规范、跨浏览器降级、Service Worker 生命周期、无障碍和性能证据。
- [ ] 使用 `trellis-update-spec` 记录稳定 PWA 发布与离线验收契约。
- [ ] 提交实现，归档任务并执行 `trellis-finish-work`。

## 风险文件与检查

| 范围 | 风险 | 检查 |
|---|---|---|
| `vite.config.ts` / `index.html` | 安装条件或缓存版本失效 | 构建产物验证 + Chromium Application 检查 |
| `public/` 图标 | mask 裁剪、透明背景、尺寸错误 | PNG 尺寸验证 + safe-zone 视觉检查 |
| `playwright.config.ts` | 浏览器能力误判、测试互相污染 | 独立 context + 项目级条件 + trace |
| 离线 E2E | worker 未控制就断网导致假失败 | 等待 active/controller，禁止固定 sleep |
| 性能门禁 | CI 抖动或夹具失真 | 预热、五次中位数、固定规模和环境记录 |

## 完成定义

- 自动化构建、跨浏览器核心流程、Chromium 离线重启、升级提示、无障碍/响应式与性能门禁全部通过。
- 发布检查文档清楚区分自动化、桌面浏览器证据与尚未执行的 Android/iOS 真机门禁。
- 不引入年视图或其他延期功能，不夸大浏览器关闭后的提醒能力。
