/**
 * 架构分析Agent
 * 负责分析系统架构模式、分层结构和组件关系
 */

import { BaseAnalysisAgent } from './base/BaseAnalysisAgent';
import { AnalysisConfig, ContextData } from '../types';

export class ArchitectureAnalysisAgent extends BaseAnalysisAgent {
  readonly name = 'architecture-analysis';
  readonly version = '1.0.0';
  readonly capabilities = ['architecture-pattern-detection', 'layer-analysis', 'component-relationship'];

  /**
   * 架构分析需要深入理解系统层次和复杂的组件关系
   */
  protected getOptimalMaxTurns(): number {
    return 22;
  }

  protected async analyze(config: AnalysisConfig, _sharedContext?: ContextData): Promise<{
    document: string;
    metadata: Record<string, any>;
    references: string[];
  }> {
    const prompt = await this.loadPrompt('architecture-analysis.md');
    const customizedPrompt = this.customizePrompt(prompt, config);
    const systemPrompt = this.buildSystemPrompt(config);

    // 使用统一的Claude分析方法
    const analysisResult = await this.executeClaudeAnalysis(customizedPrompt, systemPrompt);
    
    // 从Claude的分析结果中提取结构化数据
    const structuredData = this.extractStructuredData(analysisResult);
    const metadata: Record<string, any> = {
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
    let confidence = result.document && result.document.length > 1000 ? 0.85 : 0.65;
    
    // 如果是部分结果，降低置信度
    if (isPartialResult) {
      confidence *= 0.7;
    }
    
    return confidence;
  }

  protected getDocumentTitle(projectName: string): string {
    return `系统架构：${projectName}`;
  }

  private buildSystemPrompt(config: AnalysisConfig): string {
    return `你是一个资深的软件架构师，专注于分析 ${config.repoPath} 项目的系统架构。

专业领域：系统架构分析，重点关注架构模式识别、分层结构分析、组件关系和架构决策评估。

核心任务：识别架构模式、分析分层结构、理解组件交互、评估架构质量。

请根据通用分析指导中的核心原则，深入分析项目的架构设计，提供专业的架构洞察。`;
  }

}