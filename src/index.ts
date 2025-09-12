/**
 * RepoMind - 单仓库知识库AI Agent系统
 * 主入口文件
 */

// 导出核心类型
export * from './types';

// 导出Agent调度器和任务清单管理器
export { AgentScheduler } from './agents/scheduler/AgentScheduler';
export { TaskListManager } from './agents/TaskListManager';

// 导出所有分析Agent
export { BaseAnalysisAgent } from './agents/base/BaseAnalysisAgent';

// 导出工具函数
export * from './utils';

// 导出MCP模块
export * from './mcp';

// 默认配置
export const DEFAULT_CONFIG = {
  analysis: {
    depth: 'normal' as const,
    includeTests: true,
    includeDocs: true,
    customPatterns: {
      components: ['**/*Component.ts', '**/*component.js', '**/components/**'],
      apis: ['**/api/**', '**/routes/**', '**/*Controller.ts', '**/*controller.js'],
      models: ['**/models/**', '**/*Model.ts', '**/entities/**', '**/*entity.ts']
    }
  },
  
  agents: {
    maxConcurrent: 3,
    timeout: 300000, // 5分钟
    retryPolicy: {
      maxRetries: 2,
      backoffStrategy: 'exponential' as const
    }
  },
  
  output: {
    format: 'standard' as const,
    language: 'zh-CN' as const,
    includeGraphs: true,
    customSections: []
  },
  
  quality: {
    minConfidenceThreshold: 0.6,
    enableValidation: true,
    validateReferences: true
  }
};

/**
 * 快速启动知识库生成的便捷函数
 */
import { AgentScheduler } from './agents/scheduler/AgentScheduler';
import { AnalysisConfig } from './types';

export async function generateKnowledgeBase(config: Partial<AnalysisConfig> & { repoPath: string }): Promise<void> {
  const fullConfig: AnalysisConfig = {
    repoPath: config.repoPath,
    outputPath: config.outputPath || config.repoPath,
    depth: config.depth || 'normal',
    includeTests: config.includeTests ?? true,
    includeDocs: config.includeDocs ?? true,
    ...(config.customPatterns && { customPatterns: config.customPatterns })
  };

  const scheduler = new AgentScheduler();
  const result = await scheduler.executeKnowledgeGeneration(fullConfig);
  
  if (result.status === 'success') {
    console.log('🎉 知识库生成成功!');
    console.log(`📊 整体置信度: ${(result.overallConfidence * 100).toFixed(1)}%`);
    console.log(`📄 生成文件数: ${result.generatedFiles.length}`);
  } else if (result.status === 'partial') {
    console.warn('⚠️ 知识库部分生成成功');
    if (result.metadata.warnings) {
      result.metadata.warnings.forEach(warning => {
        console.warn(`⚠️ ${warning}`);
      });
    }
  } else {
    console.error('❌ 知识库生成失败');
    throw new Error(`知识库生成失败: ${result.status}`);
  }
}

/**
 * 版本信息
 */
export const VERSION = '1.0.0';