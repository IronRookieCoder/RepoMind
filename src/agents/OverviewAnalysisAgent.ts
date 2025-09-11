/**
 * 概览分析Agent
 * 负责分析项目的整体概况、核心特性和技术栈
 */

import { BaseAnalysisAgent } from './base/BaseAnalysisAgent';
import { AnalysisConfig, ContextData } from '../types';

export class OverviewAnalysisAgent extends BaseAnalysisAgent {
  readonly name = 'overview-analysis';
  readonly version = '1.0.0';
  readonly capabilities = ['project-analysis', 'concept-extraction', 'tech-stack-detection'];

  /**
   * 基于实际测试，概览分析需要约16轮次才能完成完整的探索和分析
   */
  protected getOptimalMaxTurns(): number {
    return 20;
  }

  protected async analyze(config: AnalysisConfig, _sharedContext?: ContextData): Promise<{
    document: string;
    metadata: Record<string, any>;
    references: string[];
  }> {
    const prompt = await this.loadPrompt('overview-analysis.md');
    const customizedPrompt = this.customizePrompt(prompt, config);
    const systemPrompt = this.buildSystemPrompt(config);

    // 使用统一的Claude分析方法
    const analysisResult = await this.executeClaudeAnalysis(customizedPrompt, systemPrompt);
    
    // 从Claude的分析结果中提取结构化数据
    const structuredData = this.extractStructuredData(analysisResult);
    const metadata: Record<string, any> = {
      techStack: structuredData.techStack,
      references: structuredData.references,
      projectInfo: this.getProjectBasicInfo(config),
      ...structuredData.metadata
    };

    return {
      document: this.formatDocument(analysisResult, config),
      metadata,
      references: structuredData.references
    };
  }

  protected calculateConfidence(result: any, isPartialResult?: boolean): number {
    // 简化置信度计算 - 基于分析结果是否成功生成
    let confidence = result.document && result.document.length > 500 ? 0.9 : 0.7;
    
    // 如果是部分结果，降低置信度
    if (isPartialResult) {
      confidence *= 0.7;
    }
    
    return confidence;
  }

  protected getDocumentTitle(projectName: string): string {
    return `项目概览：${projectName}`;
  }

  private buildSystemPrompt(config: AnalysisConfig): string {
    return `你是一个专业的代码分析专家，专注于为 ${config.repoPath} 项目生成高质量的项目概览文档。

专业领域：项目概览分析，侧重于理解项目的业务价值、核心功能和整体特征。

请根据通用分析指导中的核心原则，深入分析项目的实际情况，确保生成的概览文档准确反映项目的核心特征。`;
  }
}