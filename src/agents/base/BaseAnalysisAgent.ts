/**
 * 基础分析Agent抽象类
 * 定义所有分析Agent的通用接口和行为
 */

import { promises as fs } from 'fs';
import path from 'path';
import { 
  BaseAgent, 
  AnalysisConfig, 
  AnalysisResult, 
  ContextData 
} from '../../types';
import { SDKHelper } from '../../utils/sdk-helper';

export abstract class BaseAnalysisAgent implements BaseAgent {
  abstract readonly name: string;
  abstract readonly version: string;
  abstract readonly capabilities: string[];
  
  /**
   * 格式化时间戳为可读格式
   */
  protected formatTimestamp(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
    
    return `[${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}Z]`;
  }
  
  /**
   * 获取该Agent的最优maxTurns配置
   * 不同Agent根据任务复杂度返回不同的轮次数
   */
  protected abstract getOptimalMaxTurns(): number;

  /**
   * 执行分析任务的主入口
   */
  async execute(config: AnalysisConfig, sharedContext?: ContextData): Promise<AnalysisResult> {
    const startTime = Date.now();
    
    try {
      console.log(`[${this.name}] 开始执行分析任务...`);
      
      const result = await this.analyze(config, sharedContext);
      const executionTime = Date.now() - startTime;
      
      console.log(`[${this.name}] 分析任务完成，耗时: ${executionTime}ms`);
      
      // 检查是否为部分结果
      const isPartialResult = result.document.includes('[注意：') || 
                            result.document.includes('分析因') ||
                            result.document.includes('简化版分析结果');
      
      return {
        agentName: this.name,
        status: 'success',
        output: result,
        executionTime,
        confidence: this.calculateConfidence(result, isPartialResult)
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(`[${this.name}] 分析任务失败:`, error);
      
      return {
        agentName: this.name,
        status: 'error',
        output: { 
          document: '', 
          metadata: { error: (error as Error).message }, 
          references: [] 
        },
        executionTime,
        confidence: 0
      };
    }
  }

  /**
   * 抽象方法：执行具体的分析逻辑
   */
  protected abstract analyze(config: AnalysisConfig, sharedContext?: ContextData): Promise<{
    document: string;
    metadata: Record<string, any>;
    references: string[];
  }>;

  /**
   * 抽象方法：计算分析结果的置信度
   */
  protected abstract calculateConfidence(result: any, isPartialResult?: boolean): number;

  // Prompt缓存，避免重复文件读取
  private static promptCache = new Map<string, string>();

  /**
   * 加载通用分析指导（带缓存优化）
   */
  protected async loadCommonGuide(): Promise<string> {
    const filename = 'common-analysis-guide.md';
    
    // 检查缓存
    if (BaseAnalysisAgent.promptCache.has(filename)) {
      return BaseAnalysisAgent.promptCache.get(filename)!;
    }

    try {
      const currentDir = __dirname;
      const promptPath = path.resolve(currentDir, '../..', 'prompts', filename);
      const content = await fs.readFile(promptPath, 'utf-8');
      
      // 缓存结果
      BaseAnalysisAgent.promptCache.set(filename, content);
      return content;
    } catch (error) {
      console.warn(`[${this.name}] 无法加载通用指导文件: ${filename}`, error);
      return '';
    }
  }

  /**
   * 加载特定Agent的Prompt模板文件（带缓存优化）
   */
  protected async loadSpecificPrompt(filename: string): Promise<string> {
    // 检查缓存
    if (BaseAnalysisAgent.promptCache.has(filename)) {
      return BaseAnalysisAgent.promptCache.get(filename)!;
    }

    try {
      // 获取当前文件所在目录的绝对路径
      const currentDir = __dirname;
      const promptPath = path.resolve(currentDir, '../..', 'prompts', filename);
      const content = await fs.readFile(promptPath, 'utf-8');
      
      // 缓存结果
      BaseAnalysisAgent.promptCache.set(filename, content);
      return content;
    } catch (error) {
      console.warn(`[${this.name}] 无法加载prompt文件: ${filename}`, error);
      return '';
    }
  }

  /**
   * 加载组合Prompt（通用指导 + 特定prompt）
   */
  protected async loadPrompt(filename: string): Promise<string> {
    const [commonGuide, specificPrompt] = await Promise.all([
      this.loadCommonGuide(),
      this.loadSpecificPrompt(filename)
    ]);

    // 组合通用指导和特定prompt
    if (commonGuide && specificPrompt) {
      return `${commonGuide}\n\n---\n\n${specificPrompt}`;
    } else if (specificPrompt) {
      return specificPrompt;
    } else if (commonGuide) {
      return commonGuide;
    } else {
      return '';
    }
  }

  /**
   * 自定义Prompt内容，替换占位符
   */
  protected customizePrompt(prompt: string, config: AnalysisConfig): string {
    return prompt
      .replace(/\{\{REPO_PATH\}\}/g, config.repoPath)
      .replace(/\{\{ANALYSIS_DEPTH\}\}/g, config.depth)
      .replace(/\{\{INCLUDE_TESTS\}\}/g, config.includeTests.toString())
      .replace(/\{\{INCLUDE_DOCS\}\}/g, config.includeDocs.toString())
      .replace(/\{\{OUTPUT_PATH\}\}/g, config.outputPath)
      .replace(/\{\{CUSTOM_PATTERNS\}\}/g, JSON.stringify(config.customPatterns || {}));
  }

  /**
   * 从Claude分析结果中提取结构化数据
   */
  protected extractStructuredData(content: string): {
    techStack: string[];
    references: string[];
    metadata: Record<string, any>;
  } {
    return SDKHelper.extractStructuredData(content);
  }

  /**
   * 执行Claude分析的通用方法，支持部分结果和降级策略
   * 使用Agent特定的最优轮次配置
   */
  protected async executeClaudeAnalysis(
    prompt: string, 
    systemPrompt: string
  ): Promise<string> {
    const optimalTurns = this.getOptimalMaxTurns();
    console.log(`[${this.name}] 使用优化轮次配置: ${optimalTurns} 轮`);
    
    return SDKHelper.executeAnalysis(prompt, systemPrompt, {
      maxTurns: optimalTurns,
      timeout: 300000,
      retryAttempts: 2,
      enablePartialResults: true,
      fallbackToSimplerPrompt: true
    });
  }

  /**
   * 格式化输出文档
   */
  protected formatDocument(content: string, config: AnalysisConfig): string {
    const projectName = this.extractProjectName(config.repoPath);
    const timestamp = this.formatTimestamp();

    return `# ${this.getDocumentTitle(projectName)}

${content}

---
*本文档由RepoMind系统自动生成于 ${timestamp}*  
*分析深度: ${config.depth}*  
*Agent: ${this.name} v${this.version}*
`;
  }

  /**
   * 获取文档标题
   */
  protected abstract getDocumentTitle(projectName: string): string;

  /**
   * 从路径中提取项目名称
   */
  protected extractProjectName(repoPath: string): string {
    return path.basename(repoPath) || '未知项目';
  }

  /**
   * 获取基本项目信息（不进行预分析）
   */
  protected getProjectBasicInfo(config: AnalysisConfig): { name: string; path: string } {
    return {
      name: path.basename(config.repoPath) || '未知项目',
      path: config.repoPath
    };
  }

}