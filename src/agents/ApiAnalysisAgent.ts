/**
 * API分析Agent
 * 负责发现和分析项目中的API接口、端点和通信协议
 */

import { BaseAnalysisAgent } from './base/BaseAnalysisAgent';
import { AnalysisConfig, ContextData } from '../types';

export class ApiAnalysisAgent extends BaseAnalysisAgent {
  readonly name = 'api-analysis';
  readonly version = '1.0.0';
  readonly capabilities = ['api-discovery', 'endpoint-analysis', 'protocol-detection'];

  /**
   * API分析需要扫描多个文件和深入理解接口设计
   */
  protected getOptimalMaxTurns(): number {
    return 15;
  }

  protected async analyze(config: AnalysisConfig, _sharedContext?: ContextData): Promise<{
    document: string;
    metadata: Record<string, any>;
    references: string[];
  }> {
    const prompt = await this.loadPrompt('apis-analysis.md');
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
    let confidence = 0.5; // API分析基础置信度
    
    // 如果是部分结果，降低置信度
    if (isPartialResult) {
      confidence *= 0.7;
    }
    
    const docLength = result.document.length;
    const refCount = result.references.length;
    const endpointCount = result.metadata.endpointCount || 0;
    const apiTypeCount = (result.metadata.apiTypes?.length || 0);
    const hasAuth = (result.metadata.authMethods?.length || 0) > 0;
    const hasVersioning = (result.metadata.apiVersions?.length || 0) > 0;
    
    // 基于分析深度调整置信度
    if (docLength > 3000) confidence += 0.2;
    else if (docLength > 1500) confidence += 0.15;
    else if (docLength > 800) confidence += 0.1;
    
    // 基于API发现数量调整置信度
    if (endpointCount > 20) confidence += 0.15;
    else if (endpointCount > 10) confidence += 0.1;
    else if (endpointCount > 5) confidence += 0.05;
    
    // 基于API类型多样性调整置信度
    if (apiTypeCount > 2) confidence += 0.1;
    else if (apiTypeCount > 0) confidence += 0.05;
    
    // 基于引用质量调整置信度
    if (refCount > 8) confidence += 0.1;
    else if (refCount > 4) confidence += 0.05;
    
    // 基于分析完整性调整置信度
    if (hasAuth) confidence += 0.05;
    if (hasVersioning) confidence += 0.05;
    
    return Math.min(confidence, 1.0);
  }

  protected getDocumentTitle(projectName: string): string {
    return `API接口：${projectName}`;
  }

  private buildSystemPrompt(config: AnalysisConfig): string {
    return `你是一个专业的API设计专家，专注于分析 ${config.repoPath} 项目的API架构和接口设计。

专业领域：API接口分析，重点关注API发现、接口设计、协议分析和使用规范。

核心任务：发现API端点、分析接口结构、理解通信协议、评估设计质量。

请根据通用分析指导中的核心原则，深入分析项目的API设计，提供专业的接口架构洞察。`;
  }

}