# PWA 与发布加固

## Goal

把现有 One Day Web/PWA 从“已有 manifest、Service Worker 和升级提示”推进到可重复验收的 MVP 发布状态：首次在线加载后可离线重启并完成核心待办/日历流程，安装与升级行为可验证，桌面和移动视口的核心流程具备跨浏览器证据。

## Background

- 现有 `vite.config.ts` 使用 `vite-plugin-pwa` 的 `generateSW`、`registerType: 'prompt'`、导航回退和过期缓存清理，并只声明一个 `any maskable` SVG 图标。
- `PwaUpdatePrompt` 已提供显式升级操作，不会在编辑过程中自动强制刷新。
- `playwright.config.ts` 已配置 Chromium、Firefox、WebKit、Pixel 7 和 iPhone 15 五个项目，但 `tests/e2e/` 尚无用例。
- 备份与原子整库恢复已完成；设置页保留必要的数据丢失与浏览器限制提示。
- 历史产品决策已将“年视图”替换为“长期目标”，本任务不恢复年视图。

## Requirements

1. 生产构建必须生成可解析且字段完整的 manifest、Service Worker 和离线应用外壳；图标满足安装及 maskable 展示要求。
2. 首次在线访问并完成 Service Worker 控制后，断网重新打开深层路由仍可进入应用，已保存数据存在，并可完成至少创建、编辑/完成任务和浏览日历的核心流程。
3. 新版本可被检测并通过用户明确操作更新；不得在未确认时强制刷新或丢失当前编辑。
4. 建立 Playwright E2E，覆盖桌面 Chromium、Firefox、WebKit 以及 Android/iOS 等效移动视口；PWA 专属能力按浏览器实际支持渐进验收。
5. 核心流程支持键盘操作、可见焦点、200% 文字缩放、浅色/深色模式及非颜色状态表达；不得重新加入已删除的装饰性口号或页面副标题。
6. 建立大量普通任务和长期重复范围的可重复性能基准，记录数据规模、计时方法、阈值和结果，避免只凭主观体验声明性能达标。
7. README/发布验收文档明确支持边界、站点数据风险、备份入口、通知后台限制，以及自动化与真机证据的区别。
8. 本任务以自动化和可用的桌面真实浏览器证据作为完成门槛；真实 Android Chrome 与 iOS Safari/PWA 执行保留为发布前人工门禁，不得将移动视口模拟表述为真机验证。

## Acceptance Criteria

- [ ] `pnpm build` 后 manifest、图标、Service Worker、导航回退与缓存清理通过自动检查。
- [ ] Chromium 生产预览中，首次在线加载后断网重启 `/today`、`/calendar/agenda` 等深层路由成功，IndexedDB 数据仍可读写。
- [ ] 升级测试证明仅在用户点击后激活新 Service Worker 并刷新，取消/忽略不会中断当前页面。
- [ ] 五个 Playwright 项目均运行核心 smoke 流程；不支持完整 PWA API 的浏览器使用明确、可审计的能力分支而非伪造成功。
- [ ] 键盘、焦点、200% 文字缩放、浅/深色及移动宽度检查无阻断核心流程的问题。
- [ ] 性能基准在固定规模和环境下通过已批准阈值，并输出可复查结果；超限时有定位信息而非提高阈值掩盖。
- [ ] 格式、lint、类型检查、单元/组件/数据库测试、E2E、生产构建和 Trellis 复审全部通过。
- [ ] 发布文档不声称已完成本轮无法取得的真机证据，并列出仍需人工验证的 Android Chrome 与 iOS Safari/PWA 项目。

## Out of Scope

- 账号、云同步、服务端 Web Push、原生应用和应用商店发布。
- 外部日历集成、年视图或新的业务功能。
- 将浏览器/PWA 完全关闭后的本地提醒包装成可靠后台通知。
- 为通过测试而更改既有任务、重复、备份或时间语义。
