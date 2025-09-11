/**
 * 组件分析Agent
 * 负责识别和分析项目中的关键组件、模块和服务
 */

import { BaseAnalysisAgent } from './base/BaseAnalysisAgent';
import { AnalysisConfig, ContextData } from '../types';

export class ComponentAnalysisAgent extends BaseAnalysisAgent {
  readonly name = 'component-analysis';
  readonly version = '1.0.0';
  readonly capabilities = ['component-detection', 'dependency-analysis', 'interface-extraction'];

  /**
   * 组件分析需要深入理解代码结构，是最复杂的分析任务
   */
  protected getOptimalMaxTurns(): number {
    return 25;
  }

  protected async analyze(config: AnalysisConfig, _sharedContext?: ContextData): Promise<{
    document: string;
    metadata: Record<string, any>;
    references: string[];
  }> {
    const prompt = await this.loadPrompt('components-analysis.md');
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
    let confidence = result.document && result.document.length > 1000 ? 0.8 : 0.6;
    
    // 如果是部分结果，降低置信度
    if (isPartialResult) {
      confidence *= 0.7;
    }
    
    return confidence;
  }

  protected getDocumentTitle(projectName: string): string {
    return `组件设计：${projectName}`;
  }

  private buildSystemPrompt(config: AnalysisConfig): string {
    return `你是一个专业的软件组件设计专家，专注于分析 ${config.repoPath} 项目的组件架构。

专业领域：组件设计分析，重点关注组件识别、职责划分、依赖关系和设计模式。

核心任务：识别关键组件、分析组件关系、理解交互模式、评估设计质量。

请根据通用分析指导中的核心原则，深入分析项目的组件设计，提供专业的组件架构洞察。`;
  }

}