# API参考和代码示例

## 概述

RepoMind提供了完整的API接口，支持知识库的构建、查询和管理。本文档包含所有API的详细说明和代码示例。

## 核心API

### 1. KnowledgeBuilderAgent API

#### 1.1 analyzeRepository()

分析指定仓库并生成结构化知识。

```typescript
import { KnowledgeBuilderAgent } from '@repomind/core';
import { ClaudeCodeSDK } from '@anthropic/claude-code-sdk';

// 初始化Claude Code SDK
const claudeCodeSDK = new ClaudeCodeSDK();

const agent = new KnowledgeBuilderAgent({
  claudeCode: claudeCodeSDK,
  config: {
    analysisDepth: 'deep',
    includeTests: true,
    generateGraphs: true,
    sessionOptions: {
      tools: ['read', 'glob', 'grep', 'bash'],
      systemPrompt: '你是一个代码分析专家'
    }
  }
});

// 分析仓库
const analysis = await agent.analyzeRepository('/path/to/repo');
console.log('分析结果:', analysis);
```

**参数:**
- `repoPath: string` - 仓库本地路径
- `options?: AnalysisOptions` - 分析选项

```typescript
interface AnalysisOptions {
  depth?: 'shallow' | 'normal' | 'deep';
  includeTests?: boolean;
  generateGraphs?: boolean;
  includePatterns?: string[];
  excludePatterns?: string[];
}
```

**返回值:**
```typescript
interface RepositoryAnalysis {
  overview: {
    name: string;
    description: string;
    techStack: string[];
    architecturePattern: string;
    team?: string;
  };
  architecture: {
    components: ComponentAnalysis[];
    patterns: string[];
    decisions: ArchitecturalDecision[];
  };
  apis: {
    endpoints: APIEndpoint[];
    schemas: DataSchema[];
  };
  dataFlow: {
    entities: DataEntity[];
    flows: DataFlowPath[];
  };
  dependencies: DependencyGraph;
  timestamp: string;
  gitHash: string;
}
```

#### 1.2 generateKnowledgeBase()

基于分析结果生成知识库文件。

```typescript
// 生成知识库
await agent.generateKnowledgeBase(analysis, '/path/to/output');

// 自定义模板
await agent.generateKnowledgeBase(analysis, '/path/to/output', {
  templates: {
    overview: 'custom-overview.hbs',
    architecture: 'custom-architecture.hbs'
  },
  format: 'wiki',
  language: 'zh-CN'
});
```

**参数:**
- `analysis: RepositoryAnalysis` - 仓库分析结果
- `outputPath: string` - 输出目录路径
- `options?: GenerationOptions` - 生成选项

```typescript
interface GenerationOptions {
  templates?: {
    overview?: string;
    architecture?: string;
    components?: string;
    apis?: string;
  };
  format?: 'wiki' | 'docs' | 'json';
  language?: 'zh-CN' | 'en-US';
  includeGraphs?: boolean;
}
```

#### 1.3 增量更新 API

```typescript
// 检测变更
const changes = await agent.detectChanges('/path/to/repo', 'last-git-hash');

// 增量更新知识库
await agent.updateKnowledgeDelta(changes, '/path/to/knowledge');
```

### 2. CrossRepoQueryEngine API

#### 2.1 semanticQuery()

执行跨仓库的语义查询。

```typescript
import { CrossRepoQueryEngine } from '@repomind/core';
import { ClaudeCodeSDK } from '@anthropic/claude-code-sdk';

const claudeCodeSDK = new ClaudeCodeSDK();

const queryEngine = new CrossRepoQueryEngine({
  registryPath: '/path/to/registry',
  claudeCode: claudeCodeSDK,
  cache: {
    enabled: true,
    ttl: 3600
  }
});

// 语义查询
const result = await queryEngine.semanticQuery(
  "用户认证是如何实现的？涉及哪些服务？"
);

console.log('查询结果:', result.answer);
console.log('相关仓库:', result.sources);
console.log('置信度:', result.confidence);
```

