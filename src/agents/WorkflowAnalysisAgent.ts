/**
 * 工作流分析Agent
 * 负责识别和分析项目中的业务流程、工作流程和处理逻辑
 */

import { BaseAnalysisAgent } from './base/BaseAnalysisAgent';
import { AnalysisConfig, ContextData } from '../types';

export class WorkflowAnalysisAgent extends BaseAnalysisAgent {
  readonly name = 'workflow-analysis';
  readonly version = '1.0.0';
  readonly capabilities = ['workflow-detection', 'process-analysis', 'flow-tracing'];

  /**
   * 工作流分析需要追踪复杂的业务流程和状态转换
   */
  protected getOptimalMaxTurns(): number {
    return 20;
  }

  protected async analyze(config: AnalysisConfig, _sharedContext?: ContextData): Promise<{
    document: string;
    metadata: Record<string, any>;
    references: string[];
  }> {
    const prompt = await this.loadPrompt('workflows-analysis.md');
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
    return `业务流程：${projectName}`;
  }

  private buildSystemPrompt(config: AnalysisConfig): string {
    return `你是一个专业的业务流程分析专家，专注于分析 ${config.repoPath} 项目的工作流程和业务逻辑。

专业领域：业务流程分析，重点关注流程识别、步骤分析、决策逻辑和异常处理。

核心任务：识别关键流程、分析执行步骤、理解业务逻辑、评估流程质量。

请根据通用分析指导中的核心原则，深入分析项目的业务流程设计，提供专业的流程架构洞察。`;
  }
}