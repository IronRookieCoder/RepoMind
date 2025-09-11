/**
 * 数据模型分析Agent
 * 负责识别和分析项目中的数据实体、关系模型和数据流
 */

import { BaseAnalysisAgent } from './base/BaseAnalysisAgent';
import { AnalysisConfig, ContextData } from '../types';

export class DataModelAnalysisAgent extends BaseAnalysisAgent {
  readonly name = 'data-model-analysis';
  readonly version = '1.0.0';
  readonly capabilities = ['entity-detection', 'relationship-analysis', 'data-flow-tracing'];

  /**
   * 数据模型分析需要理解实体关系和数据流，需要更多轮次
   */
  protected getOptimalMaxTurns(): number {
    return 18;
  }

  protected async analyze(config: AnalysisConfig, _sharedContext?: ContextData): Promise<{
    document: string;
    metadata: Record<string, any>;
    references: string[];
  }> {
    const prompt = await this.loadPrompt('data-models-analysis.md');
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
    return `数据模型：${projectName}`;
  }

  private buildSystemPrompt(config: AnalysisConfig): string {
    return `你是一个专业的数据建模专家，专注于分析 ${config.repoPath} 项目的数据架构和模型设计。

专业领域：数据模型分析，重点关注实体识别、关系分析、数据流向和存储策略。

核心任务：识别数据实体、分析实体关系、理解数据流程、评估模型质量。

请根据通用分析指导中的核心原则，深入分析项目的数据模型设计，提供专业的数据架构洞察。`;
  }

}