**参数:**
- `question: string` - 查询问题
- `options?: QueryOptions` - 查询选项

```typescript
interface QueryOptions {
  repositories?: string[]; // 限制查询范围
  scope?: 'architecture' | 'apis' | 'components' | 'all';
  maxResults?: number;
  includeCode?: boolean;
  language?: string;
}
```

**返回值:**
```typescript
interface QueryResult {
  answer: string;
  sources: RepositoryReference[];
  confidence: number;
  relatedQuestions: string[];
  searchTime: number;
  cached: boolean;
}

interface RepositoryReference {
  repository: string;
  files: string[];
  relevanceScore: number;
  excerpts: CodeExcerpt[];
}
```

#### 2.2 findRelevantRepositories()

查找与问题相关的仓库。

```typescript
// 查找相关仓库
const repos = await queryEngine.findRelevantRepositories({
  domain: 'authentication',
  techStack: ['node.js', 'express'],
  keywords: ['jwt', 'oauth']
});
```

### 3. RepositoryRelationshipAgent API

#### 3.1 discoverRelationships()

自动发现仓库间的关联关系。

```typescript
import { RepositoryRelationshipAgent } from '@repomind/core';
import { ClaudeCodeSDK } from '@anthropic/claude-code-sdk';

const claudeCodeSDK = new ClaudeCodeSDK();

const relationAgent = new RepositoryRelationshipAgent({
  claudeCode: claudeCodeSDK
});

// 发现关系
const relationships = await relationAgent.discoverRelationships(analysis);

// 分析特定类型的关系
const apiCalls = await relationAgent.analyzeApiCallRelationships('/path/to/repo');
const dependencies = await relationAgent.analyzeTechnicalDependencies('/path/to/repo');
```

**返回值:**
```typescript
interface Relationship {
  type: 'technical_dependency' | 'api_call' | 'data_flow' | 'business_logic';
  source: string;
  target: string;
  strength: number; // 0-1
  confidence: number; // 0-1
  metadata: {
    description?: string;
    endpoints?: string[];
    dataTypes?: string[];
    callFrequency?: number;
  };
}
```

### 4. MCP服务器 API

#### 4.1 工具接口

RepoMind通过MCP协议提供工具接口，可在Claude Code中直接使用。

```typescript
// MCP工具定义 - 基于Claude Code SDK
const tools = [
  {
    name: "query_repository_knowledge",
    description: "使用Claude Code SDK查询仓库知识库",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "查询问题"
        },
        repositories: {
          type: "array",
          items: { type: "string" },
          description: "仓库名称列表（可选）"
        },
        scope: {
          type: "string",
          enum: ["architecture", "apis", "components", "all"],
          description: "查询范围"
        },
        useTools: {
          type: "array",
          items: { type: "string" },
          description: "使用的Claude Code工具: read, glob, grep, bash"
        }
      },
      required: ["query"]
    }
  }
];
```

#### 4.2 在Claude Code中使用

```typescript
// 在Claude Code对话中直接使用
@query_repository_knowledge({
  query: "这个项目的数据库设计是怎样的？",
  repositories: ["user-service", "order-service"],
  scope: "architecture"
})
```

## 配置API

### 1. 项目配置

```typescript
// repomind.config.ts
export default {
  repositories: {
    include: ['src/**', 'lib/**'],
    exclude: ['node_modules', 'dist', '*.test.ts']
  },
  analysis: {
    depth: 'deep',
    includeTests: true,
    generateGraphs: true,
    patterns: {
      components: ['*Service.ts', '*Controller.ts'],
      apis: ['**/routes/**', '**/api/**'],
      models: ['**/models/**', '**/entities/**']
    }
  },
  output: {
    format: 'wiki',
    language: 'zh-CN',
    templates: './templates'
  },
  claude: {
    model: 'claude-3-sonnet',
    maxTokens: 4096,
    temperature: 0.1
  },
  git: {
    ignorePatterns: ['*.log', 'tmp/**'],
    includeHistory: false
  }
} satisfies RepoMindConfig;
```

