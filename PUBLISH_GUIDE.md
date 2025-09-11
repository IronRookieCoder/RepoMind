# RepoMind 发布指南

## 发布准备清单

### 1. 预发布检查

```bash
# 检查代码质量
npm run lint
npm run format

# 检查TypeScript类型
npx tsc --noEmit

# 运行发布准备脚本
npm run prepare-release
```

### 2. 版本管理

```bash
# 更新版本号（patch/minor/major）
npm version patch   # 1.0.0 -> 1.0.1
npm version minor   # 1.0.0 -> 1.1.0  
npm version major   # 1.0.0 -> 2.0.0

# 手动更新版本号
# 编辑 package.json 中的 version 字段
```

### 3. 构建和测试

```bash
# 构建项目
npm run build

# 测试CLI工具
node dist/bin/cli.js --version
node dist/bin/cli.js --help

# 测试基本功能
node dist/bin/cli.js generate --help
```

### 4. 预览发布内容

```bash
# 生成发布包（不实际发布）
npm pack

# 预览发布内容
npm publish --dry-run
```

### 5. 发布到npm

```bash
# 登录npm（如果未登录）
npm login

# 发布到npm
npm publish

# 发布为beta版本
npm publish --tag beta

# 发布为指定版本
npm publish --tag next
```

## 发布后验证

### 1. 验证npm包

```bash
# 搜索包
npm search @repomind/core

# 查看包信息
npm view @repomind/core

# 查看包文件
npm view @repomind/core files
```

### 2. 测试安装

```bash
# 全局安装测试
npm install -g @repomind/core
repomind --version
repomind --help

# 卸载测试
npm uninstall -g @repomind/core

# npx测试
npx @repomind/core --version
npx @repomind/core --help
```

### 3. 功能测试

```bash
# 创建测试目录
mkdir test-repomind
cd test-repomind
npm init -y

# 测试生成功能
npx @repomind/core generate
ls -la .repomind/

# 测试其他命令
npx @repomind/core info
npx @repomind/core validate
npx @repomind/core clean
```

## 发布流程自动化

### 1. GitHub Actions发布

创建 `.github/workflows/publish.yml`:

```yaml
name: Publish to NPM

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          registry-url: 'https://registry.npmjs.org'
          
      - name: Install dependencies
        run: npm install
        
      - name: Run tests and build
        run: |
          npm run lint
          npm run build
          npm run prepare-release
          
      - name: Publish to NPM
        run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### 2. 发布脚本

创建发布脚本 `scripts/release.sh`:

```bash
#!/bin/bash
set -e

echo "🚀 开始发布流程..."

# 检查工作区是否干净
if [ -n "$(git status --porcelain)" ]; then
  echo "❌ 工作区有未提交的更改，请先提交"
  exit 1
fi

# 运行测试和构建
npm run lint
npm run build
npm run prepare-release

# 获取当前版本
VERSION=$(node -p "require('./package.json').version")
echo "📦 当前版本: $VERSION"

# 确认发布
read -p "确认发布版本 $VERSION 到npm？ [y/N] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ 发布已取消"
  exit 1
fi

# 发布到npm
npm publish

echo "✅ 发布完成！"
echo "🔗 查看包信息: https://www.npmjs.com/package/@repomind/core"
```

## 版本规划

### 版本号规则（遵循Semantic Versioning）

- **MAJOR版本**（x.0.0）：不兼容的API修改
- **MINOR版本**（x.y.0）：新增功能，向后兼容
- **PATCH版本**（x.y.z）：问题修复，向后兼容

### 发布计划

- **v1.0.x**: 稳定版本，bug修复
- **v1.1.0**: 增量更新功能
- **v1.2.0**: MCP服务器集成
- **v2.0.0**: 多仓库关联功能

## 常见问题

### 1. 发布权限问题

```bash
# 检查登录状态
npm whoami

# 检查包权限
npm owner ls @repomind/core

# 添加维护者
npm owner add <username> @repomind/core
```

### 2. 版本冲突

```bash
# 如果版本已存在，需要更新版本号
npm version patch
npm publish
```

### 3. 构建失败

```bash
# 清理并重新构建
rm -rf dist node_modules
npm install
npm run build
```

## 监控和维护

### 1. npm包统计

- 访问 https://www.npmjs.com/package/@repomind/core
- 查看下载量、版本历史等信息

### 2. 用户反馈

- 监控GitHub Issues
- 响应用户问题和建议
- 及时修复bug并发布补丁版本

### 3. 依赖更新

```bash
# 检查过时的依赖
npm outdated

# 更新依赖
npm update

# 检查安全漏洞
npm audit
npm audit fix
```