/**
 * RepoMind 核心类型定义
 */

// 基础Agent接口
export interface BaseAgent {
  name: string;
  version: string;
  capabilities: string[];
}

// 导出BaseAnalysisAgent类（从agents/base/BaseAnalysisAgent导入）
export { BaseAnalysisAgent } from '../agents/base/BaseAnalysisAgent';

// 分析配置接口
export interface AnalysisConfig {
  repoPath: string;
  outputPath: string;
  depth: 'shallow' | 'normal' | 'deep';
  includeTests: boolean;
  includeDocs: boolean;
  customPatterns?: Record<string, string[]>;
}

// 分析结果接口
export interface AnalysisResult {
  agentName: string;
  status: 'success' | 'error' | 'partial';
  output: {
    document: string;
    metadata: Record<string, any>;
    references: string[];
  };
  executionTime: number;
  confidence: number;
}

// 分析任务接口
export interface AnalysisTask {
  id: string;
  agentName: string;
  priority?: number;
}

// 知识库生成结果接口
export interface KnowledgeGenerationResult {
  status: 'success' | 'partial' | 'error';
  results: AnalysisResult[];
  overallConfidence: number;
  generatedFiles: string[];
  metadata: {
    totalTasks: number;
    successfulTasks: number;
    averageExecutionTime: number;
    timestamp: string;
    warnings?: string[];
  };
}

// 上下文数据接口
export interface ContextData {
  projectInfo: {
    name: string;
    type: string;
    language: string;
    framework?: string;
  };
  techStack: string[];
  fileStructure: Record<string, string[]>;
  existingDocs: string[];
}

// 知识查询接口
export interface KnowledgeQuery {
  query: string;
  scope?: 'overview' | 'architecture' | 'api' | 'all';
  depth?: 'shallow' | 'normal' | 'deep';
  format?: 'summary' | 'detailed' | 'reference';
}

// 知识查询结果接口
export interface KnowledgeResult {
  answer: string;
  confidence: number;
  sources: SourceReference[];
  relatedConcepts: string[];
  suggestedQueries: string[];
}

// 源引用接口
export interface SourceReference {
  type: 'file' | 'document' | 'api';
  path: string;
  lineNumber?: number;
  excerpt?: string;
}

// 验证报告接口
export interface ValidationReport {
  overallScore: number;
  dimensions: {
    completeness?: number;
    accuracy?: number;
    consistency?: number;
    readability?: number;
  };
  issues: string[];
  suggestions: string[];
}

// 插件结果接口
export interface PluginResult {
  pluginName: string;
  status: 'success' | 'error';
  output: any;
  executionTime: number;
}

// 重试策略类型
export type BackoffStrategy = 'linear' | 'exponential' | 'fixed';

// 知识库配置接口
export interface RepoMindConfig {
  analysis: {
    depth: 'shallow' | 'normal' | 'deep';
    includeTests: boolean;
    includeDocs: boolean;
    customPatterns?: {
      components: string[];
      apis: string[];
      models: string[];
    };
  };
  
  agents: {
    maxConcurrent: number;
    timeout: number;
    retryPolicy: {
      maxRetries: number;
      backoffStrategy: BackoffStrategy;
    };
  };
  
  output: {
    format: 'standard' | 'compact' | 'detailed';
    language: 'zh-CN' | 'en-US';
    includeGraphs: boolean;
    customSections?: string[];
  };
  
  quality: {
    minConfidenceThreshold: number;
    enableValidation: boolean;
    validateReferences: boolean;
  };
}

// 知识库索引结构
export interface KnowledgeIndex {
  version: string;
  repository: {
    name: string;
    path: string;
    url?: string;
    language: string;
    framework?: string;
    analysisDepth: string;
    includeTests: boolean;
  };
  generatedAt: string;
  analysisConfig: AnalysisConfig;
  contentIndex: {
    overview: string;
    architecture: string;
    components: string;
    apis: string;
    dataModels: string;
    workflows: string;
  };
  metadata: Record<string, any>;
  qualityMetrics: {
    overallConfidence: number;
    successfulTasks: number;
    totalTasks: number;
  };
}