### 2. 运行时配置

```typescript
// 环境变量配置
process.env.CLAUDE_API_KEY = 'your-api-key';
process.env.GIT_ACCESS_TOKEN = 'your-git-token';
process.env.REPOMIND_LOG_LEVEL = 'info';
process.env.REPOMIND_CACHE_TTL = '3600';
```

## 命令行工具

### 1. 基础命令

```bash
# 安装CLI工具
npm install -g @repomind/cli

# 分析单个仓库
repomind analyze /path/to/repo --output .repomind/

# 分析并更新多个仓库
repomind batch-analyze --config repos.json

# 启动MCP服务器
repomind server --port 3000 --registry /path/to/registry

# 查询知识库
repomind query "如何实现用户认证？" --repos user-service,auth-service
```

### 2. 高级命令

```bash
# 增量更新
repomind update /path/to/repo --since HEAD~5

# 关系分析
repomind relationships --source user-service --target auth-service

# 导出知识库
repomind export --format json --output knowledge.json

# 健康检查
repomind health --check-all
```

## SDK使用示例

### 完整示例：构建项目知识库

```typescript
import { 
  KnowledgeBuilderAgent, 
  RepositoryRelationshipAgent,
  CrossRepoQueryEngine,
  RepoMindConfig 
} from '@repomind/core';

async function buildKnowledgeBase() {
  // 1. 初始化配置
  const claudeCodeSDK = new ClaudeCodeSDK();
  
  const config: RepoMindConfig = {
    claudeCode: claudeCodeSDK,
    analysis: {
      depth: 'deep',
      includeTests: true,
      sessionOptions: {
        tools: ['read', 'glob', 'grep', 'bash'],
        systemPrompt: '你是一个代码分析专家',
        maxMessages: 100
      }
    }
  };

  // 2. 创建知识构建器
  const builder = new KnowledgeBuilderAgent(config);
  
  // 3. 分析仓库
  const repoPath = '/path/to/your/repo';
  console.log('开始分析仓库...');
  const analysis = await builder.analyzeRepository(repoPath);
  
  // 4. 生成知识库
  console.log('生成知识库文档...');
  await builder.generateKnowledgeBase(analysis, `${repoPath}/.repomind`);
  
  // 5. 发现关联关系
  const relationAgent = new RepositoryRelationshipAgent(config);
  const relationships = await relationAgent.discoverRelationships(analysis);
  
  console.log('发现的关联关系:', relationships.length);
  
  // 6. 测试查询功能
  const queryEngine = new CrossRepoQueryEngine({
    registryPath: '/path/to/registry',
    ...config
  });
  
  const result = await queryEngine.semanticQuery(
    "这个项目的主要架构模式是什么？"
  );
  
  console.log('查询结果:', result.answer);
  console.log('置信度:', result.confidence);
  
  return {
    analysis,
    relationships,
    queryResult: result
  };
}

// 运行示例
buildKnowledgeBase().catch(console.error);
```

### 增量更新示例

```typescript
import { IncrementalUpdater } from '@repomind/core';

async function setupIncrementalUpdates() {
  const claudeCodeSDK = new ClaudeCodeSDK();
  
  const updater = new IncrementalUpdater({
    claudeCode: claudeCodeSDK
  });
  
  // 监听Git变更
  updater.onGitPush(async (payload) => {
    console.log(`收到推送: ${payload.repository.name}`);
    
    // 检测变更影响
    const changes = await updater.detectChanges(
      payload.repository.path,
      payload.before
    );
    
    // 只更新必要的部分
    if (changes.affectedAreas.length > 0) {
      await updater.updateKnowledgeDelta(
        changes,
        `${payload.repository.path}/.repomind`
      );
      console.log('知识库已更新');
    }
  });
}
```

