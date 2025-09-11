# 技术架构详细设计

## 系统概览

RepoMind采用分层架构设计，基于Claude Code SDK构建智能的代码知识管理系统。

### 架构图

```
                    ┌─ Claude Code SDK ─┐
                    │                   │
    ┌───────────────▼───────────────┐   │
    │        MCP 服务层            │   │
    │  ┌─────────────────────────┐  │   │
    │  │ RepoMind MCP Server     │  │   │
    │  │ - query_knowledge       │  │   │
    │  │ - analyze_relationships │  │   │
    │  │ - update_knowledge      │  │   │
    │  └─────────────────────────┘  │   │
    └───────────────┬───────────────┘   │
                    │                   │
    ┌───────────────▼───────────────┐   │
    │      智能检索和查询层         │   │
    │  ┌─────────────────────────┐  │   │
    │  │ CrossRepoQueryEngine    │  │   │
    │  │ - semanticQuery()       │  │   │
    │  │ - findRelevantRepos()   │  │   │
    │  │ - gatherKnowledge()     │  │   │
    │  └─────────────────────────┘  │   │
    └───────────────┬───────────────┘   │
                    │                   │
    ┌───────────────▼───────────────┐   │
    │      知识处理和生成层         │   │
    │  ┌─────────────────────────┐  │   │
    │  │ KnowledgeBuilderAgent   │  │   │
    │  │ - analyzeRepository()   │  │   │
    │  │ - generateKnowledgeBase │  │   │
    │  │ - detectChanges()       │  │   │
    │  └─────────────────────────┘  │   │
    │  ┌─────────────────────────┐  │   │
    │  │ RelationshipAgent       │  │   │
    │  │ - discoverRelations()   │  │   │
    │  │ - analyzeDepencies()    │  │   │
    │  └─────────────────────────┘  │   │
    └───────────────┬───────────────┘   │
                    │                   │
    ┌───────────────▼───────────────┐   │
    │       Claude Code SDK层       │   │
    │  ┌─────────────────────────┐  │   │
    │  │ TypeScript SDK          │  │   │
    │  │ - createSession()       │  │   │
    │  │ - execute()             │  │   │
    │  │ - tools: read,glob,grep │  │   │
    │  └─────────────────────────┘  │   │
    │  ┌─────────────────────────┐  │   │
    │  │ Python SDK              │  │   │
    │  │ - analyze_changes()     │  │   │
    │  │ - incremental_update()  │  │   │
    │  └─────────────────────────┘  │   │
    └───────────────┬───────────────┘   │
                    │                   │
    ┌───────────────▼───────────────┐   │
    │        数据存储层             │   │
    │  ┌─────────────────────────┐  │   │
    │  │ Git Repository          │  │   │
    │  │ └─ .repomind/           │  │   │
    │  │    ├─ knowledge.yaml    │  │   │
    │  │    ├─ docs/             │  │   │
    │  │    └─ meta/             │  │   │
    │  └─────────────────────────┘  │   │
    │  ┌─────────────────────────┐  │   │
    │  │ Registry Repository     │  │   │
    │  │ └─ registry/            │  │   │
    │  │    ├─ repositories.yaml │  │   │
    │  │    └─ relationships.yaml │  │   │
    │  └─────────────────────────┘  │   │
    └───────────────┬───────────────┘   │
                    │                   │
    ┌───────────────▼───────────────┐   │
    │        集成和触发层           │   │
    │  ┌─────────────────────────┐  │   │
    │  │ Git Webhook Handler     │  │   │
    │  │ - onPush()              │  │   │
    │  │ - onPullRequest()       │  │   │
    │  └─────────────────────────┘  │   │
    │  ┌─────────────────────────┐  │   │
    │  │ CI/CD Pipeline          │  │   │
    │  │ - GitHub Actions        │  │   │
    │  │ - GitLab CI             │  │   │
    │  └─────────────────────────┘  │   │
    └─────────────────────────────────┘
```

