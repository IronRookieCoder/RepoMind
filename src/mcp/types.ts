/**
 * MCP相关类型定义
 * 基于索引系统构建架构文档的技术方案
 */

import { KnowledgeIndex } from '../types';

// MCP工具定义
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
}

// 单仓库查询工具参数（基于knowledge.yaml结构）
export interface SearchKnowledgeArgs {
  repoPath: string;
  query: string;
  type?: 'overview' | 'systemArchitecture' | 'apiReference' | 'businessWorkflows' | 'all';
  format?: 'summary' | 'detailed' | 'reference';
}

// 获取知识库结构参数
export interface GetKnowledgeBaseArgs {
  repoPath: string;
}

// 获取文档内容参数
export interface GetDocumentArgs {
  repoPath: string;
  documentType: 'overview' | 'systemArchitecture' | 'apiReference' | 'businessWorkflows';
}

// 刷新索引参数
export interface RefreshIndexArgs {
  repoPath?: string;
}

// 搜索结果接口
export interface SearchResult {
  repoId: string;
  filePath: string;
  content: string;
  relevance: number;
  type: 'overview' | 'systemArchitecture' | 'apiReference' | 'businessWorkflows';
  section?: string;
}

// 知识库查询结果（基于knowledge.yaml结构）
export interface KnowledgeBaseResult {
  repoId: string;
  knowledgeIndex: KnowledgeIndex;
  contentIndex: {
    overview: string;
    systemArchitecture: string;
    apiReference: string;
    businessWorkflows: string;
  };
  qualityMetrics: {
    overallConfidence: number;
    successfulTasks: number;
    totalTasks: number;
  };
}

// 文档内容结果
export interface DocumentResult {
  filePath: string;
  content: string;
  lastModified: string;
  size: number;
}

// 索引刷新结果
export interface RefreshResult {
  status: 'success' | 'partial' | 'error';
  message: string;
  reposProcessed: number;
  errors?: string[];
}

// MCP服务器状态
export interface MCPServerStatus {
  activeRepos: number;
  lastUpdate: string;
  version: string;
  capabilities: string[];
}

// MCP服务器配置
export interface MCPServerConfig {
  name: string;
  version: string;
  description: string;
  capabilities: {
    tools: boolean;
    resources: boolean;
  };
  maxConcurrentRequests: number;
  timeout: number;
}