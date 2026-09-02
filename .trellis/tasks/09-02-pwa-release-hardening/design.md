# PWA 与发布加固技术设计

## 1. 边界与原则

本任务不增加业务能力，而是为现有 Web/PWA 建立可重复的发布证据。业务事实继续保存在 IndexedDB；Service Worker 只缓存静态应用外壳，不缓存或复制领域数据。安装、通知和 Service Worker 能力均按浏览器支持渐进增强。

验证分为三层：构建产物静态契约、跨浏览器核心 Web 流程、Chromium PWA 生命周期。Playwright 官方仅在 Chromium 暴露 Service Worker worker 级观测，因此 Firefox/WebKit 不伪造同等 PWA 断言，只验证核心 Web 流程、响应式与降级行为。

## 2. 构建与安装契约

### Manifest

在 `vite.config.ts` 中固定稳定的 `id`、`scope`、`start_url`、`display`、语言、主题色和背景色。使用现有 One Day 标志生成并提交：

- 192×192 普通 PNG；
- 512×512 普通 PNG；
- 512×512 独立 maskable PNG，主体位于中心安全区；
- 180×180 Apple touch icon；
- 保留 SVG favicon。

不再使用单一图标同时声明 `any maskable`。Vite PWA 官方建议将普通与 maskable 用途拆开；Chromium 安装条件要求至少 192 和 512 图标。`index.html` 增加 Apple touch icon，manifest 与 HTML 的颜色配置保持一致。

### 构建产物验证

新增只读 Node 验证脚本，针对已生成的 `dist/` 检查：

- manifest 可解析、必要字段及图标声明正确；
- 图标文件存在、PNG 尺寸和类型正确；
- `index.html` 引用 manifest、注册脚本与必要 meta；
- `sw.js`、Workbox 文件和导航回退预缓存存在；
- 所有 manifest 图标都进入发布产物。

脚本失败返回非零退出码，并通过 `test:pwa` 组合为 `build -> verify artifacts`，CI 与本地复用同一命令。

## 3. E2E 分层

### 核心 Web smoke（五项目）

建立共享页面对象/辅助函数，通过可访问角色和中文标签完成：

1. 打开收件箱并创建仅标题任务；
2. 打开任务详情，添加计划时间并保存；
3. 在今天页找到并完成任务；
4. 打开议程日历确认同一事实来源；
5. 验证无未处理页面错误和关键控制可访问名称。

该套件运行 Chromium、Firefox、WebKit、Pixel 7、iPhone 15 项目。每个测试使用隔离浏览器上下文和唯一标题，不依赖执行顺序。

### Chromium PWA 生命周期

单独建立 Chromium-only 项目或注解套件，并保持 Service Worker 为 `allow`：

1. 在线打开生产预览，等待注册、激活和 `navigator.serviceWorker.controller`；
2. 通过 UI 创建持久数据；
3. `browserContext.setOffline(true)` 后关闭页面并重新打开深层路由；
4. 验证应用外壳、已有 IndexedDB 数据、离线创建/完成以及日历读取；
5. 恢复联网后确保无数据回放或重复写入。

Service Worker 测试不使用会遮蔽 worker 请求的 route 拦截。升级提示的状态机通过组件测试注入 `needRefresh` 和 `updateServiceWorker`：提示出现不触发刷新，只有点击操作才以 `true` 调用更新；关闭提示只清除本次 UI 状态。生产预览再做一次手工/浏览器证据检查。

## 4. 无障碍与响应式门禁

自动化覆盖：

- 仅键盘完成快速新增、导航、任务详情保存和完成；
- `:focus-visible` 控件有非透明轮廓/阴影；
- Android/iOS 等效视口无水平页面溢出，固定导航不遮挡主要操作；
- 根字号放大到 200% 后核心工作流仍可操作且无双向滚动陷阱；
- `colorScheme: light/dark` 下关键页面可读；
- 逾期、错过、截止和完成状态均有文本或图标语义，不只依赖颜色。

对浏览器无法可靠自动判断的视觉质量，保存检查清单和必要截图证据；不把截图快照作为业务断言。

## 5. 性能基准

新增显式基准脚本而不是把严格耗时断言混入普通单元测试。固定两个数据集：

- 2,000 个普通任务，混合无日期、全天计划、精确计划、截止和完成状态；
- 200 个长期重复系列，查询 366 天范围并包含 weekly/monthly/yearly 规则。

每个场景预热一次、执行至少五次并取中位数，记录 Node/浏览器版本和数据规模。初始门槛以当前代码基线为依据，采用足够抵抗共享 CI 抖动的预算：应用快照与 14 天查询中位数各不超过 1 秒，366 天重复范围投影中位数不超过 2 秒，移动视口首个可交互核心页面不超过 3 秒。实现阶段先记录基线；若基线超限，优化查询/投影，不通过放宽门槛解决。

## 6. 发布证据与真机门禁

新增 `docs/release-checklist.md`，记录命令、自动化矩阵、浏览器能力差异、离线步骤、性能结果和未完成真机项。真实 Android Chrome 与 iOS Safari/PWA 分别要求安装、主屏启动、离线重启、通知权限与备份恢复，但本任务只交付可执行清单，不声称完成实际设备验证。

README 只链接发布检查，不增加装饰性宣传文案。数据丢失和提醒限制继续保留在设置页，因为它们影响用户决策。

## 7. 兼容、风险与回滚

- 图标变更只增加静态资产和 manifest 声明，不修改现有 logo 源文件。
- Workbox 配置保持 `generateSW` 与 prompt 更新策略；若离线测试暴露导航缓存问题，只调整静态路由策略，不缓存 IndexedDB 数据或 API 响应。
- E2E 可能暴露跨浏览器真实缺陷；只修复阻断 MVP 核心流程的问题，产品范围变化返回规划。
- 性能优化必须保持共享 recurrence projector 与 repository decoder，不引入旁路缓存作为第二事实来源。
- 任一 PWA 配置回归可回退对应 manifest/Workbox 提交；新增测试和发布检查保留用于防止重现。

## 8. 官方依据

- Vite PWA minimal requirements: https://vite-pwa-org.netlify.app/guide/pwa-minimal-requirements
- Vite PWA React update prompt: https://vite-pwa-org.netlify.app/frameworks/react
- MDN installability: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable
- Playwright BrowserContext offline/Service Worker APIs: https://playwright.dev/docs/api/class-browsercontext
- Playwright network and Service Worker caveat: https://playwright.dev/docs/network
