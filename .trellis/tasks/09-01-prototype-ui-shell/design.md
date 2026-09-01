# 应用外壳与视觉技术设计

## Architecture

- 使用官方 Vite 现有项目路径接入 Tailwind CSS v4 与 shadcn CLI 配置，生成 `components.json`、`src/lib/utils.ts` 和所需 `src/components/ui/*`。
- shadcn 使用默认 Base UI 基础与 neutral 主题；产品需要的 Button、Input、Textarea、Select、Card、Badge、Tabs、Sheet、Dialog、AlertDialog、Alert、Progress、Skeleton、Empty、Tooltip、Popover、Calendar、Toast/Sonner 等均从本地 UI primitive 组合。
- `AppShell` 管理桌面侧栏收起的瞬时 UI 状态；业务页面仍由 React Router 的 `Outlet` 提供。
- 导航定义集中为 typed configuration，避免桌面与移动重复硬编码文案、路径和图标。
- 全局快速新增入口通过路由/轻量共享状态打开统一创建表单；TodoPage 的业务提交仍调用 TodoService。
- 全局 provider 只保留路由/业务运行时与 shadcn toast；移除 Ant Design ConfigProvider/App provider。
- `lucide-react` 替换 `@ant-design/icons`，统一尺寸由组件 class 控制。

## Visual Tokens

- 背景 `#f8fafc/#fafafa`，卡片白色，前景近黑，边框 `#e2e8f0`，muted 使用 slate 中性色。
- 圆角以 8–12px 为主，阴影轻量；选中态用近黑底/白字或白底/黑字，不使用装饰性渐变。
- 导航图标 18–20px，图标容器 32px；状态同时使用文案或形状。

## Responsive Behavior

- ≥ 1040px：完整或收起侧栏；主内容最大宽度由页面控制。
- 721–1039px：窄侧栏/简化内容列。
- ≤ 720px：侧栏转底部导航，品牌与辅助文案隐藏，主内容增加安全区底部留白。
- 日历自身的窄屏行为由 calendar 子任务负责。

## Compatibility

- 不改变 route URL 和现有 application service 调用。
- 避免重命名测试依赖的 aria-label；需要调整时同步语义测试。
- `prefers-color-scheme` 深色支持保留，但首先确保原型定义的浅色主题一致。
- 对话框、Sheet、Select、Popover 必须保留焦点圈定、Escape 关闭、aria title/description 等 primitive 可访问行为。
