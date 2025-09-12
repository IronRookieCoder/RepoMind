# RepoMind 知识库生成 Prompt 索引

## 概述

本目录包含了RepoMind系统用于生成单仓库知识库的简化Prompt文档集合。所有Agent基于同一份源代码进行不同维度的独立分析，支持并行执行。

## 文档结构

### 通用指导与任务模板
- **[common-analysis-guide.md](./common-analysis-guide.md)** - 所有Agent共享的分析原则和输出要求
- **[unified-analysis-tasks.md](./unified-analysis-tasks.md)** - 统一分析任务的执行模板

### 分析Agent列表

| Agent | 文件 | 职责 |
|-------|------|------|
| 项目概览 | [overview-analysis.md](./overview-analysis.md) | 提取项目基础信息、技术栈、目录结构和核心功能 |
| 系统架构与组件 | [system-architecture-analysis.md](./system-architecture-analysis.md) | 识别架构模式、核心组件及其依赖关系 |
| API接口与数据模型 | [api-reference-analysis.md](./api-reference-analysis.md) | 识别API端点、请求响应格式及数据结构定义 |
| 业务流程 | [business-workflows-analysis.md](./business-workflows-analysis.md) | 识别业务逻辑执行路径和数据处理流程 |

## 执行方式

### 1. 并行执行
所有Agent可以并行执行，因为它们都基于同一份完整源代码进行独立分析。

### 2. 输出结构
执行后生成以下知识库结构：
```
.repomind/
├── knowledge.yaml              # 结构化知识库索引
├── docs/                       # 维基式文档目录
│   ├── overview.md            # 项目概览
│   ├── system-architecture.md # 系统架构与组件设计
│   ├── api-reference.md       # API接口与数据模型
│   └── business-workflows.md  # 业务流程
└── meta/                       # 元数据目录
    ├── repo-info.yaml         # 仓库信息
    └── generation-log.yaml     # 生成日志
```

## 设计原则

- **简化优先**：去除冗余模板，专注核心分析
- **智能分析**：使用Claude Code的智能理解能力
- **结构化输出**：标准化Markdown格式和Mermaid图表
- **质量保证**：确保准确性、完整性和实用性

## 参考资料

- [单仓库知识库规范](../standard/single-repo-knowledge-spec.md)
- [通用分析指导](./common-analysis-guide.md)