# RepoMind 发布检查清单

## 发布前检查 ✅

### 代码质量
- [ ] 运行 `npm run lint` 无错误
- [ ] 运行 `npm run format` 代码格式化
- [ ] TypeScript编译无错误 `npx tsc --noEmit`
- [ ] 所有TODO和FIXME已处理

### 功能测试
- [ ] 运行 `npm run test-cli` 所有CLI测试通过
- [ ] 手动测试核心功能
  - [ ] `repomind generate` 能正常生成知识库
  - [ ] `repomind info` 显示项目信息
  - [ ] `repomind validate` 验证知识库质量
  - [ ] `repomind clean` 清理功能正常

### 构建验证
- [ ] 运行 `npm run build` 构建成功
- [ ] `dist/` 目录包含所有必要文件
  - [ ] `dist/index.js` 和 `dist/index.d.ts`
  - [ ] `dist/bin/cli.js`
  - [ ] 所有Agent文件已编译
- [ ] 运行 `node dist/bin/cli.js --version` 正常

### 文档检查
- [ ] README.md 内容准确完整
- [ ] 安装和使用说明正确
- [ ] 示例代码可以运行
- [ ] CHANGELOG.md 已更新

### 包配置
- [ ] package.json 版本号正确
- [ ] package.json 的 main、bin、files 字段正确
- [ ] .npmignore 配置合理
- [ ] 关键词和描述准确

### 依赖检查
- [ ] package.json 中的依赖项都是必要的
- [ ] 没有开发依赖泄露到生产依赖
- [ ] 运行 `npm audit` 无严重安全问题

## 发布流程 🚀

### 1. 版本更新
```bash
# 根据变更类型选择版本更新方式
npm version patch  # bug修复
npm version minor  # 新功能
npm version major  # 破坏性变更
```

### 2. 最终构建测试
```bash
npm run prepare-release
```

### 3. 预览发布内容
```bash
npm publish --dry-run
```

### 4. 发布到npm
```bash
npm publish
```

## 发布后验证 ✅

### npm包验证
- [ ] 在 https://www.npmjs.com/package/@repomind/core 查看包信息
- [ ] 版本号正确显示
- [ ] 文档和README正确显示

### 安装测试
- [ ] 全局安装: `npm install -g @repomind/core`
- [ ] 命令可用: `repomind --version`
- [ ] 基本功能: `repomind generate --help`

### npx测试
- [ ] `npx @repomind/core --version` 正常
- [ ] `npx @repomind/core generate --help` 正常

### 功能验证
在全新环境中测试：
- [ ] 创建测试项目
- [ ] 运行 `npx @repomind/core generate`
- [ ] 检查生成的 `.repomind/` 目录
- [ ] 验证生成的文档质量

## 发布通知 📢

### 内部通知
- [ ] 更新内部文档
- [ ] 通知团队成员
- [ ] 记录发布日志

### 外部通知（如适用）
- [ ] 更新项目主页
- [ ] 发布博客文章
- [ ] 社交媒体宣传

## 问题处理 🔧

如果发布后发现问题：

### 紧急修复
```bash
# 快速修复并发布补丁
npm version patch
# 修复代码
npm run prepare-release
npm publish
```

### 撤回版本（24小时内）
```bash
npm unpublish @repomind/core@版本号 --force
```

### 废弃版本
```bash
npm deprecate @repomind/core@版本号 "版本有问题，请使用最新版本"
```

## 版本历史跟踪

记录每次发布的重要信息：

| 版本 | 发布日期 | 主要变更 | 发布者 |
|------|----------|----------|--------|
| 1.0.0 | 2024-09-10 | 初始发布 | RepoMind Team |
| | | | |

---

**注意事项：**
- 在工作时间发布，以便及时处理问题
- 保持发布节奏，避免频繁发布
- 每次发布前都要完整测试
- 重大变更要提前通知用户