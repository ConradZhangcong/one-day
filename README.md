# One-Day

## 开发环境

- node 20.11.0
- pnpm 8.15.1

## 项目构建流程

### 使用[vite](https://vitejs.dev/guide/)初始化项目

```bash
pnpm create vite one-day --template react-ts
```

### 使用[shadcn-ui](https://ui.shadcn.com/docs/installation/vite)初始化ui组件库

(1) 安装`Tailwind`并初始化

```bash
pnpm add -D tailwindcss postcss autoprefixer
pnpm dlx tailwindcss init -p
```

(2) 修改`tsconfig.json`

`tsconfig.json`文件中添加以下配置:

```json
{
  "compilerOptions": {
    // ...
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
    // ...
  }
}
```

(3) 更新`vite.config.ts` 配置别名

```bash
pnpm install @types/node -D
```

```ts
// 引入path
import path from "path";

export default defineConfig({
  // ...
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // ...
});
```

(4) 使用`shadcn-ui`脚手架生成配置

```bash
pnpm dlx shadcn-ui@latest init
```

```log
✔ Would you like to use TypeScript (recommended)? … yes
✔ Which style would you like to use? › New York
✔ Which color would you like to use as base color? › Zinc
✔ Where is your global CSS file? … src/styles/global.css
✔ Would you like to use CSS variables for colors? … yes
✔ Are you using a custom tailwind prefix eg. tw-? (Leave blank if not) … tw-
✔ Where is your tailwind.config.js located? … tailwind.config.js
✔ Configure the import alias for components: … @/components
✔ Configure the import alias for utils: … @/lib/utils
✔ Are you using React Server Components? … no
✔ Write configuration to components.json. Proceed? … yes
```

### 增加[stylelint](https://stylelint.io/)

```bash
# 初始化stylelint
pnpm create stylelint
```

会自动安装`stylelint`和`stylelint-config-standard`, 并且生成`.stylelintrc.json`配置文件

`rules`配置参考[`stylelint`官网](https://stylelint.io/user-guide/rules)

### 配置支持`tailwindcss`

`rules`中新增配置

```ts
export default {
  // ...
  rules: {
    // ...
    // tailwindcss
    "at-rule-no-unknown": [
      true,
      {
        ignoreAtRules: [
          "tailwind",
          "apply",
          "variants",
          "responsive",
          "screen",
        ],
      },
    ],
    // ...
  },
};

```

## 公共方法


## React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type aware lint rules:

- Configure the top-level `parserOptions` property like this:

```js
export default {
  // other rules...
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: ['./tsconfig.json', './tsconfig.node.json'],
    tsconfigRootDir: __dirname,
  },
}
```

- Replace `plugin:@typescript-eslint/recommended` to `plugin:@typescript-eslint/recommended-type-checked` or `plugin:@typescript-eslint/strict-type-checked`
- Optionally add `plugin:@typescript-eslint/stylistic-type-checked`
- Install [eslint-plugin-react](https://github.com/jsx-eslint/eslint-plugin-react) and add `plugin:react/recommended` & `plugin:react/jsx-runtime` to the `extends` list
