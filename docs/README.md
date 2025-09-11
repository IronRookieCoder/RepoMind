# RepoMind - 基于Claude Code的代码仓库知识系统

## 项目概述

RepoMind是一个基于Claude Code SDK构建的智能代码仓库知识管理系统。它能够自动分析代码仓库，生成结构化的维基式文档，并提供跨仓库的智能检索能力。

## 核心特性

- **深度代码理解**: 利用Claude Code的语义分析能力，而非简单的文本处理
- **自动化知识生成**: 完全自动化的知识库构建pipeline
- **实时同步更新**: Git集成确保知识库与代码始终同步
- **跨仓库智能检索**: 基于语义理解的多仓库关联查询
- **MCP协议集成**: 无缝集成到Claude Code工作流
- **生产级可靠性**: 内置错误处理、监控和CI/CD支持

## 技术架构

### 系统组件

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Git Webhook   │───▶│  Knowledge       │───▶│   远端仓库       │
│   触发器        │    │  Builder Agent   │    │   .deepwiki/    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Claude Code   │───▶│  结构化知识      │───▶│   多仓库        │
│   SDK Engine    │    │  生成与存储      │    │   关系图谱      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### 核心技术栈

- **Claude Code SDK**: 基于Claude Code的TypeScript/Python SDK支持
- **代码分析工具**: Claude Code内置Read、Glob、Grep等工具
- **Git集成**: Webhook触发和自动化提交
- **MCP协议**: Model Context Protocol扩展
- **知识存储**: 结构化YAML + Markdown文档（内嵌Mermaid图表）
- **CI/CD集成**: GitHub Actions / GitLab CI

## 知识库结构

```
.repomind/
├── knowledge.yaml       # 核心知识数据
├── docs/
│   ├── overview.md      # 项目概览
│   ├── architecture.md  # 架构文档（内嵌mermaid图表）
│   ├── components.md    # 组件文档（内嵌组件关系图）
│   ├── apis.md          # API文档
│   ├── data-models.md   # 数据模型（内嵌ERD图）
│   ├── workflows.md     # 业务流程（内嵌工作流图）
│   └── dependencies.md  # 依赖关系（内嵌依赖图）
└── meta/
    ├── repo-info.yaml         # 仓库基础信息
    ├── analysis-config.yaml   # 分析配置记录
    ├── generation-log.yaml    # 生成过程日志
    └── repo-relationships.yaml # 多仓库关联关系
```

## 快速开始

### 1. 安装依赖

```bash
# 安装Claude Code SDK
npm install @anthropic/claude-code-sdk
# 或者使用Python SDK
pip install claude-code-sdk

# 安装RepoMind构建器
npm install @company/repomind-builder
```

### 2. 配置项目

```javascript
// repomind.config.js
export default {
  repositories: {
    include: ['src/**', 'lib/**'],
    exclude: ['node_modules', 'dist']
  },
  analysis: {
    depth: 'deep',
    includeTests: true,
    generateGraphs: true
  },
  output: {
    format: 'wiki',
    language: 'zh-CN'
  },
  claudeCode: {
    // Claude Code SDK 配置
    sessionOptions: {
      tools: ['read', 'glob', 'grep', 'bash'],
      systemPrompt: '你是一个代码分析专家',
      maxMessages: 100
    },
    caching: {
      enabled: true,
      ttl: 3600
    }
  }
};
```

### 3. 生成知识库

```bash
# 本地生成
npx repomind-builder analyze --repo . --output .repomind/

# 或通过Git Webhook自动触发
```

### 4. 集成到CI/CD

```yaml
# .github/workflows/knowledge-update.yml
name: Knowledge Base Update
on:
  push:
    branches: [main, develop]
    
jobs:
  update-knowledge:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Update Knowledge Base
        run: npx repomind-builder analyze --repo . --output .repomind/
```

## 使用场景

### 1. 开发过程中的代码理解
- 新团队成员快速了解项目结构
- 代码review时理解变更影响范围
- 重构时分析依赖关系

### 2. 跨团队协作
- 服务间API接口文档自动更新
- 数据流向和业务流程可视化
- 技术债务和架构演进追踪

### 3. 知识传承和文档维护
- 自动生成和维护技术文档
- 项目知识的结构化存储
- 历史决策和架构变更记录

## 文档目录

- [技术架构详细设计](./architecture.md)
- [实施计划和里程碑](./implementation-plan.md)
- [API参考和代码示例](./api-reference.md)
- [部署和运维指南](./deployment.md)

## 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交变更
4. 推送到分支
5. 创建 Pull Request

## 许可证

MIT License