### MCP集成示例

```typescript
import { RepoMindMCPServer } from '@repomind/mcp';

// 创建MCP服务器
const claudeCodeSDK = new ClaudeCodeSDK();

const mcpServer = new RepoMindMCPServer({
  port: 3000,
  claudeCode: claudeCodeSDK,
  registryPath: '/path/to/registry'
});

// 添加自定义工具
mcpServer.registerTool({
  name: 'analyze_code_quality',
  description: '分析代码质量和技术债务',
  parameters: {
    repository: 'string',
    metrics: 'array'
  },
  handler: async (params) => {
    // 自定义分析逻辑
    return await analyzeCodeQuality(params.repository, params.metrics);
  }
});

// 启动服务器
await mcpServer.start();
console.log('MCP服务器已启动');
```

## 错误处理

### 常见错误类型

```typescript
import { RepoMindError, ErrorCode } from '@repomind/core';

try {
  await agent.analyzeRepository('/invalid/path');
} catch (error) {
  if (error instanceof RepoMindError) {
    switch (error.code) {
      case ErrorCode.REPOSITORY_NOT_FOUND:
        console.error('仓库路径不存在');
        break;
      case ErrorCode.CLAUDE_API_ERROR:
        console.error('Claude API调用失败:', error.message);
        break;
      case ErrorCode.INSUFFICIENT_PERMISSIONS:
        console.error('权限不足');
        break;
      default:
        console.error('未知错误:', error.message);
    }
  }
}
```

### 重试机制

```typescript
import { RetryConfig } from '@repomind/core';

const retryConfig: RetryConfig = {
  maxRetries: 3,
  backoffStrategy: 'exponential',
  retryableErrors: [
    ErrorCode.CLAUDE_API_TIMEOUT,
    ErrorCode.NETWORK_ERROR,
    ErrorCode.RATE_LIMIT_EXCEEDED
  ]
};

const agent = new KnowledgeBuilderAgent({
  claude: { apiKey: process.env.CLAUDE_API_KEY },
  retry: retryConfig
});
```

## 性能优化

### 缓存配置

```typescript
import { CacheConfig } from '@repomind/core';

const cacheConfig: CacheConfig = {
  enabled: true,
  provider: 'redis', // 或 'memory'
  ttl: 3600, // 秒
  maxSize: '100MB',
  keyPrefix: 'repomind:',
  redis: {
    host: 'localhost',
    port: 6379,
    db: 0
  }
};
```

### 并行处理

```typescript
// 并行分析多个仓库
const repos = ['repo1', 'repo2', 'repo3'];
const analyses = await Promise.all(
  repos.map(repo => agent.analyzeRepository(repo))
);

// 并行查询
const queries = [
  'API接口如何设计？',
  '数据库模型是什么？',
  '认证机制如何实现？'
];
const results = await Promise.all(
  queries.map(q => queryEngine.semanticQuery(q))
);
```

## 监控和调试

### 日志配置

```typescript
import { Logger } from '@repomind/core';

const logger = new Logger({
  level: 'debug',
  format: 'json',
  outputs: [
    { type: 'console' },
    { type: 'file', path: 'repomind.log' }
  ]
});

// 使用日志
logger.info('开始分析仓库', { repository: 'user-service' });
logger.error('分析失败', { error: error.message });
```

### 性能监控

```typescript
import { PerformanceMonitor } from '@repomind/core';

const monitor = new PerformanceMonitor({
  metricsInterval: 60000, // 1分钟
  enableTracing: true
});

// 监控分析性能
const analysis = await monitor.track(
  'repository_analysis',
  () => agent.analyzeRepository(repoPath)
);

console.log('分析耗时:', monitor.getMetric('repository_analysis').duration);
```