## 核心组件详细设计

### 1. KnowledgeBuilderAgent

负责单仓库的知识提取和生成。

```typescript
interface KnowledgeBuilderAgent {
  // 分析仓库并生成结构化知识
  analyzeRepository(repoPath: string): Promise<RepositoryAnalysis>;
  
  // 生成知识库文件
  generateKnowledgeBase(analysis: RepositoryAnalysis, outputPath: string): Promise<void>;
  
  // 增量更新机制
  detectChanges(repoPath: string, lastHash: string): Promise<ChangeAnalysis>;
  updateKnowledgeDelta(changes: ChangeAnalysis, knowledgePath: string): Promise<void>;
}

interface RepositoryAnalysis {
  overview: ProjectOverview;
  architecture: ArchitectureAnalysis;
  apis: APIAnalysis;
  dataFlow: DataFlowAnalysis;
  dependencies: DependencyAnalysis;
  timestamp: string;
  gitHash: string;
}
```

### 2. CrossRepoQueryEngine

处理跨仓库的智能检索和查询。

```typescript
interface CrossRepoQueryEngine {
  // 语义查询
  semanticQuery(question: string): Promise<QueryResult>;
  
  // 查找相关仓库
  findRelevantRepositories(intent: QueryIntent): Promise<string[]>;
  
  // 收集知识库内容
  gatherKnowledgeFromRepos(repos: string[]): Promise<KnowledgeCollection>;
  
  // 分析查询意图
  analyzeQueryIntent(question: string): Promise<QueryIntent>;
}

interface QueryResult {
  answer: string;
  sources: RepositoryReference[];
  confidence: number;
  relatedQuestions: string[];
}
```

### 3. RepositoryRelationshipAgent

发现和管理仓库间的关联关系。

```typescript
interface RepositoryRelationshipAgent {
  // 发现关联关系
  discoverRelationships(repoAnalysis: RepositoryAnalysis): Promise<Relationship[]>;
  
  // 分析技术依赖
  analyzeTechnicalDependencies(repoPath: string): Promise<TechnicalDependency[]>;
  
  // 分析API调用关系
  analyzeApiCallRelationships(repoPath: string): Promise<ApiCallRelationship[]>;
  
  // 分析数据流关系
  analyzeDataFlowRelationships(repoPath: string): Promise<DataFlowRelationship[]>;
}

interface Relationship {
  type: 'technical_dependency' | 'api_call' | 'data_flow' | 'business_logic';
  source: string;
  target: string;
  strength: number;
  confidence: number;
  metadata: Record<string, any>;
}
```

### 4. MCP服务器

提供Claude Code集成的协议接口。

```typescript
interface RepoMindMCPServer {
  tools: MCPTool[];
  
  // 处理工具调用
  handleToolCall(tool: string, params: any): Promise<any>;
  
  // 注册自定义工具
  registerTool(tool: MCPTool): void;
}

interface MCPTool {
  name: string;
  description: string;
  parameters: Record<string, any>;
  handler: (params: any) => Promise<any>;
}
```

## 数据模型设计

### 知识库数据结构

```yaml
# knowledge.yaml - 核心知识库索引文件
version: "1.0.0"
repository:
  name: "project-name"
  url: "https://gitlab.com/org/project"
  language: "typescript"
generated_at: "2024-09-10T10:00:00Z"
knowledge_graph:
  entities: [...]
  relationships: [...]
  concepts: [...]
content_index:
  overview: "./docs/overview.md"
  architecture: "./docs/architecture.md"
  # ...
```

### 关系图谱数据结构

```yaml
# repositories.yaml - 多仓库关系管理
version: "1.0.0"
repositories:
  project-core:
    url: "https://gitlab.com/org/project-core"
    maintainer: "core-team"
    tech_stack: ["typescript", "react"]
relationships:
  - type: "runtime_dependency"
    source: "project-core"
    target: "shared-utils"
    strength: 0.9
```

