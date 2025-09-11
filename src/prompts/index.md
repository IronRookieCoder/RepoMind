# RepoMind 知识库生成 Prompt 索引

## 概述

本目录包含了RepoMind系统用于生成单仓库知识库的简化Prompt文档集合。所有Agent基于同一份源代码进行不同维度的独立分析，支持并行执行。

## 文档结构

### 通用指导
- **[common-analysis-guide.md](./common-analysis-guide.md)** - 所有Agent共享的分析原则和输出要求

### 分析Agent列表

| Agent | 文件 | 职责 |
|-------|------|------|
| 项目概览 | [overview-analysis.md](./overview-analysis.md) | 分析项目整体特征，提供概览信息 |
| 系统架构 | [architecture-analysis.md](./architecture-analysis.md) | 分析架构设计，识别模式和分层 |
| 组件设计 | [components-analysis.md](./components-analysis.md) | 分析组件实现，识别关系和模式 |
| API接口 | [apis-analysis.md](./apis-analysis.md) | 发现和分析API接口设计 |
| 数据模型 | [data-models-analysis.md](./data-models-analysis.md) | 分析数据结构，识别实体关系 |
| 业务流程 | [workflows-analysis.md](./workflows-analysis.md) | 分析业务流程，识别关键流程 |
| 依赖关系 | [dependencies-analysis.md](./dependencies-analysis.md) | 分析模块依赖，识别依赖结构 |

## 执行方式

### 1. 并行执行
所有Agent可以并行执行，因为它们都基于同一份完整源代码进行独立分析。

### 2. 输出结构
执行后生成以下知识库结构：
```
.repomind/
├── knowledge.yaml          # 结构化知识库索引
├── docs/                   # 维基式文档目录
│   ├── overview.md        # 项目概览
│   ├── architecture.md    # 系统架构
│   ├── components.md      # 组件设计
│   ├── apis.md            # API接口
│   ├── data-models.md     # 数据模型
│   ├── workflows.md       # 业务流程
│   └── dependencies.md    # 依赖关系
└── meta/                   # 元数据目录
    ├── repo-info.yaml     # 仓库信息
    └── generation-log.yaml # 生成日志
```

## 设计原则

- **简化优先**：去除冗余模板，专注核心分析
- **智能分析**：使用Claude Code的智能理解能力
- **结构化输出**：标准化Markdown格式和Mermaid图表
- **质量保证**：确保准确性、完整性和实用性

## 参考资料

- [单仓库知识库规范](../standard/single-repo-knowledge-spec.md)
- [通用分析指导](./common-analysis-guide.md)