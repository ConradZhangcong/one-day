# Ant Design 5 升级到 6 说明

## 升级内容

### 1. 依赖更新

已更新以下依赖到版本 6：
- `antd`: `^5.21.0` → `^6.0.0`
- `@ant-design/icons`: `^5.4.0` → `^6.0.0`

### 2. 代码调整

#### App.tsx
- 添加了 `theme` 导入，支持主题算法切换
- 在 `ConfigProvider` 中配置了主题算法（支持暗色/亮色模式）
- 配置了 Design Token（主色调、圆角等）

### 3. 主要变更说明

#### 性能优化
- Ant Design 6 进一步优化了 CSS-in-JS 引擎
- 减少了大规模组件渲染时的样式计算延迟

#### 主题系统
- 使用 `theme.algorithm` 来切换亮色/暗色主题
- Design Token 类型检查更加严格
- 支持通过 `ConfigProvider` 的 `theme.token` 自定义主题变量

#### 兼容性
- 需要 React 18+（项目已满足）
- 不再支持 IE 浏览器
- 支持现代浏览器（Chrome 90+, Edge 91+, Firefox 78+, Safari 14+）

### 4. 迁移检查清单

- [x] 更新 package.json 依赖版本
- [x] 更新 ConfigProvider 主题配置
- [x] 检查组件 API 使用（当前代码已符合 v6 规范）
- [ ] 运行自动迁移工具（可选）：`npx @ant-design/codemod-v6`
- [ ] 视觉回归测试（检查样式是否正确渲染）
- [ ] 功能测试（确保所有功能正常工作）

### 5. 后续建议

1. **运行自动迁移工具**（可选）：
   ```bash
   npx @ant-design/codemod-v6
   ```

2. **测试主题切换功能**：
   - 在设置页面切换亮色/暗色主题
   - 检查所有页面的样式是否正确

3. **检查控制台警告**：
   - 升级后运行项目，检查是否有 Design Token 相关的 TypeScript 错误或控制台警告
   - 如有非标准 Token，需要调整为 v6 支持的 Token

4. **性能测试**：
   - 测试大量数据渲染时的性能表现
   - 对比升级前后的性能差异

### 6. 已知问题

暂无已知问题。如遇到问题，请参考：
- [Ant Design 6 官方迁移指南](https://ant.design/docs/react/migration-v6)
- [Ant Design GitHub Issues](https://github.com/ant-design/ant-design/issues)

