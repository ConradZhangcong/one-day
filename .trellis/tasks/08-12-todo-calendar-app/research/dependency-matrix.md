# 第一版依赖兼容矩阵

> 核验日期：2026-08-13
> 依据：npm registry 最新稳定标签与各项目官方兼容说明。

## 本地工具链约束

当前 Codex 工作区提供 Node `24.14.0` 与 pnpm `11.16.0`。第一版先以该可复现环境为基线：

```json
{
  "packageManager": "pnpm@11.16.0",
  "engines": {
    "node": ">=24.14.0 <25",
    "pnpm": ">=11.16.0 <12"
  }
}
```

`jsdom@30` 要求 Node 24.15+，因此当前环境使用 `jsdom@29.1.1`；它支持 Node 24.0+，并与 Vitest 4 配合。升级工作区 Node 后可另行评估 jsdom 30，不在本任务中制造工具链漂移。

## 生产依赖

| 包 | 稳定线 | 说明 |
|---|---:|---|
| `react` / `react-dom` | 19.2.8 | 保持同版本 |
| `react-router` | 8.3.0 | 不安装已移除的 `react-router-dom`；`RouterProvider` 从 `react-router/dom` 导入 |
| `antd` | 6.6.0 | 原生支持 React 19 |
| `@ant-design/icons` | 6.3.2 | 应用直接导入图标时显式安装 |
| `@fullcalendar/react` | 7.0.2 | Standard 视图从 `/daygrid`、`/timegrid`、`/list`、`/interaction` 子路径导入 |
| `temporal-polyfill` | 1.0.3 | 满足 FullCalendar peer；领域层也统一使用，避免两套 Temporal 实现 |
| `dexie` / `dexie-react-hooks` | 4.4.4 / 4.4.0 | React live query 与 IndexedDB 事务 |
| `zod` | 4.4.3 | 表单、持久化和备份共用运行时边界 |

不要把仍停在 6.1.21 的旧 `@fullcalendar/core/daygrid/timegrid/list/interaction` 独立包与 v7 混装，也不要额外安装 `@js-temporal/polyfill`。

## 工程与测试依赖

- TypeScript `~6.0.3`：npm `latest` 已为 7.x，但 `typescript-eslint@8.67` 只支持 `<6.1`。
- Vite `^8.2.1`、`@vitejs/plugin-react@^6.0.5`、Vitest `^4.1.10`。
- `vite-plugin-pwa@^1.3.0`；Workbox 由插件管理，应用不直接依赖时不重复声明。
- ESLint `^10.8.1` + `@eslint/js` + `typescript-eslint@^8.67.0`，只使用 flat config。
- Testing Library React `^16.3.2`、DOM `^10.4.1`、user-event `^14.6.4`、jest-dom `^7.0.1`。
- `fake-indexeddb@^6.2.5`、`jsdom@^29.1.1`、`@playwright/test@^1.62.1`。
- Prettier `^3.9.6`；提交 `pnpm-lock.yaml` 固定实际解析结果。

## 官方依据

- [TypeScript ESLint 依赖版本](https://typescript-eslint.io/users/dependency-versions/)
- [React Router 变更记录](https://reactrouter.com/home/changelog)
- [FullCalendar v7 迁移说明](https://fullcalendar.io/docs/upgrading-from-v6)
- [FullCalendar React](https://fullcalendar.io/docs/react)
- [Vite 8 指南](https://v8.vite.dev/guide/)
- [vite-plugin-pwa](https://github.com/vite-pwa/vite-plugin-pwa)
- [Testing Library React](https://testing-library.com/docs/react-testing-library/intro/)
- [Playwright 安装要求](https://playwright.dev/docs/intro)
- [ESLint 10 迁移指南](https://eslint.org/docs/latest/use/migrate-to-10.0.0)
- [Ant Design 6 迁移指南](https://ant.design/docs/react/migration-v6-cn/)
- [Dexie React 教程](https://dexie.org/docs/Tutorial/React)