## 性能和扩展性设计

### 1. 缓存策略

```typescript
interface CacheStrategy {
  // 知识库缓存
  knowledgeCache: {
    ttl: number;
    maxSize: number;
    evictionPolicy: 'LRU' | 'LFU';
  };
  
  // 查询结果缓存
  queryCache: {
    ttl: number;
    maxSize: number;
    keyStrategy: 'semantic' | 'exact';
  };
}
```

### 2. 并发处理

- **知识库更新**: 使用队列机制避免并发冲突
- **多仓库查询**: 并行查询多个仓库，聚合结果
- **增量更新**: 只处理变更部分，提高效率

### 3. 错误处理和重试

```typescript
interface ErrorHandlingStrategy {
  retryPolicy: {
    maxRetries: number;
    backoffStrategy: 'exponential' | 'linear';
    retryableErrors: string[];
  };
  
  fallbackStrategy: {
    enableFallback: boolean;
    fallbackMethods: string[];
  };
}
```

## 安全和权限设计

### 1. 访问控制

```typescript
interface AccessControl {
  repositoryAccess: {
    public: string[];
    private: string[];
    restricted: string[];
  };
  
  userPermissions: {
    read: string[];
    write: string[];
    admin: string[];
  };
}
```

### 2. 数据安全

- **敏感信息过滤**: 自动识别和过滤敏感数据
- **访问日志**: 记录所有查询和更新操作
- **加密存储**: 敏感配置信息加密存储

## 监控和运维

### 1. 监控指标

```typescript
interface MonitoringMetrics {
  performance: {
    analysisTime: number;
    queryResponseTime: number;
    cacheHitRate: number;
  };
  
  quality: {
    knowledgeCompleteness: number;
    queryAccuracy: number;
    userSatisfaction: number;
  };
  
  usage: {
    dailyQueries: number;
    activeRepositories: number;
    knowledgeUpdateFrequency: number;
  };
}
```

### 2. 健康检查

```typescript
interface HealthCheck {
  services: {
    claudeCodeSDK: 'healthy' | 'degraded' | 'unhealthy';
    gitAccess: 'healthy' | 'degraded' | 'unhealthy';
    mcpServer: 'healthy' | 'degraded' | 'unhealthy';
  };
  
  dataIntegrity: {
    knowledgeBaseConsistency: boolean;
    relationshipGraphIntegrity: boolean;
  };
}
```

## 部署架构

### 1. 单机部署

```yaml
services:
  deepwiki-agent:
    image: deepwiki/agent:latest
    environment:
      - CLAUDE_API_KEY=${CLAUDE_API_KEY}
      - GIT_ACCESS_TOKEN=${GIT_ACCESS_TOKEN}
    volumes:
      - ./config:/app/config
      - ./data:/app/data
```

### 2. 分布式部署

```yaml
services:
  knowledge-builder:
    replicas: 3
    image: deepwiki/builder:latest
    
  query-engine:
    replicas: 5
    image: deepwiki/query:latest
    
  mcp-server:
    replicas: 2
    image: deepwiki/mcp:latest
    
  redis:
    image: redis:alpine
    
  postgres:
    image: postgres:13
```

## 技术选型说明

### 1. Claude Code SDK
- **优势**: 基于Claude Code的深度代码理解能力，内置Read、Glob、Grep等工具
- **版本**: 支持TypeScript和Python SDK (@anthropic/claude-code-sdk)
- **集成方式**: 通过SDK创建会话，使用内置工具进行代码分析
- **工具支持**: read(文件读取)、glob(模式匹配)、grep(搜索)、bash(命令执行)等

### 2. Git集成
- **支持**: GitHub、GitLab、Bitbucket
- **触发方式**: Webhook + 轮询双重保障
- **权限管理**: OAuth + Personal Access Token

### 3. 存储方案
- **知识库**: Git仓库原生存储
- **缓存**: Redis内存缓存
- **元数据**: PostgreSQL结构化存储